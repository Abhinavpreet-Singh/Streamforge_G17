from src.stream_processor.topology import SeenReadings


def test_first_reading_is_not_duplicate():
    seen = SeenReadings()
    assert seen.is_duplicate(1, "2026-01-01T00:00:00") is False


def test_repeated_reading_is_duplicate():
    seen = SeenReadings()
    seen.is_duplicate(1, "2026-01-01T00:00:00")
    assert seen.is_duplicate(1, "2026-01-01T00:00:00") is True


def test_different_truck_or_timestamp_is_not_duplicate():
    seen = SeenReadings()
    seen.is_duplicate(1, "t1")
    assert seen.is_duplicate(2, "t1") is False
    assert seen.is_duplicate(1, "t2") is False


def test_memory_is_bounded():
    seen = SeenReadings(max_size=3)
    for i in range(10):
        seen.is_duplicate(i, "t")
    assert len(seen._seen) <= 3
    # the most recent key is still tracked
    assert seen.is_duplicate(9, "t") is True
