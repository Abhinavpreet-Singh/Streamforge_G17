"""
Week 1 — Kafka Foundation (Owner: Team Lead, branch: Abhinavpreet)

Blasts mock IoT truck telemetry into the `truck-telemetry` Kafka topic using
an idempotent confluent-kafka producer. Every message is validated against
schema/truck_reading.avsc before send.
"""

from __future__ import annotations

import json
import logging
import os
import random
import signal
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import fastavro
from confluent_kafka import Producer

TOPIC = "truck-telemetry"
SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "schema" / "truck_reading.avsc"

# Stable depot coords so the map shows real GPS from Kafka (not pure noise).
_DEPOTS = [
    (40.7128, -74.0060),
    (34.0522, -118.2437),
    (41.8781, -87.6298),
    (29.7604, -95.3698),
    (39.7392, -104.9903),
    (47.6062, -122.3321),
    (25.7617, -80.1918),
    (32.7767, -96.7970),
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("truck_producer")


def load_schema() -> dict:
    return fastavro.parse_schema(json.loads(SCHEMA_PATH.read_text()))


@dataclass(frozen=True)
class TruckReading:
    truck_id: int
    temperature: float
    timestamp: str
    fuel_level: float | None = None
    latitude: float | None = None
    longitude: float | None = None

    def to_json(self) -> bytes:
        return json.dumps(asdict(self)).encode("utf-8")


class TruckFleetSimulator:
    """Walks each truck's temperature/fuel/position from a depot baseline."""

    def __init__(self, truck_count: int, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._baselines: dict[int, float] = {}
        self._fuel: dict[int, float] = {}
        self._lat: dict[int, float] = {}
        self._lng: dict[int, float] = {}
        for truck_id in range(1, truck_count + 1):
            depot = _DEPOTS[(truck_id - 1) % len(_DEPOTS)]
            jitter_lat = self._rng.uniform(-0.8, 0.8)
            jitter_lng = self._rng.uniform(-0.8, 0.8)
            self._baselines[truck_id] = self._rng.uniform(30.0, 40.0)
            self._fuel[truck_id] = self._rng.uniform(40.0, 100.0)
            self._lat[truck_id] = depot[0] + jitter_lat
            self._lng[truck_id] = depot[1] + jitter_lng

    def next_batch(self) -> list[TruckReading]:
        now = datetime.now(timezone.utc).isoformat()
        readings = []
        for truck_id, baseline in self._baselines.items():
            baseline += self._rng.uniform(-0.4, 0.4)
            self._baselines[truck_id] = baseline
            temperature = round(baseline + self._rng.uniform(-0.2, 0.2), 2)

            fuel = max(5.0, self._fuel[truck_id] - self._rng.uniform(0.01, 0.08))
            self._fuel[truck_id] = fuel

            self._lat[truck_id] += self._rng.uniform(-0.01, 0.01)
            self._lng[truck_id] += self._rng.uniform(-0.01, 0.01)

            readings.append(
                TruckReading(
                    truck_id=truck_id,
                    temperature=temperature,
                    timestamp=now,
                    fuel_level=round(fuel, 2),
                    latitude=round(self._lat[truck_id], 5),
                    longitude=round(self._lng[truck_id], 5),
                )
            )
        return readings


def build_producer() -> Producer:
    return Producer(
        {
            "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
            "enable.idempotence": True,
            "acks": "all",
            "retries": 5,
            "max.in.flight.requests.per.connection": 5,
            "linger.ms": 10,
        }
    )


def delivery_report(err, msg) -> None:
    if err is not None:
        logger.error("delivery failed for key=%s: %s", msg.key(), err)


def run(truck_count: int, interval_seconds: float) -> None:
    producer = build_producer()
    simulator = TruckFleetSimulator(truck_count)
    schema = load_schema()
    running = True

    def stop(signum, frame) -> None:
        nonlocal running
        logger.info("shutdown signal received, flushing producer...")
        running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    logger.info(
        "streaming telemetry for %d trucks to '%s' every %.1fs",
        truck_count,
        TOPIC,
        interval_seconds,
    )

    while running:
        for reading in simulator.next_batch():
            payload = asdict(reading)
            if not fastavro.validate(payload, schema, raise_errors=False):
                logger.error("message failed schema validation, dropping: %s", payload)
                continue
            producer.produce(
                TOPIC,
                key=str(reading.truck_id).encode("utf-8"),
                value=json.dumps(payload).encode("utf-8"),
                callback=delivery_report,
            )
        producer.poll(0)
        time.sleep(interval_seconds)

    producer.flush(10)
    logger.info("producer stopped cleanly")


def main() -> None:
    demo = os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes")
    truck_count = int(os.getenv("TRUCK_COUNT", "100" if demo else "500"))
    interval_seconds = float(os.getenv("PRODUCE_INTERVAL_SECONDS", "2" if demo else "10"))
    run(truck_count, interval_seconds)


if __name__ == "__main__":
    main()
