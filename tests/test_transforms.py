from datetime import datetime, timezone

import pytest

from src.stream_processor.models import (
    NormalizedReading,
    TemperatureAggregate,
    TruckEvent,
    WindowType,
)
from src.stream_processor.transforms import (
    build_window_average,
    coerce_window_values,
    expected_average,
    normalize_event,
    parse_event_time,
    passes_temperature_filter,
    summarize_window,
)


def _event(truck_id: int = 1, temperature: float = 35.5, timestamp: str = "2026-07-18T08:50:45+00:00"):
    return TruckEvent(truck_id=truck_id, temperature=temperature, timestamp=timestamp)


def test_passes_temperature_filter():
    assert passes_temperature_filter(0.1) is True
    assert passes_temperature_filter(0.0) is False
    assert passes_temperature_filter(-5.0) is False


def test_normalize_event_filters_non_positive_temperature():
    assert normalize_event(_event(temperature=0.0)) is None
    assert normalize_event(_event(temperature=-1.0)) is None


def test_normalize_event_maps_valid_reading():
    reading = normalize_event(_event(temperature=36.789))
    assert reading is not None
    assert reading.truck_id == 1
    assert reading.temperature_c == 36.79
    assert reading.event_time == datetime(2026, 7, 18, 8, 50, 45, tzinfo=timezone.utc)
    assert reading.timestamp == "2026-07-18T08:50:45+00:00"


def test_normalize_event_rejects_bad_timestamp():
    assert normalize_event(_event(timestamp="not-a-timestamp")) is None


def test_parse_event_time_assumes_utc_when_naive():
    parsed = parse_event_time("2026-07-18T08:50:45")
    assert parsed == datetime(2026, 7, 18, 8, 50, 45, tzinfo=timezone.utc)


def test_summarize_window_from_readings():
    readings = [
        NormalizedReading(
            truck_id=1,
            temperature_c=30.0,
            event_time=datetime(2026, 1, 1, tzinfo=timezone.utc),
            timestamp="2026-01-01T00:00:00+00:00",
        ),
        NormalizedReading(
            truck_id=1,
            temperature_c=40.0,
            event_time=datetime(2026, 1, 1, tzinfo=timezone.utc),
            timestamp="2026-01-01T00:00:10+00:00",
        ),
    ]
    aggregate = summarize_window(readings)
    assert aggregate.count == 2
    assert aggregate.average == 35.0


def test_summarize_window_merges_nested_lists():
    inner = TemperatureAggregate(sum=50.0, count=2)
    aggregate = summarize_window([inner, TemperatureAggregate(sum=30.0, count=1)])
    assert aggregate.count == 3
    assert aggregate.average == pytest.approx(26.6667, rel=1e-3)


def test_build_window_average_skips_empty_windows():
    assert (
        build_window_average(
            truck_id=7,
            window_type=WindowType.TUMBLING,
            window_bounds=(1700000000.0, 1700000300.0),
            aggregate=TemperatureAggregate(),
        )
        is None
    )


def test_build_window_average_emits_payload():
    result = build_window_average(
        truck_id=7,
        window_type=WindowType.HOPPING,
        window_bounds=(1700000000.0, 1700000300.0),
        aggregate=TemperatureAggregate(sum=105.0, count=3),
        computed_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
    )
    assert result is not None
    assert result.truck_id == 7
    assert result.window_type == "hopping"
    assert result.average_temperature == 35.0
    assert result.reading_count == 3
    assert result.window_start.endswith("+00:00")
    assert result.computed_at == "2026-01-01T12:00:00+00:00"


def test_coerce_window_values_handles_none_and_singleton():
    assert coerce_window_values(None) == []
    agg = TemperatureAggregate(sum=10.0, count=1)
    assert coerce_window_values(agg) == [agg]


def test_expected_average_matches_manual_mean():
    assert expected_average([32.0, 34.0, 36.0]) == 34.0


def test_expected_average_rejects_empty_series():
    with pytest.raises(ValueError):
        expected_average([])
