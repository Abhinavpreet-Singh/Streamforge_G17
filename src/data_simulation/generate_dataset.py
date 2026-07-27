"""
Week 1 — Data Simulation & Validation (Owner: Data Simulation Engineer)

Generates the synthetic 50,000-truck dataset used for offline validation
and recovery-verification testing (see WORK_DISTRIBUTION.md). This is a
separate fixture from the live Kafka stream — different truck_id/timestamp
convention, used to sanity-check aggregation logic against a known input.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

TRUCK_COUNT = 50_000
CARRIER_PREFIXES = ["SAIA", "WERN", "USAT", "SWFT", "CRST", "KNGT", "SCHN", "HUBG"]
OUTPUT_PATH = "datasets/truck_data.csv"

# Continental US bounding box, close enough for synthetic fleet positions.
LAT_RANGE = (24.0, 49.0)
LON_RANGE = (-125.0, -67.0)


def generate_truck_ids(count: int, rng: np.random.Generator) -> np.ndarray:
    # Suffixes drawn without replacement guarantee every truck_id is unique
    # fleet-wide, regardless of which carrier prefix it's paired with.
    suffixes = rng.choice(100_000, size=count, replace=False)
    prefixes = rng.choice(CARRIER_PREFIXES, size=count)
    return np.array([f"{p}-{s:05d}" for p, s in zip(prefixes, suffixes)])


def generate_dataset(count: int = TRUCK_COUNT, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    timestamps = pd.date_range("2026-06-18", periods=count, freq="30s")

    return pd.DataFrame(
        {
            "truck_id": generate_truck_ids(count, rng),
            # Deliberately wider than the live pipeline's -20..60 valid
            # range so validation test cases have real out-of-range rows
            # to catch, not just a fixture that always passes.
            "temperature": rng.uniform(-25, 70, size=count).round(1),
            "fuel": rng.uniform(0, 100, size=count).round(1),
            "latitude": rng.uniform(*LAT_RANGE, size=count).round(6),
            "longitude": rng.uniform(*LON_RANGE, size=count).round(6),
            "timestamp": timestamps.strftime("%d-%m-%Y %H:%M"),
        }
    )


def main() -> None:
    df = generate_dataset()
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"wrote {len(df)} rows ({df['truck_id'].nunique()} unique truck_ids) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
