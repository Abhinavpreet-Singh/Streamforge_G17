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

## Page ownership

| Page | Status | Reuse from Overview |
|------|--------|---------------------|
| Overview | Done | — |
| Fleet | Placeholder | `FleetMap`, truck list new |
| Pipeline | Placeholder | `PipelineDAG`, fetch `/topology` |
| Operations | Placeholder | `ChaosPanel`, stack status, lag |
| Metrics | Placeholder | Grafana links, `/metrics` cards |

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
