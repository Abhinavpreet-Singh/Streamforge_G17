"""Lightweight dependency checks for /api/status."""

from __future__ import annotations

import os
from urllib.error import URLError
from urllib.request import urlopen

from confluent_kafka import Consumer, TopicPartition
from confluent_kafka.admin import AdminClient

REQUIRED_TOPICS = ("truck-telemetry", "truck-averages", "truck-state-changelog")
LAG_TOPICS = ("truck-telemetry",)


def check_kafka(bootstrap: str | None = None) -> dict:
    servers = bootstrap or os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    try:
        admin = AdminClient({"bootstrap.servers": servers})
        metadata = admin.list_topics(timeout=5)
        present = {t for t in REQUIRED_TOPICS if t in metadata.topics}
        return {
            "status": "ok",
            "bootstrap": servers,
            "topics_ready": sorted(present),
            "topics_missing": sorted(set(REQUIRED_TOPICS) - present),
        }
    except Exception as exc:
        return {"status": "down", "bootstrap": servers, "error": str(exc)}


def check_consumer_lag(group: str | None = None) -> dict:
    """Sum high-watermark minus committed offset for the Faust consumer group."""
    group = group or os.getenv("APP_ID", "streamforge")
    servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    consumer = None

    try:
        admin = AdminClient({"bootstrap.servers": servers})
        metadata = admin.list_topics(timeout=5)

        groups = admin.list_consumer_groups().result()
        group_found = any(g.group_id == group for g in groups.valid)

        consumer = Consumer(
            {
                "bootstrap.servers": servers,
                "group.id": group,
                "enable.auto.commit": False,
            }
        )

        by_topic: dict[str, int] = {}
        total_lag = 0

        for topic_name in LAG_TOPICS:
            topic_meta = metadata.topics.get(topic_name)
            if topic_meta is None or topic_meta.error is not None:
                continue

            partitions = [
                TopicPartition(topic_name, partition_id)
                for partition_id in topic_meta.partitions
            ]
            if not partitions:
                continue

            committed = consumer.committed(partitions, timeout=5.0)
            topic_lag = 0
            for tp in committed:
                _low, high = consumer.get_watermark_offsets(tp, timeout=5.0)
                offset = tp.offset if tp.offset is not None and tp.offset >= 0 else high
                topic_lag += max(0, high - offset)
            by_topic[topic_name] = topic_lag
            total_lag += topic_lag

        if not group_found and total_lag == 0:
            return {
                "status": "down",
                "group": group,
                "total_lag": None,
                "by_topic": by_topic,
                "error": "Consumer group not found (start the stream processor)",
            }

        return {
            "status": "ok",
            "group": group,
            "total_lag": total_lag,
            "by_topic": by_topic,
        }
    except Exception as exc:
        return {
            "status": "down",
            "group": group,
            "total_lag": None,
            "by_topic": {},
            "error": str(exc),
        }
    finally:
        if consumer is not None:
            try:
                consumer.close()
            except Exception:
                pass


def check_schema_registry(url: str | None = None) -> dict:
    base = (url or os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:8081")).rstrip("/")
    try:
        with urlopen(f"{base}/subjects", timeout=3) as resp:
            ok = resp.status == 200
        return {"status": "ok" if ok else "down", "url": base}
    except URLError as exc:
        return {"status": "down", "url": base, "error": str(exc.reason)}
    except Exception as exc:
        return {"status": "down", "url": base, "error": str(exc)}


def build_stack_status(workers: list[dict]) -> dict:
    kafka = check_kafka()
    registry = check_schema_registry()
    lag = check_consumer_lag()
    running = sum(1 for w in workers if w.get("status") == "running")
    return {
        "kafka": kafka,
        "schema_registry": registry,
        "consumer_lag": lag,
        "workers": {"running": running, "total": len(workers)},
        "ready": (
            kafka.get("status") == "ok"
            and registry.get("status") == "ok"
            and not kafka.get("topics_missing")
        ),
    }
