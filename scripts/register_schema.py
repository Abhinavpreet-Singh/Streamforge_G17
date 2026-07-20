"""
Week 2 — register the TruckReading Avro contract with Schema Registry.

Usage: python scripts/register_schema.py
"""

import json
import os
from pathlib import Path

import httpx

SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:8081")
SCHEMA_FILE = Path(__file__).resolve().parent.parent / "schema" / "truck_reading.avsc"
SUBJECT = "truck-telemetry-value"


def main() -> None:
    schema = json.loads(SCHEMA_FILE.read_text())
    response = httpx.post(
        f"{SCHEMA_REGISTRY_URL}/subjects/{SUBJECT}/versions",
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        json={"schema": json.dumps(schema)},
        timeout=10,
    )
    response.raise_for_status()
    print(f"Registered '{SUBJECT}': schema id {response.json()['id']}")


if __name__ == "__main__":
    main()
