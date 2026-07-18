import logging

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


@app.agent(truck_topic)
async def process_truck_events(events):
    async for event in events:
        logger.info(
            "truck_id=%s temperature=%.2f timestamp=%s",
            event.truck_id,
            event.temperature,
            event.timestamp,
        )


if __name__ == "__main__":
    app.main()