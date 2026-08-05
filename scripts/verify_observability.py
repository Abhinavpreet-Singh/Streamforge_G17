#!/usr/bin/env python3
"""Verify Prometheus can scrape the StreamForge API and key metrics exist."""

from __future__ import annotations

import sys
import urllib.error
import urllib.request

API_METRICS = "http://localhost:8000/metrics"
PROM_TARGETS = "http://localhost:9090/api/v1/targets"
PROM_QUERY = "http://localhost:9090/api/v1/query?query=streamforge_ingestion_rate"

REQUIRED_METRICS = (
    "streamforge_ingestion_rate",
    "streamforge_aggregate_rate",
    "streamforge_kafka_connected",
    "streamforge_workers_running",
    "telemetry_messages_total",
)


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=5) as resp:
        return resp.read().decode("utf-8")


def main() -> int:
    errors: list[str] = []

    try:
        body = fetch(API_METRICS)
    except urllib.error.URLError as exc:
        print(f"FAIL: API /metrics not reachable at {API_METRICS}: {exc}")
        print("Start: uvicorn src.api.main:app --host 0.0.0.0 --port 8000")
        return 1

    missing = [m for m in REQUIRED_METRICS if m not in body]
    if missing:
        errors.append(f"API /metrics missing: {', '.join(missing)}")
    else:
        print("OK: API exposes StreamForge Prometheus metrics")

    try:
        targets = fetch(PROM_TARGETS)
        if '"health":"up"' in targets and "streamforge-api" in targets:
            print("OK: Prometheus target streamforge-api is UP")
        elif "streamforge-api" in targets:
            errors.append("Prometheus sees streamforge-api but target is not healthy (is API on :8000?)")
        else:
            errors.append("Prometheus has no streamforge-api target — run: docker compose up -d prometheus grafana")
    except urllib.error.URLError as exc:
        errors.append(f"Prometheus not reachable at :9090 ({exc}). Run docker compose up -d prometheus")

    try:
        query = fetch(PROM_QUERY)
        if '"status":"success"' in query:
            print("OK: Prometheus query for streamforge_ingestion_rate succeeded")
        else:
            errors.append("Prometheus query failed — scrape may be stale")
    except urllib.error.URLError:
        pass

    if errors:
        for err in errors:
            print(f"WARN: {err}")
        print("\nGrafana: http://localhost:3001/d/streamforge-api (admin / admin)")
        return 1

    print("Grafana: http://localhost:3001/d/streamforge-api (admin / admin)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
