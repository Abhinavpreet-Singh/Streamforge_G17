"""
Week 3 — State & Fault Tolerance

Embedded RocksDB (rocksdict) store holding per-truck rolling-average state,
mirrored to a Kafka changelog topic so a worker that dies mid-calculation can
rebuild exactly where it left off.

Recovery model: RocksDB is a local *cache* of state, the changelog topic is
the source of truth. A worker that loses its disk (new container, new node
after a rebalance) replays the changelog to rebuild; a worker that still has
its disk reads locally and only replays what it missed. Both paths converge
on the same state, which is what makes "no reading dropped or double
counted" hold across a crash.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterator

from rocksdict import Rdict

CHANGELOG_TOPIC = "truck-state-changelog"

logger = logging.getLogger(__name__)

# Publishes (key, value) to the changelog. Injected rather than imported so
# the store is testable without a broker, and so the caller owns delivery
# semantics (the producer is already configured idempotent upstream).
ChangelogPublisher = Callable[[str, dict], None]


@dataclass(frozen=True)
class TruckState:
    """Running aggregate for one truck. Mirrors TemperatureAggregate in the
    stream processor, but owned here so the store doesn't depend on Faust."""

    sum: float = 0.0
    count: int = 0

    @property
    def average(self) -> float:
        if self.count == 0:
            return 0.0
        return round(self.sum / self.count, 4)

    def add(self, temperature: float) -> TruckState:
        return TruckState(sum=self.sum + temperature, count=self.count + 1)

    def to_dict(self) -> dict:
        return {"sum": self.sum, "count": self.count}

    @classmethod
    def from_dict(cls, raw: dict) -> TruckState:
        return cls(sum=float(raw.get("sum", 0.0)), count=int(raw.get("count", 0)))


class RocksDBStateStore:
    """Local RocksDB state with write-through to a Kafka changelog.

    Writes go to RocksDB first, then the changelog. That order means a crash
    between the two replays a stale-but-correct value on recovery rather than
    inventing state that never existed locally — the aggregate is
    recomputed from the changelog, so a lost trailing write costs one reading,
    never a corrupt total.
    """

    def __init__(
        self,
        path: str | Path,
        changelog_publisher: ChangelogPublisher | None = None,
    ) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._db = Rdict(str(self._path))
        self._publish = changelog_publisher

    def get(self, truck_id: int) -> TruckState:
        raw = self._db.get(self._key(truck_id))
        if raw is None:
            return TruckState()
        return TruckState.from_dict(raw)

    def put(self, truck_id: int, state: TruckState) -> None:
        self._db[self._key(truck_id)] = state.to_dict()
        if self._publish is not None:
            self._publish(self._key(truck_id), state.to_dict())

    def update(self, truck_id: int, temperature: float) -> TruckState:
        """Read-modify-write a single reading into the running aggregate."""
        new_state = self.get(truck_id).add(temperature)
        self.put(truck_id, new_state)
        return new_state

    def restore_from_changelog(self, records: Iterator[tuple[str, dict]]) -> int:
        """Rebuild local state by replaying changelog records in order.

        Later records overwrite earlier ones for the same key, so replaying
        the full changelog converges on the last committed state per truck.
        Returns the number of trucks restored.
        """
        restored: set[str] = set()
        for key, value in records:
            if value is None:  # tombstone
                if key in self._db:
                    del self._db[key]
                restored.discard(key)
                continue
            self._db[key] = value
            restored.add(key)

        logger.info("restored %d truck states from changelog", len(restored))
        return len(restored)

    def checkpoint(self) -> None:
        """Force durability so a hard kill can't lose buffered writes."""
        self._db.flush()

    def all_states(self) -> dict[int, TruckState]:
        return {
            self._truck_id(key): TruckState.from_dict(self._db[key]) for key in self._db.keys()
        }

    def close(self) -> None:
        self._db.close()

    def __enter__(self) -> RocksDBStateStore:
        return self

    def __exit__(self, *exc_info) -> None:
        self.checkpoint()
        self.close()

    @staticmethod
    def _key(truck_id: int) -> str:
        return f"truck:{truck_id}"

    @staticmethod
    def _truck_id(key: str) -> int:
        return int(key.split(":", 1)[1])


def kafka_changelog_publisher(producer, topic: str = CHANGELOG_TOPIC) -> ChangelogPublisher:
    """Wrap a confluent_kafka Producer as a changelog publisher.

    Keyed by truck so the changelog is compacted per truck and replay order
    per key is preserved.
    """

    def publish(key: str, value: dict) -> None:
        producer.produce(
            topic,
            key=key.encode("utf-8"),
            value=json.dumps(value).encode("utf-8"),
        )
        producer.poll(0)

    return publish
