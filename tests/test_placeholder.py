import pytest
from src.validator import validate_message


def test_valid_message():
    message = {
        "truck_id": 1,
        "temperature": 35.5,
        "timestamp": "2026-07-18T08:50:45.987061+00:00"
    }
    assert validate_message(message) is True


def test_missing_truck_id():
    message = {
        "temperature": 35.5,
        "timestamp": "2026-07-18T08:50:45.987061+00:00"
    }
    assert validate_message(message) is False


def test_missing_temperature():
    message = {
        "truck_id": 1,
        "timestamp": "2026-07-18T08:50:45.987061+00:00"
    }
    assert validate_message(message) is False


def test_missing_timestamp():
    message = {
        "truck_id": 1,
        "temperature": 35.5
    }
    assert validate_message(message) is False


def test_invalid_temperature_type():
    message = {
        "truck_id": 1,
        "temperature": "hot",
        "timestamp": "2026-07-18T08:50:45.987061+00:00"
    }
    assert validate_message(message) is False


def test_invalid_truck_id_type():
    message = {
        "truck_id": "one",
        "temperature": 35.5,
        "timestamp": "2026-07-18T08:50:45.987061+00:00"
    }
    assert validate_message(message) is False


def test_invalid_timestamp():
    message = {
        "truck_id": 1,
        "temperature": 35.5,
        "timestamp": "18/07/2026"
    }
    assert validate_message(message) is False


def test_temperature_out_of_range():
    message = {
        "truck_id": 1,
        "temperature": 100.0,
        "timestamp": "2026-07-18T08:50:45.987061+00:00"
    }
    assert validate_message(message) is False