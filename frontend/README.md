# StreamForge Dashboard

**Owner:** Frontend/Dashboard Engineer · branch: `dev/frontend`

React + React Flow app visualizing the streaming DAG and live pipeline metrics.

## Scaffold

```bash
npx create-vite@latest . -- --template react
npm install reactflow
```

## Weeks

- **Week 1:** Scaffold the React Flow canvas (empty DAG).
- **Week 3:** Telemetry dashboard components — throughput, GPU/worker health-style live metrics per
  stream (poll or WebSocket from `dev/backend-api`'s `/ws/live`).
- **Week 4:** Wire in Prometheus-derived metrics via the backend API; polish UI.
- **Uniqueness (see root README §6):** a "digital fleet twin" map (Leaflet) showing live truck
  positions with a heat overlay for temperature anomalies, alongside the DAG view — and a
  chaos-engineering control panel to kill/revive a worker on demand.
