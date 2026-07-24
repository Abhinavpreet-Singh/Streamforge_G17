"""
Final Review — chaos test: kill a worker mid-calculation, prove state
recovers from the Kafka changelog with zero data loss.

What it does:
  1. Worker A ingests readings, writing state to RocksDB + the changelog.
  2. Worker A is killed abruptly (no flush, no graceful shutdown) and its
     local RocksDB directory is deleted — the harshest case, a replacement
     landing on a fresh node after a rebalance.
  3. Worker B starts empty, replays the changelog from Kafka, and must end
     up with byte-identical per-truck aggregates.

Exits non-zero if recovered state doesn't match, so it can gate a demo.

Usage: python scripts/chaos_recovery_demo.py [readings_per_truck] [truck_count]
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

from confluent_kafka import Consumer, Producer, TopicPartition

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.state_store.rocksdb_store import (  # noqa: E402
    CHANGELOG_TOPIC,
    RocksDBStateStore,
    kafka_changelog_publisher,
)

BOOTSTRAP = "localhost:9092"


def read_changelog(topic: str = CHANGELOG_TOPIC) -> list[tuple[str, dict]]:
    """Drain the changelog topic from the beginning, preserving order."""
    consumer = Consumer(
        {
            "bootstrap.servers": BOOTSTRAP,
            "group.id": f"chaos-recovery-{uuid.uuid4()}",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
        }
    )

    metadata = consumer.list_topics(topic, timeout=10)
    partitions = list(metadata.topics[topic].partitions)
    consumer.assign([TopicPartition(topic, p, 0) for p in partitions])

    records: list[tuple[str, dict]] = []
    empty_polls = 0
    while empty_polls < 5:
        message = consumer.poll(1.0)
        if message is None:
            empty_polls += 1
            continue
        if message.error():
            continue
        empty_polls = 0
        records.append(
            (
                message.key().decode("utf-8"),
                json.loads(message.value().decode("utf-8")),
            )
        )

    consumer.close()
    return records


def main() -> int:
    readings_per_truck = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    truck_count = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    workdir = Path(tempfile.mkdtemp(prefix="streamforge-chaos-"))
    worker_a_path = workdir / "worker-a"

    producer = Producer({"bootstrap.servers": BOOTSTRAP, "enable.idempotence": True})
    publisher = kafka_changelog_publisher(producer)

    print(f"[1] worker A ingesting {readings_per_truck} readings x {truck_count} trucks...")
    worker_a = RocksDBStateStore(worker_a_path, changelog_publisher=publisher)
    for reading_index in range(readings_per_truck):
        for truck_id in range(1, truck_count + 1):
            worker_a.update(truck_id, 30.0 + truck_id + (reading_index * 0.1))

    expected = {truck_id: worker_a.get(truck_id) for truck_id in range(1, truck_count + 1)}
    producer.flush(15)

    print("[2] killing worker A mid-calculation (no flush, local state destroyed)...")
    # Deliberately skip checkpoint()/close() — this is a crash, not a shutdown.
    del worker_a
    shutil.rmtree(worker_a_path, ignore_errors=True)

    print("[3] worker B starting empty, replaying changelog from Kafka...")
    records = read_changelog()
    print(f"    read {len(records)} changelog records")

    worker_b = RocksDBStateStore(workdir / "worker-b")
    restored = worker_b.restore_from_changelog(iter(records))
    recovered = {truck_id: worker_b.get(truck_id) for truck_id in range(1, truck_count + 1)}
    worker_b.checkpoint()
    worker_b.close()

    print(f"    restored {restored} truck states")

    mismatches = {
        truck_id: (expected[truck_id], recovered[truck_id])
        for truck_id in expected
        if expected[truck_id] != recovered[truck_id]
    }

    print()
    for truck_id in sorted(expected):
        exp, rec = expected[truck_id], recovered[truck_id]
        flag = "OK " if exp == rec else "MISMATCH"
        print(
            f"  {flag} truck {truck_id}: "
            f"before avg={exp.average} count={exp.count} | "
            f"after avg={rec.average} count={rec.count}"
        )

    shutil.rmtree(workdir, ignore_errors=True)

    print()
    if mismatches:
        print(f"FAILED: {len(mismatches)} truck(s) lost or corrupted state")
        return 1

    print(f"PASSED: all {len(expected)} truck states recovered exactly, zero data loss")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
