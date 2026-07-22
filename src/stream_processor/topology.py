import logging
from collections import deque

import faust

from .config import (
    APP_ID,
    INPUT_TOPIC,
    KAFKA_BROKER,
)

from .models import TruckEvent

logger = logging.getLogger(__name__)

app = faust.App(
    APP_ID,
    broker=f"kafka://{KAFKA_BROKER}",
    value_serializer="json",
)

truck_topic = app.topic(
    INPUT_TOPIC,
    value_type=TruckEvent,
)


class SeenReadings:
    """Bounded (truck_id, timestamp) set so a redelivered message — a Kafka
    producer retry, an at-least-once rebalance replay — is dropped instead
    of processed twice. Composes with whatever windowing logic runs after
    it; this only guards against duplicate *ingestion*."""

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


seen_readings = SeenReadings()


@app.agent(truck_topic)
async def process_truck_events(events):
    async for event in events:
        if seen_readings.is_duplicate(event.truck_id, event.timestamp):
            logger.warning(
                "duplicate reading dropped: truck_id=%s timestamp=%s",
                event.truck_id,
                event.timestamp,
            )
            continue
        logger.info(
            "truck_id=%s temperature=%.2f timestamp=%s",
            event.truck_id,
            event.temperature,
            event.timestamp,
        )


if __name__ == "__main__":
    app.main()