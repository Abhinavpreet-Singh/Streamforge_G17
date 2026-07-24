from __future__ import annotations

from collections import deque
from collections.abc import Iterable, Sequence
from datetime import datetime, timezone

from .models import NormalizedReading, TemperatureAggregate, TruckEvent, TruckWindowAverage, WindowType


class SeenReadings:
    """Bounded (truck_id, timestamp) set so a redelivered message — a Kafka
    producer retry, an at-least-once rebalance replay — is dropped instead
    of processed twice."""

    def __init__(self, max_size: int = 100_000) -> None:
        self._seen: set[tuple[int, str]] = set()
        self._order: deque[tuple[int, str]] = deque()
        self._max_size = max_size

    def is_duplicate(self, truck_id: int, timestamp: str) -> bool:
        key = (truck_id, timestamp)
        if key in self._seen:
            return True
        self._seen.add(key)
        self._order.append(key)
        if len(self._order) > self._max_size:
            oldest = self._order.popleft()
            self._seen.discard(oldest)
        return False


def passes_temperature_filter(temperature: float) -> bool:
    """Architecture spec: drop non-physical readings before windowing."""
    return temperature > 0


def parse_event_time(timestamp: str) -> datetime | None:
    try:
        event_time = datetime.fromisoformat(timestamp)
    except ValueError:
        return None
    if event_time.tzinfo is None:
        return event_time.replace(tzinfo=timezone.utc)
    return event_time


def normalize_event(event: TruckEvent) -> NormalizedReading | None:
    """Filter(temp > 0) → Map: parse time, round temperature, preserve key."""
    if not passes_temperature_filter(event.temperature):
        return None

    event_time = parse_event_time(event.timestamp)
    if event_time is None:
        return None

    return NormalizedReading(
        truck_id=event.truck_id,
        temperature_c=round(event.temperature, 2),
        event_time=event_time,
        timestamp=event.timestamp,
    )


def summarize_window(
    readings: Sequence[NormalizedReading | TemperatureAggregate],
) -> TemperatureAggregate:
    """Collapse a window's stored values into a single aggregate."""
    aggregate = TemperatureAggregate()
    for item in readings:
        if isinstance(item, NormalizedReading):
            aggregate = aggregate.add(item.temperature_c)
        elif isinstance(item, TemperatureAggregate):
            aggregate = aggregate.merge(item)
        elif isinstance(item, list):
            aggregate = aggregate.merge(summarize_window(item))
    return aggregate


def coerce_window_values(value: object) -> list[NormalizedReading | TemperatureAggregate]:
    """Normalize Faust's on_window_close payload into a flat sequence."""
    if value is None:
        return []
    if isinstance(value, list):
        return list(value)
    return [value]  # type: ignore[list-item]


def window_bounds_to_iso(bounds: tuple[object, object]) -> tuple[str, str]:
    start, end = bounds

    def _to_iso(ts: object) -> str:
        if isinstance(ts, datetime):
            return ts.astimezone(timezone.utc).isoformat()
        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        return str(ts)

    return _to_iso(start), _to_iso(end)


def build_window_average(
    *,
    truck_id: int,
    window_type: WindowType,
    window_bounds: tuple[object, object],
    aggregate: TemperatureAggregate,
    computed_at: datetime | None = None,
) -> TruckWindowAverage | None:
    if aggregate.count == 0:
        return None

    window_start, window_end = window_bounds_to_iso(window_bounds)
    now = computed_at or datetime.now(timezone.utc)

    return TruckWindowAverage(
        truck_id=truck_id,
        window_type=window_type.value,
        window_start=window_start,
        window_end=window_end,
        average_temperature=aggregate.average,
        reading_count=aggregate.count,
        computed_at=now.isoformat(),
    )


def expected_average(temperatures: Iterable[float]) -> float:
    """Offline validation helper: mean of a temperature series."""
    values = list(temperatures)
    if not values:
        raise ValueError("cannot compute average of empty series")
    return round(sum(values) / len(values), 4)
