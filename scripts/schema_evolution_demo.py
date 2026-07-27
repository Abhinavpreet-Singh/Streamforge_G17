"""
Uniqueness feature (README §6) — schema evolution demo.

Registers truck_reading_v2.avsc (adds `fuel_level`) as a new version of the
same Schema Registry subject, then proves an old consumer built against the
original 3-field TruckEvent model still parses a v2-shaped message without
error — the new field is just ignored, nothing breaks.

Usage: python scripts/schema_evolution_demo.py
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from register_schema import SUBJECT, register  # noqa: E402

from src.stream_processor.models import TruckEvent  # noqa: E402

V1_SCHEMA = REPO_ROOT / "schema" / "truck_reading.avsc"
V2_SCHEMA = REPO_ROOT / "schema" / "truck_reading_v2.avsc"


def main() -> None:
    register(V1_SCHEMA)
    v2_id = register(V2_SCHEMA)
    print(f"Schema Registry accepted v2 as a new, compatible version of '{SUBJECT}' (id {v2_id}).")

    new_shaped_message = json.dumps(
        {
            "truck_id": 101,
            "temperature": 38.4,
            "timestamp": "2026-07-22T10:00:00+00:00",
            "fuel_level": 82.5,  # field the old model has never heard of
        }
    ).encode("utf-8")

    old_consumer_event = TruckEvent.loads(new_shaped_message)
    assert old_consumer_event.truck_id == 101
    assert old_consumer_event.temperature == 38.4
    print(
        "Old consumer (3-field TruckEvent) parsed the v2 message fine, "
        f"ignoring fuel_level: {old_consumer_event}"
    )


if __name__ == "__main__":
    main()
