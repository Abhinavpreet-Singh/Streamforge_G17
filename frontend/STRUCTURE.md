# Frontend structure

How the React dashboard is organized so multiple people can work without conflicts.

## Folder layout

```
frontend/src/
├── App.jsx                 # Router: picks active page from sidebar
├── main.jsx
├── index.css
│
├── config/
│   └── navigation.js       # Sidebar items and labels
│
├── context/
│   ├── AppContext.js       # React context object
│   └── AppProvider.jsx     # WebSocket + shared state provider
│
├── hooks/
│   └── useApp.js           # useApp() — live data in any page
│
├── lib/
│   ├── api.js              # API + WebSocket URLs
│   ├── format.js           # Small helpers (duration, rates)
│   └── mapUtils.js         # Simulated truck positions
│
├── components/
│   ├── layout/             # Shell, sidebar, header, placeholders
│   ├── map/                # FleetMap (reusable)
│   ├── pipeline/           # PipelineDAG (reusable)
│   ├── chaos/              # ChaosPanel (reusable)
│   ├── live/               # LiveFeed (reusable)
│   ├── PipelineNode.jsx    # React Flow node
│   └── ThroughputChart.jsx
│
└── pages/                  # One file per sidebar section
    ├── Overview.jsx        # ✅ Done — original dashboard
    ├── Fleet.jsx           # placeholder
    ├── Pipeline.jsx        # placeholder
    ├── Operations.jsx      # placeholder
    └── Metrics.jsx         # placeholder
```

## How routing works

No `react-router` yet — keeps things simple.

1. User clicks sidebar → `activePage` state changes in `App.jsx`
2. `App.jsx` renders the matching page from `pages/`
3. Header + sidebar stay mounted; only the main area swaps

To add a new section: edit `config/navigation.js` + create `pages/YourPage.jsx` + register in `App.jsx`.

## Shared data — `useApp()`

All pages get live Kafka data through context:

```jsx
import { useApp } from '../hooks/useApp';

export default function Operations() {
  const { telemetry, workers, stackStatus, handleWorkerAction } = useApp();
  // build your UI here
}
```

Available fields: `telemetry`, `workers`, `stackStatus`, `wsStatus`, `throughputHistory`, `animatedTrucks`, `handleWorkerAction`, `selectTruckOnMap`, etc.

**Do not** open a second WebSocket in page components — use context only.

## Page assignments

| Page | Person | Branch | File |
|------|--------|--------|------|
| Overview | Done (lead) | — | `pages/Overview.jsx` |
| Fleet | **Noore Simin** | `Noore` | `pages/Fleet.jsx` |
| Pipeline | **Noore Simin** | `Noore` | `pages/Pipeline.jsx` |
| Operations | **Shifana** | `shifana` | `pages/Operations.jsx` |
| Metrics | **Surya** | `Surya` | `pages/Metrics.jsx` |

### Noore Simin — Fleet (`pages/Fleet.jsx`)

Full-screen fleet view. Reuse `components/map/FleetMap.jsx`.

- [ ] Map takes most of the page (not split with DAG)
- [ ] Truck list/table on the right — ID, temp, tumbling avg, hopping avg, status
- [ ] Click row or map marker → highlight truck + show detail card
- [ ] Click anomaly (from `telemetry.anomalies`) → jump to that truck on map
- [ ] Empty state when processor is stopped (“Start stream processor first”)

Data: `useApp()` → `animatedTrucks`, `telemetry`, `selectTruckOnMap`, `selectedTruck`

### Noore Simin — Pipeline (`pages/Pipeline.jsx`)

Full-screen topology view. Reuse `components/pipeline/PipelineDAG.jsx`.

- [ ] DAG fills the page with more zoom room
- [ ] Side panel: fetch `GET /topology` and show each stage name + description
- [ ] Show window sizes from `stackStatus.pipeline` (tumbling / hopping labels)
- [ ] Stage status colors follow `pipelineActive` from context

Data: `useApp()` + `fetch(apiUrl('/topology'))`

### Shifana — Operations (`pages/Operations.jsx`)

Control room for workers and stack health. Reuse `components/chaos/ChaosPanel.jsx`.

**Frontend (this page):**

- [ ] Move chaos panel here (full width) — worker Start / Crash
- [ ] Stack status cards: Kafka, Schema Registry, workers running (from `stackStatus`)
- [ ] Show consumer lag when API exposes it (placeholder cards until backend lands)
- [ ] Log viewer area — last N lines from worker log endpoint (when ready)
- [ ] Short “how to run chaos demo” steps at the top

**Backend (same PR or separate):**

- [ ] Add consumer lag to `GET /api/status`
- [ ] Optional: `GET /api/workers/stream-processor/logs?tail=50`

Data: `useApp()` → `workers`, `stackStatus`, `handleWorkerAction`

### Surya — Metrics (`pages/Metrics.jsx`)

Observability summary — no need to rebuild Grafana.

- [ ] Stat cards: ingestion rate, sink rate, active trucks, anomalies (from `telemetry` / `useApp()`)
- [ ] Big buttons: open Grafana dashboard, Prometheus targets (same URLs as header)
- [ ] Optional: fetch `/metrics` and show raw counter values in a monospace block
- [ ] Link to `docs/CHAOS_RUNBOOK.md` once written
- [ ] “Last updated” timestamp (poll every 10s)

Data: `useApp()` + optional `fetch(apiUrl('/metrics'))` as text

## Page status

| Page | Status | Reuse from Overview |
|------|--------|---------------------|
| Overview | Done | — |
| Fleet | Placeholder | `FleetMap` |
| Pipeline | Placeholder | `PipelineDAG`, `/topology` |
| Operations | Placeholder | `ChaosPanel`, stack status |
| Metrics | Placeholder | Grafana / Prometheus links |

## Run locally

```bash
cd frontend
npm install
npm run dev
```

API must be on `:8000` (Vite proxies `/api` and `/ws`).

## Tips for contributors

1. Work in **your page file** first — avoid editing `AppContext` unless you need new shared state
2. Reuse components from `components/map`, `pipeline`, `chaos`, `live` instead of copying JSX
3. Match existing Tailwind patterns (neutral palette, `font-mono` for data)
4. Run `npm run lint` and `npm run build` before opening a PR
