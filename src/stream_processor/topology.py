import faust

from .config import (
    APP_ID,
    INPUT_TOPIC,
    KAFKA_BROKER,
)

from .models import TruckEvent


app = faust.App(
    APP_ID,
    broker=f"kafka://{KAFKA_BROKER}",
    value_serializer="json",
)

truck_topic = app.topic(
    INPUT_TOPIC,
    value_type=TruckEvent,
)