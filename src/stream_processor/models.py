import faust


class TruckEvent(
    faust.Record,
    serializer="json"
):
    
    truck_id: int
    temperature: float
    timestamp: str