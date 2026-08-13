# Frontend structure

How the React dashboard is organized.

## Folder layout

```
frontend/src/
├── App.jsx                 # Page switcher from sidebar
├── main.jsx
├── index.css
│
├── config/
│   └── navigation.js       # Sidebar items (all pages ready)
│
├── context/
│   ├── AppContext.js
│   └── AppProvider.jsx     # WebSocket + shared state
│
├── hooks/
│   └── useApp.js
│
├── lib/
│   ├── api.js
│   ├── format.js
│   ├── mapUtils.js         # Fallback simulated positions
│   └── observability.js    # Grafana / Prometheus URLs
│
├── components/
│   ├── layout/             # Shell, sidebar, header, PageLayout
│   ├── map/                # FleetMap
│   ├── pipeline/           # PipelineDAG
│   ├── chaos/              # ChaosPanel
│   ├── live/               # LiveFeed
│   ├── metrics/            # MetricsStatCards
│   ├── operations/         # StackStatusCards
│   ├── PipelineNode.jsx
│   └── ThroughputChart.jsx
│
└── pages/
    ├── Overview.jsx        # Chart + map + DAG + live feed
    ├── Fleet.jsx           # Full map + roster + truck detail
    ├── Pipeline.jsx        # DAG + /topology stage docs
    ├── Operations.jsx      # Stack health, chaos, lag, logs
    └── Metrics.jsx         # Stat cards + Grafana/Prom embeds
```

## Routing

No `react-router` — `activePage` in `App.jsx` swaps the page. Use `navigateTo('operations')` from `useApp()` for in-app CTAs.

## Shared data — `useApp()`

**Do not** open a second WebSocket. Available: `telemetry`, `workers`, `stackStatus`, `wsStatus`, `throughputHistory`, `animatedTrucks`, `handleWorkerAction`, `selectTruckOnMap`, `focusAnomaly`, `navigateTo`, etc.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

API must be on `:8000` (Vite proxies `/api`, `/ws`, `/grafana`, `/prometheus`).
