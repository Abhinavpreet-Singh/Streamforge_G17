"""
Weeks 1-4 — Backend API & Observability (Owner: Backend/API Engineer,
branch: dev/backend-api)

FastAPI service exposing:
  - Kafka partition / worker-node health (topology monitor)
  - Prometheus metrics scrape endpoint
  - WebSocket feed for the React Flow dashboard

TODO:
- [ ] Week 1: scaffold FastAPI app + /health (done below)
- [ ] Week 4: /metrics (prometheus_client), /topology, /ws/live
"""

from fastapi import FastAPI
from prometheus_client import Counter, generate_latest
from fastapi.responses import Response
from confluent_kafka.admin import AdminClient

app = FastAPI(title="StreamForge Topology API")

admin = AdminClient({
    "bootstrap.servers": "localhost:9092"
})
#Counter for health endpoint hits
health_counter = Counter(
    "health_requests_total",
    "Total number of requests to /health"
)


@app.get("/health")
def health():
    health_counter.inc()
    return {"status": "ok"}

@app.get("/metrics")
def metrics():
    return Response(
        content=generate_latest(),
        media_type="text/plain"
    )
@app.get("/topology")
def topology():
    tumble_label = f"Tumbling Aggregate ({WINDOW_SIZE_SECONDS}s)"
    hop_label = f"Hopping Aggregate ({WINDOW_SIZE_SECONDS}s / {HOPPING_STEP_SECONDS}s)"
    return {
        "status": "active",
        "pipeline": {
            "app_id": APP_ID,
            "window_size_seconds": WINDOW_SIZE_SECONDS,
            "hopping_step_seconds": HOPPING_STEP_SECONDS,
        },
        "dag": {
            "nodes": [
                {"id": "ingest", "label": "Kafka Ingest (truck-telemetry)", "type": "input"},
                {"id": "dedup", "label": "Deduplication", "type": "process"},
                {"id": "filter", "label": "Temperature Filter (>0°C)", "type": "process"},
                {"id": "map", "label": "Normalize Event", "type": "process"},
                {"id": "tumbling", "label": tumble_label, "type": "window"},
                {"id": "hopping", "label": hop_label, "type": "window"},
                {"id": "state", "label": "Faust State Tables", "type": "storage"},
                {"id": "changelog", "label": "Changelog (recovery demos)", "type": "storage"},
                {"id": "sink", "label": "Kafka Output (truck-averages)", "type": "output"},
            ],
            "edges": [
                {"source": "ingest", "target": "dedup"},
                {"source": "dedup", "target": "filter"},
                {"source": "filter", "target": "map"},
                {"source": "map", "target": "tumbling"},
                {"source": "map", "target": "hopping"},
                {"source": "tumbling", "target": "state"},
                {"source": "hopping", "target": "state"},
                {"source": "tumbling", "target": "sink"},
                {"source": "hopping", "target": "sink"},
            ],
        },
    }

@app.get("/api/status")
def api_status():
    workers = worker_manager.get_status()
    stack = build_stack_status(workers)
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "kafka_consumer": "connected" if state.kafka_connected else "disconnected",
        "pipeline": {
            "app_id": APP_ID,
            "window_size_seconds": WINDOW_SIZE_SECONDS,
            "hopping_step_seconds": HOPPING_STEP_SECONDS,
            "demo_mode": os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes"),
        },
        **stack,
    }

@app.get("/api/workers")
def get_workers():
    return worker_manager.get_status()

        telemetry_topic = metadata.topics.get("truck-telemetry")
        averages_topic = metadata.topics.get("truck-averages")

        telemetry_partitions = len(telemetry_topic.partitions) if telemetry_topic else 0
        averages_partitions = len(averages_topic.partitions) if averages_topic else 0

    except Exception:
        kafka_status = "disconnected"

    return {
        "status": "running",
        "kafka": kafka_status,
        "topics": {
            "truck-telemetry": {
                "partitions": telemetry_partitions
    },
             "truck-averages": {
                 "partitions": averages_partitions
    }
},
"workers": [
       {
           "id": "worker-1",
           "status": "healthy",
       }, 
       {
            "id": "worker-2",
            "status": "healthy",
       }    
    ],
    "total_workers": 2
 }
