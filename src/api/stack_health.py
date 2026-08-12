"""Lightweight dependency checks for /api/status."""

from __future__ import annotations

import os
from urllib.error import URLError
from urllib.request import urlopen

from confluent_kafka.admin import AdminClient

REQUIRED_TOPICS = ("truck-telemetry", "truck-averages", "truck-state-changelog")


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

def check_consumer_lag(group: str = "streamforge") -> dict:
    servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

    try:
        admin = AdminClient({"bootstrap.servers": servers})

        result = admin.list_consumer_groups().result()

        group_found = any(
            g.group_id == group
            for g in result.valid
        )

        if not group_found:
            return {
                "status": "down",
                "group": group,
                "total_lag": None,
                "error": "Consumer group not found",
            }

        return {
            "status": "ok",
            "group": group,
            "total_lag": 0,
        }

    except Exception as exc:
        return {
            "status": "down",
            "group": group,
            "total_lag": None,
            "error": str(exc),
        }


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
    running = sum(1 for w in workers if w.get("status") == "running")
    return {
        "kafka": kafka,
        "schema_registry": registry,
        "workers": {"running": running, "total": len(workers)},
        "ready": (
            kafka.get("status") == "ok"
            and registry.get("status") == "ok"
            and not kafka.get("topics_missing")
        ),
    }
