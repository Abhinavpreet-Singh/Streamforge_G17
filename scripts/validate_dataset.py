"""
Offline validation for datasets/truck_data.csv against stream-processor rules.

Usage: python scripts/validate_dataset.py [path_to_csv]
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import pandas as pd  # noqa: E402

from src.stream_processor.transforms import passes_temperature_filter  # noqa: E402


def main() -> int:
    csv_path = Path(sys.argv[1] if len(sys.argv) > 1 else REPO_ROOT / "datasets" / "truck_data.csv")
    if not csv_path.exists():
        print(f"MISS: file not found: {csv_path}")
        return 1

    df = pd.read_csv(csv_path)
    required = {"truck_id", "temperature", "timestamp"}
    missing_cols = required - set(df.columns)
    if missing_cols:
        print(f"FAIL: missing columns {sorted(missing_cols)}")
        return 1

    null_ids = df["truck_id"].isna().sum()
    null_temps = df["temperature"].isna().sum()
    invalid_temp = (~df["temperature"].apply(passes_temperature_filter)).sum()
    valid = len(df) - invalid_temp - null_temps

    print(f"Dataset: {csv_path}")
    print(f"  rows:           {len(df)}")
    print(f"  unique trucks:  {df['truck_id'].nunique()}")
    print(f"  null truck_id:  {null_ids}")
    print(f"  null temp:      {null_temps}")
    print(f"  temp <= 0:      {invalid_temp} (would be filtered)")
    print(f"  valid readings: {valid}")

    if null_ids or null_temps:
        print("FAIL: null required fields")
        return 1

    print("PASS: schema and filter rules OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
