import os

KAFKA_BROKER = os.getenv(
    "KAFKA_BROKER",
    "localhost:9092",
)

# App id doubles as the Kafka consumer group. Override it to run an isolated
# consumer (e.g. a demo that must replay a topic from the beginning without
# inheriting the main group's committed offsets).
APP_ID = os.getenv("APP_ID", "streamforge")

INPUT_TOPIC = "truck-telemetry"
OUTPUT_TOPIC = "truck-averages"

# 5-minute tumbling windows; hopping overlay advances every minute.
WINDOW_SIZE_SECONDS = int(os.getenv("WINDOW_SIZE_SECONDS", "300"))
HOPPING_STEP_SECONDS = int(os.getenv("HOPPING_STEP_SECONDS", "60"))
WINDOW_EXPIRES_SECONDS = int(os.getenv("WINDOW_EXPIRES_SECONDS", "600"))

TOPIC_PARTITIONS = int(os.getenv("TOPIC_PARTITIONS", "20"))