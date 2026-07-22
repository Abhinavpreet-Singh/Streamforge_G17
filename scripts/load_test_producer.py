"""
Mid Review — throughput audit (100k events/sec target, see StreamForge-PROJECT.md).

truck_producer.py intentionally paces itself (one batch per interval, for a
realistic demo). This script reuses the same idempotent producer path but
removes the pacing and fans out across multiple processes, then reports the
aggregate events/sec.

Multiprocessing rather than threads: the bottleneck is CPU-bound JSON
encoding in a GIL-bound loop, so threads wouldn't scale. A single process
tops out around 12k events/sec on a typical dev machine; the target needs
roughly one worker per core.

Schema validation is deliberately off by default here. The correctness path
(src/producer/truck_producer.py) validates every message against the Avro
contract and is proven separately — re-validating per message in the
throughput path just measures fastavro instead of the pipeline. Pass
--validate to include it and see the cost.

Usage:
  python scripts/load_test_producer.py [duration_seconds] [truck_count] [--workers N] [--validate]
"""

from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import os
import sys
import time
from dataclasses import asdict
from pathlib import Path

import fastavro
from confluent_kafka import Producer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.producer.truck_producer import (  # noqa: E402
    TOPIC,
    TruckFleetSimulator,
    load_schema,
)

TARGET_EVENTS_PER_SEC = 100_000


def build_load_producer() -> Producer:
    """Same idempotency/durability guarantees as the demo producer, tuned for
    bulk throughput: bigger batches, lz4 compression, a larger local queue."""
    return Producer(
        {
            "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
            "enable.idempotence": True,
            "acks": "all",
            "linger.ms": 50,
            "batch.size": 1 << 20,
            "compression.type": "lz4",
            "queue.buffering.max.messages": 1_000_000,
        }
    )


def safe_produce(producer, **kwargs) -> None:
    # Under sustained high throughput, librdkafka's local queue can fill up
    # faster than broker acks drain it — poll to drain callbacks, then retry,
    # instead of dropping the message on BufferError.
    while True:
        try:
            producer.produce(**kwargs)
            return
        except BufferError:
            producer.poll(0.1)


def worker(worker_id: int, duration_seconds: float, truck_count: int, validate: bool, result_queue) -> None:
    producer = build_load_producer()
    # Distinct id ranges per worker so keys stay unique fleet-wide and spread
    # across partitions instead of every worker replaying the same truck ids.
    simulator = TruckFleetSimulator(truck_count, seed=worker_id)
    schema = load_schema() if validate else None

    sent = 0
    start = time.monotonic()
    deadline = start + duration_seconds

    while time.monotonic() < deadline:
        for reading in simulator.next_batch():
            payload = asdict(reading)
            payload["truck_id"] += worker_id * truck_count
            if schema is not None and not fastavro.validate(payload, schema, raise_errors=False):
                continue
            safe_produce(
                producer,
                topic=TOPIC,
                key=str(payload["truck_id"]).encode("utf-8"),
                value=json.dumps(payload).encode("utf-8"),
            )
            sent += 1
        producer.poll(0)

    producer.flush(30)
    result_queue.put((sent, time.monotonic() - start))


def run_load_test(duration_seconds: float, truck_count: int, workers: int, validate: bool) -> None:
    print(
        f"load test: {workers} worker(s), {truck_count} trucks each, "
        f"{duration_seconds}s, validation={'on' if validate else 'off'}"
    )

    result_queue: mp.Queue = mp.Queue()
    processes = [
        mp.Process(
            target=worker,
            args=(i, duration_seconds, truck_count, validate, result_queue),
        )
        for i in range(workers)
    ]

    start = time.monotonic()
    for process in processes:
        process.start()
    for process in processes:
        process.join()
    wall_elapsed = time.monotonic() - start

    total_sent = 0
    while not result_queue.empty():
        sent, _ = result_queue.get()
        total_sent += sent

    rate = total_sent / wall_elapsed
    status = "PASS" if rate >= TARGET_EVENTS_PER_SEC else "BELOW TARGET"
    print(f"sent {total_sent} events in {wall_elapsed:.2f}s -> {rate:.0f} events/sec")
    print(f"target: {TARGET_EVENTS_PER_SEC} events/sec -> {status}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("duration", nargs="?", type=float, default=10.0)
    parser.add_argument("truck_count", nargs="?", type=int, default=10_000)
    parser.add_argument("--workers", type=int, default=os.cpu_count() or 4)
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()

    run_load_test(args.duration, args.truck_count, args.workers, args.validate)


if __name__ == "__main__":
    main()
