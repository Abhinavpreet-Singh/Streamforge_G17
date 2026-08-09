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

_DEMO = os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes")

# Default: 5-minute tumbling / 1-minute hop. DEMO_MODE shortens windows for live demos.
WINDOW_SIZE_SECONDS = int(
    os.getenv("WINDOW_SIZE_SECONDS", "30" if _DEMO else "300")
)
HOPPING_STEP_SECONDS = int(
    os.getenv("HOPPING_STEP_SECONDS", "10" if _DEMO else "60")
)
WINDOW_EXPIRES_SECONDS = int(
    os.getenv("WINDOW_EXPIRES_SECONDS", "120" if _DEMO else "600")
)

TOPIC_PARTITIONS = int(os.getenv("TOPIC_PARTITIONS", "20"))