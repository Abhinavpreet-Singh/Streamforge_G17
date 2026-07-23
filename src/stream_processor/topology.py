"""
Week 2 — Stream Processing (Owner: Stream Processing Engineer, branch: Meven)

Faust topology:
  Consume → Dedup → Filter(temp > 0) → Map → Tumbling + Hopping windows
  → emit per-truck averages to `truck-averages`.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import faust

from .config import (
    APP_ID,
    HOPPING_STEP_SECONDS,
    INPUT_TOPIC,
    KAFKA_BROKER,
    OUTPUT_TOPIC,
    TOPIC_PARTITIONS,
    WINDOW_EXPIRES_SECONDS,
    WINDOW_SIZE_SECONDS,
)
from .models import (
    NormalizedReading,
    TemperatureAggregate,
    TruckEvent,
    TruckWindowAverage,
    WindowType,
)
from .transforms import (
    SeenReadings,
    build_window_average,
    coerce_window_values,
    normalize_event,
    summarize_window,
)

logger = logging.getLogger(__name__)

app = faust.App(
    APP_ID,
    broker=f"kafka://{KAFKA_BROKER}",
    value_serializer="json",
    topic_partitions=TOPIC_PARTITIONS,
)

app.conf.table_cleanup_interval = 5.0

truck_topic = app.topic(
    INPUT_TOPIC,
    value_type=TruckEvent,
)

averages_topic = app.topic(
    OUTPUT_TOPIC,
    value_type=TruckWindowAverage,
)

seen_readings = SeenReadings()

WINDOW_SIZE = timedelta(seconds=WINDOW_SIZE_SECONDS)
WINDOW_EXPIRES = timedelta(seconds=WINDOW_EXPIRES_SECONDS)
HOPPING_STEP = timedelta(seconds=HOPPING_STEP_SECONDS)


def _make_window_close_handler(window_type: WindowType):
    async def on_close(key: tuple[Any, tuple[Any, Any]], value: object) -> None:
        truck_id = key[0]
        window_bounds = key[1]
        aggregate = summarize_window(coerce_window_values(value))
        result = build_window_average(
            truck_id=truck_id,
            window_type=window_type,
            window_bounds=window_bounds,
            aggregate=aggregate,
        )
        if result is None:
            return

        await averages_topic.send(
            key=str(truck_id),
            value=result,
        )
        logger.info(
            "%s window closed: truck_id=%s avg=%.2f count=%d [%s → %s]",
            window_type.value,
            truck_id,
            result.average_temperature,
            result.reading_count,
            result.window_start,
            result.window_end,
        )

    return on_close


tumbling_table = (
    app.Table(
        "tumbling-temperature",
        default=TemperatureAggregate,
        partitions=TOPIC_PARTITIONS,
        on_window_close=_make_window_close_handler(WindowType.TUMBLING),
    )
    .tumbling(WINDOW_SIZE, expires=WINDOW_EXPIRES)
    .relative_to_field(NormalizedReading.event_time)
)

hopping_table = (
    app.Table(
        "hopping-temperature",
        default=TemperatureAggregate,
        partitions=TOPIC_PARTITIONS,
        on_window_close=_make_window_close_handler(WindowType.HOPPING),
    )
    .hopping(WINDOW_SIZE, HOPPING_STEP, expires=WINDOW_EXPIRES)
    .relative_to_field(NormalizedReading.event_time)
)


@app.agent(truck_topic)
async def ingest(events):
    """Stage 1: consume + deduplicate at-least-once replays."""
    async for event in events:
        if seen_readings.is_duplicate(event.truck_id, event.timestamp):
            logger.warning(
                "duplicate reading dropped: truck_id=%s timestamp=%s",
                event.truck_id,
                event.timestamp,
            )
            continue
        yield event


@app.agent(ingest)
async def filter_and_map(events):
    """Stage 2: Filter(temp > 0) → Map to NormalizedReading."""
    async for event in events:
        reading = normalize_event(event)
        if reading is None:
            logger.debug(
                "reading filtered: truck_id=%s temperature=%.2f",
                event.truck_id,
                event.temperature,
            )
            continue
        yield reading


@app.agent(filter_and_map)
async def aggregate_tumbling(readings):
    """Stage 3a: 5-minute tumbling windows per truck_id."""
    async for reading in readings:
        current = tumbling_table[reading.truck_id].value() or TemperatureAggregate()
        tumbling_table[reading.truck_id] = current.add(reading.temperature_c)


@app.agent(filter_and_map)
async def aggregate_hopping(readings):
    """Stage 3b: 5-minute hopping windows (1-minute step) per truck_id."""
    async for reading in readings:
        current = hopping_table[reading.truck_id].value() or TemperatureAggregate()
        hopping_table[reading.truck_id] = current.add(reading.temperature_c)


if __name__ == "__main__":
    app.main()
