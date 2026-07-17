import faust


class TruckEvent(
    faust.Record,
    serializer="json"
):
    truck_id: str
    temperature: float
    timestamp: int