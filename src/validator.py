from datetime import datetime


def validate_message(message):
    # Check required fields
    required_fields = ["truck_id", "temperature", "timestamp"]
    for field in required_fields:
        if field not in message:
            return False

    # Check data types
    if not isinstance(message["truck_id"], int):
        return False

    if not isinstance(message["temperature"], (int, float)):
        return False

    if not isinstance(message["timestamp"], str):
        return False

    # Check temperature range
    if not (-20 <= message["temperature"] <= 60):
        return False

    # Check timestamp format
    try:
        datetime.fromisoformat(message["timestamp"])
    except ValueError:
        return False

    return True