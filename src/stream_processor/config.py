import os

KAFKA_BROKER = os.getenv(
    "KAFKA_BROKER",
    "localhost:9092"
)

APP_ID = "streamforge"

INPUT_TOPIC = "truck-events"

