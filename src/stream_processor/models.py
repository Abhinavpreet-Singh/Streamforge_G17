import faust


class TruckEvent(
    faust.Record,
    serializer="json"
):
    truck_id: int
    temperature: float
    timestamp: str


class TruckAverage(
    faust.Record,
    serializer="json"
):
    truck_id: int
    window_start: str
    window_end: str
    avg_temperature: float
    sample_count: int