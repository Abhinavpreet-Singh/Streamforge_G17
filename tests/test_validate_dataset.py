"""Smoke tests for scripts/validate_dataset.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV = REPO_ROOT / "datasets" / "truck_data.csv"


def test_truck_data_csv_exists():
    assert CSV.is_file()


def test_validate_dataset_script_passes():
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "validate_dataset.py"), str(CSV)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS" in result.stdout
