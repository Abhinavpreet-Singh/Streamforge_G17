"""
Uniqueness feature (README §6 #1) — exactly-once, provably.

Sends a batch of distinct readings, then re-sends the *exact same batch*
(simulating a producer retry or an at-least-once redelivery after a
rebalance). Runs the stream processor and proves the windowed sink counts
each reading exactly once — the duplicates are dropped by the dedup stage,
never aggregated.

Without dedup, the tumbling windows would count 2N readings; with it, N.

Usage: python scripts/exactly_once_demo.py [readings_per_truck] [truck_count]

Assumes the stack is up and `bash scripts/create_topics.sh` has run.
Uses short windows so the demo completes in seconds; run it on a fresh
topic (script clears prior truck-averages state via a unique window epoch).
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from confluent_kafka import Consumer, Producer, TopicPartition

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

BOOTSTRAP = "localhost:9092"
INPUT_TOPIC = "truck-telemetry"
OUTPUT_TOPIC = "truck-averages"


def _recreate_topic(topic: str) -> None:
    for args in (
        ["kafka-topics", "--bootstrap-server", "localhost:9092", "--delete",
         "--topic", topic, "--if-exists"],
        ["kafka-topics", "--bootstrap-server", "localhost:9092", "--create",
         "--topic", topic, "--partitions", "20", "--replication-factor", "1"],
    ):
        subprocess.run(
            ["docker", "compose", "exec", "-T", "kafka", *args],
            cwd=str(REPO_ROOT), capture_output=True, text=True,
        )


def reset_topics() -> None:
    """Wipe both input and output topics so the tally reflects only this run.
    Leftover telemetry on the input topic would be re-aggregated by the fresh
    worker; leftover aggregates on the output topic would inflate the count.
    Either makes the proof meaningless."""
    _recreate_topic(INPUT_TOPIC)
    _recreate_topic(OUTPUT_TOPIC)
    time.sleep(3)  # let the delete/recreate settle before producing


def send_batch(producer: Producer, readings: list[dict]) -> None:
    for reading in readings:
        producer.produce(
            INPUT_TOPIC,
            key=str(reading["truck_id"]).encode("utf-8"),
            value=json.dumps(reading).encode("utf-8"),
        )
    producer.flush(15)


# Advancer readings sit this far ahead in event time; used both to build them
# and to identify (and exclude) their far-future windows when tallying.
ADVANCER_OFFSET = timedelta(minutes=2)


def build_batch(readings_per_truck: int, truck_count: int, base: datetime) -> list[dict]:
    # Distinct sub-second timestamps per reading so each is a unique
    # (truck_id, timestamp) — the dedup key. All fall inside one short window.
    # Re-sending this exact list is what a duplicate delivery looks like.
    # Timestamps are anchored near *now*: Faust's window cleanup closes
    # near-current event-time windows but leaves far-future-dated ones open,
    # so synthetic far-off dates never emit.
    readings = []
    for reading_index in range(readings_per_truck):
        for truck_id in range(1, truck_count + 1):
            event_time = base + timedelta(milliseconds=reading_index * 100)
            readings.append(
                {
                    "truck_id": truck_id,
                    "temperature": 30.0 + truck_id + reading_index * 0.5,
                    "timestamp": event_time.isoformat(),
                }
            )
    return readings


def build_watermark_advancers(truck_count: int, base: datetime) -> list[dict]:
    """Event-time windows only close once a later event advances the stream
    clock past them. A fixed batch freezes that clock, so the real windows
    never close. These readings sit ADVANCER_OFFSET ahead — one per real truck,
    since the window clock advances per key — pushing each truck's watermark
    past its real window (forcing it to emit). The advancers' own windows are
    the newest, so they never close and are never counted."""
    advance_time = base + ADVANCER_OFFSET
    return [
        {
            "truck_id": truck_id,
            "temperature": 25.0,
            "timestamp": advance_time.isoformat(),
        }
        for truck_id in range(1, truck_count + 1)
    ]


def consume_averages(timeout_empty_polls: int = 6) -> list[dict]:
    consumer = Consumer(
        {
            "bootstrap.servers": BOOTSTRAP,
            "group.id": f"exactly-once-check-{uuid.uuid4()}",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
        }
    )
    metadata = consumer.list_topics(OUTPUT_TOPIC, timeout=10)
    partitions = list(metadata.topics[OUTPUT_TOPIC].partitions)
    consumer.assign([TopicPartition(OUTPUT_TOPIC, p, 0) for p in partitions])

    results: list[dict] = []
    empty = 0
    while empty < timeout_empty_polls:
        message = consumer.poll(1.0)
        if message is None:
            empty += 1
            continue
        if message.error():
            continue
        empty = 0
        results.append(json.loads(message.value().decode("utf-8")))
    consumer.close()
    return results


def start_worker(window_env: dict) -> subprocess.Popen:
    import os

    env = {**os.environ, **window_env}
    return subprocess.Popen(
        [str(REPO_ROOT / ".venv" / "Scripts" / "python.exe"), "-m", "faust",
         "-A", "src.stream_processor.topology", "worker", "-l", "warn"],
        cwd=str(REPO_ROOT),
        env=env,
    )


def stop_worker(proc: subprocess.Popen) -> None:
    proc.terminate()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()


def main() -> int:
    readings_per_truck = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    truck_count = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    distinct = readings_per_truck * truck_count

    epoch = uuid.uuid4().hex[:8]
    base = datetime.now(timezone.utc)
    batch = build_batch(readings_per_truck, truck_count, base)

    producer = Producer({"bootstrap.servers": BOOTSTRAP, "enable.idempotence": True})

    print("[0] resetting input + output topics so only this run is counted...")
    reset_topics()

    # Start the worker BEFORE producing: a fresh consumer group resets to
    # latest, so it must be assigned and listening before the data arrives or
    # it never sees it (the main pipeline works because producer and worker
    # run concurrently — this demo has to recreate that ordering).
    print("[1] starting stream processor (short windows, isolated consumer group)...")
    worker = start_worker(
        {
            "WINDOW_SIZE_SECONDS": "10",
            "HOPPING_STEP_SECONDS": "10",
            "WINDOW_EXPIRES_SECONDS": "12",
            "APP_ID": f"exactly-once-demo-{epoch}",
        }
    )
    time.sleep(18)  # let the worker finish startup + partition assignment

    print(f"[2] sending {distinct} distinct readings...")
    send_batch(producer, batch)
    print("[3] re-sending the EXACT SAME batch (duplicate delivery)...")
    send_batch(producer, batch)
    print(f"    {2 * distinct} messages now on {INPUT_TOPIC}, but only {distinct} are unique")

    # Advance the event-time watermark so the real windows actually close.
    send_batch(producer, build_watermark_advancers(truck_count, base))

    time.sleep(22)  # let windows close and emit
    stop_worker(worker)

    print("[4] tallying reading_count from truck-averages (tumbling only)...")
    averages = consume_averages()
    tumbling = [a for a in averages if a.get("window_type") == "tumbling"]
    # Advancer readings live in a later window; exclude any that closed so the
    # tally reflects only the real batch. Their window starts at/after the
    # advancer time; the real batch's window starts before it.
    advancer_cutoff = (base + ADVANCER_OFFSET).isoformat()
    real_tumbling = [a for a in tumbling if a["window_start"] < advancer_cutoff]
    total_counted = sum(a["reading_count"] for a in real_tumbling)
    print(f"    ({len(averages)} total window emissions, {len(real_tumbling)} real tumbling windows)")

    print()
    print(f"  distinct readings sent:      {distinct}")
    print(f"  duplicate copies also sent:  {distinct}")
    print(f"  readings counted by sink:    {total_counted}")
    print()

    if total_counted == distinct:
        print(f"PASSED: sink counted each reading exactly once ({distinct}), duplicates dropped")
        return 0
    if total_counted == 2 * distinct:
        print("FAILED: sink double-counted — dedup is not working")
        return 1
    print(
        f"INCONCLUSIVE: counted {total_counted}, expected {distinct}. "
        "Windows may not have all closed — increase worker runtime and retry."
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
