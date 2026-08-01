"""
Week 1 — Kafka Foundation (Owner: Team Lead, branch: Abhinavpreet)

Blasts mock IoT truck telemetry (truck_id, temperature, timestamp) into the
`truck-telemetry` Kafka topic using an idempotent confluent-kafka producer.
Every message is validated against the registered Avro contract
(schema/truck_reading.avsc, see scripts/register_schema.py) before it's
sent, so a malformed reading never reaches the topic in the first place.
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("truck_producer")


def load_schema() -> dict:
    return fastavro.parse_schema(json.loads(SCHEMA_PATH.read_text()))


@dataclass(frozen=True)
class TruckReading:
    truck_id: int
    temperature: float
    timestamp: str

    def to_json(self) -> bytes:
        return json.dumps(asdict(self)).encode("utf-8")


class TruckFleetSimulator:
    """Walks each truck's temperature from a random baseline instead of pure
    noise, so downstream filtering/windowing has something realistic to chew on."""

    def __init__(self, truck_count: int, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._baselines = {
            truck_id: self._rng.uniform(30.0, 40.0) for truck_id in range(1, truck_count + 1)
        }

    def next_batch(self) -> list[TruckReading]:
        now = datetime.now(timezone.utc).isoformat()
        readings = []
        for truck_id, baseline in self._baselines.items():
            baseline += self._rng.uniform(-0.4, 0.4)
            self._baselines[truck_id] = baseline
            temperature = round(baseline + self._rng.uniform(-0.2, 0.2), 2)
            readings.append(TruckReading(truck_id=truck_id, temperature=temperature, timestamp=now))
        return readings


def build_producer() -> Producer:
    return Producer(
        {
            "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
            "enable.idempotence": True,  # exactly-once producer semantics (see README uniqueness §6)
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
            # keyed by truck_id so all readings for one truck land on the same
            # partition, in order — required for correct per-truck windowing
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
    truck_count = int(os.getenv("TRUCK_COUNT", "500"))
    interval_seconds = float(os.getenv("PRODUCE_INTERVAL_SECONDS", "10"))
    run(truck_count, interval_seconds)


if __name__ == "__main__":
    main()
