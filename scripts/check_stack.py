"""
Quick stack health check — run before demos or after docker compose up.

Usage: python scripts/check_stack.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src.api.stack_health import build_stack_status  # noqa: E402


def main() -> int:
    status = build_stack_status([])
    print(json.dumps(status, indent=2))

    kafka_ok = status["kafka"].get("status") == "ok"
    registry_ok = status["schema_registry"].get("status") == "ok"
    topics_ok = not status["kafka"].get("topics_missing")

    if kafka_ok and registry_ok and topics_ok:
        print("\nREADY — stack is up and topics exist.")
        return 0

    print("\nNOT READY — start infra and run: bash scripts/create_topics.sh")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
