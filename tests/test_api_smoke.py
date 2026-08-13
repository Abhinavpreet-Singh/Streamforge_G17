"""Smoke tests for API helpers — no Kafka/FastAPI server required."""

from src.api.stack_health import build_stack_status


def test_build_stack_status_shape():
    workers = [{"id": "stream-processor", "status": "stopped"}]
    status = build_stack_status(workers)

    assert "kafka" in status
    assert "schema_registry" in status
    assert "consumer_lag" in status
    assert status["workers"] == {"running": 0, "total": 1}
    assert "ready" in status
    assert status["consumer_lag"]["group"] == "streamforge"


def test_build_stack_status_counts_running_workers():
    workers = [
        {"id": "a", "status": "running"},
        {"id": "b", "status": "stopped"},
    ]
    status = build_stack_status(workers)
    assert status["workers"]["running"] == 1
    assert status["workers"]["total"] == 2
