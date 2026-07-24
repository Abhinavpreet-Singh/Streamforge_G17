"""
Week 2 — register a TruckReading Avro contract with Schema Registry.

Usage:
  python scripts/register_schema.py                       # registers schema/truck_reading.avsc
  python scripts/register_schema.py schema/truck_reading_v2.avsc
"""

import json
import os
import sys
from pathlib import Path

import httpx

SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:8081")
DEFAULT_SCHEMA_FILE = Path(__file__).resolve().parent.parent / "schema" / "truck_reading.avsc"
SUBJECT = "truck-telemetry-value"


def register(schema_file: Path) -> int:
    schema = json.loads(schema_file.read_text())
    response = httpx.post(
        f"{SCHEMA_REGISTRY_URL}/subjects/{SUBJECT}/versions",
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        json={"schema": json.dumps(schema)},
        timeout=10,
    )
    response.raise_for_status()
    schema_id = response.json()["id"]
    print(f"Registered '{SUBJECT}' from {schema_file.name}: schema id {schema_id}")
    return schema_id


def main() -> None:
    schema_file = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SCHEMA_FILE
    register(schema_file)


if __name__ == "__main__":
    main()
