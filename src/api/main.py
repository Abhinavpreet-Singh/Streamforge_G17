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

app = FastAPI(title="StreamForge Topology API")


@app.get("/health")
def health():
    return {"status": "ok"}
