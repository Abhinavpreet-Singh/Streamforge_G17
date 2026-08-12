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
from src.api.stack_health import build_stack_status


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
    try:
        metadata = admin.list_topics(timeout=5)

        kafka_status = "connected"

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
@app.get("/api/status")
def api_status():
    workers = [
        {"id": "worker-1", "status": "running"},
        {"id": "worker-2", "status": "running"},
    ]

    return build_stack_status(workers) 
