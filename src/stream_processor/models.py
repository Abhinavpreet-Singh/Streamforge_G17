import faust


class TruckEvent(
    faust.Record,
    serializer="json"
):
    # Matches the producer's wire format (src/producer/truck_producer.py) —
    # truck_id is an int key, timestamp is an ISO-8601 UTC string.
    truck_id: int
    temperature: float
    timestamp: str