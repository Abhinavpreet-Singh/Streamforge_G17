# StreamForge — Cluster Console (React)

A React + Vite frontend for the StreamForge distributed stream processor: a live
Overview dashboard, a Topology page rendered with **reactflow**, a "Digital Fleet
Twin" map of the simulated truck fleet, plus Workers / Partitions / Metrics /
Events / Alerts / Settings pages.

Everything runs on a local demo-data simulation out of the box — no backend
required to see it working. Point it at your FastAPI backend from the
**Settings** page once it's built (see the API contract below).

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Build for production

```bash
npm run build
```

Output goes to `dist/`.

## Project structure

```
index.html               Vite entry point
src/
  main.jsx                React root
  App.jsx                 Page routing, simulation state, all page content
  App.css                 All component styling (design tokens as CSS variables)
  index.css               Global reset + font loading
  lib/
    simulation.js          Demo-data generators, formatters, API contract constants
  components/
    Sidebar.jsx            Left nav + cluster status card
    TopologyDag.jsx         Full DAG view, built with the `reactflow` library
    FleetMap.jsx            Canvas-based digital twin of the truck fleet
```

## API contract expected by this frontend

This matches the architecture: `truck_producer.py → Kafka (Avro, Schema
Registry) → Faust/Bytewax workers → RocksDB + changelog topic → FastAPI →
this dashboard`.

| Method | Path                  | Purpose                                                              |
|--------|-----------------------|-----------------------------------------------------------------------|
| GET    | `/health`              | liveness check — used to detect the backend is reachable             |
| GET    | `/topology`            | DAG shape: topic, stages, worker list, state store, changelog topic   |
| GET    | `/metrics`             | cluster-wide throughput, lag and latency percentiles                  |
| WS     | `/ws/live`             | pushes worker_status, rebalance and truck-telemetry events            |
| GET    | `/workers`             | extension — `[{ id, status, partitions[], lagMs, eventsPerSec, cpu, mem }]` |
| POST   | `/workers/{id}/kill`   | extension — chaos-test trigger for a single worker                    |
| GET    | `/fleet`               | extension — `[{ truck_id, lat, lon, tempF, lastSeen }]`               |

The `/workers`, `/kill`, and `/fleet` endpoints are extensions this dashboard
needs for per-node drill-down and chaos testing that aren't in the core
architecture diagram — build them alongside the core four when you're ready
to wire up live data. Until then, everything runs on local simulation.

## Notes

- Settings page lets you live-adjust worker count, poll interval, and lag /
  temperature thresholds — all of it re-renders instantly across every page.
- The Fleet Map is an abstract "digital twin" canvas (not a geographic map).
  If you want real lat/lon on map tiles, wire in a mapping library such as
  `react-leaflet` or `react-map-gl` inside `FleetMap.jsx`.
- Charts use `recharts`, icons use `lucide-react`, topology uses `reactflow`.
