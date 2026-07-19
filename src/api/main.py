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

app = FastAPI(title="StreamForge Topology API")
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
