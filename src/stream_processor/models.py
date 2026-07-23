from __future__ import annotations

from datetime import datetime
from enum import Enum

import faust


class TruckEvent(
    faust.Record,
    serializer="json",
):
    # Matches the producer's wire format (src/producer/truck_producer.py) —
    # truck_id is an int key, timestamp is an ISO-8601 UTC string.
    truck_id: int
    temperature: float
    timestamp: str


class NormalizedReading(
    faust.Record,
    serializer="json",
):
    """Mapped event ready for windowed aggregation.

    `event_time` drives Faust's `.relative_to_field()` windowing so windows
    align to telemetry timestamps, not wall-clock skew on the worker.
    """

    truck_id: int
    temperature_c: float
    event_time: datetime
    timestamp: str


class TemperatureAggregate(
    faust.Record,
    serializer="json",
):
    """Incremental (sum, count) state for O(1) per-reading updates."""

    sum: float = 0.0
    count: int = 0

    def add(self, temperature: float) -> TemperatureAggregate:
        return TemperatureAggregate(
            sum=self.sum + temperature,
            count=self.count + 1,
        )

    def merge(self, other: TemperatureAggregate) -> TemperatureAggregate:
        return TemperatureAggregate(
            sum=self.sum + other.sum,
            count=self.count + other.count,
        )

    @property
    def average(self) -> float:
        if self.count == 0:
            return 0.0
        return round(self.sum / self.count, 4)


class WindowType(str, Enum):
    TUMBLING = "tumbling"
    HOPPING = "hopping"


class TruckWindowAverage(
    faust.Record,
    serializer="json",
):
    """Emitted to `truck-averages` when a window closes."""

    truck_id: int
    window_type: str
    window_start: str
    window_end: str
    average_temperature: float
    reading_count: int
    computed_at: str
