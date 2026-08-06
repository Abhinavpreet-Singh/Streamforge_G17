// Design tokens shared between JS (chart colors, canvas draws) and CSS (App.css uses the same hex values).
export const TOKENS = {
  bgApp: '#0A0E17', bgSidebar: '#0D1220', bgPanel: '#111726', bgPanelRaised: '#161D2E', bgInset: '#0B101C',
  line: '#1F273A', lineSoft: '#171E2E', text1: '#EDF0F7', text2: '#9AA5B8', text3: '#5C6579',
  cyan: '#38D6E0', blue: '#4C8DFF', green: '#22C55E', amber: '#F5A623', red: '#F05252', violet: '#8B7FE8',
};

// ---- API contract this frontend expects from the FastAPI backend -----------------------------
// GET  /health              liveness check
// GET  /topology             DAG shape: topic, stages, worker list, state store, changelog topic
// GET  /metrics              cluster-wide throughput, lag and latency percentiles
// WS   /ws/live               worker_status, rebalance and truck telemetry events
// GET  /workers               extension — [{ id, status, partitions[], lagMs, eventsPerSec, cpu, mem }]
// POST /workers/{id}/kill     extension — chaos-test trigger for a single worker
// GET  /fleet                 extension — [{ truck_id, lat, lon, tempF, lastSeen }]
export const DEFAULT_CONFIG = {
  apiBase: 'http://localhost:8000',
  wsUrl: 'ws://localhost:8000/ws/live',
  pollMs: 1400,
  workerCount: 20,
};

export const ENDPOINTS = [
  { verb: 'GET',  path: '/health',            desc: 'liveness check — used to detect when the FastAPI backend is reachable' },
  { verb: 'GET',  path: '/topology',          desc: 'DAG shape: topic, stages, worker list, state store, changelog topic' },
  { verb: 'GET',  path: '/metrics',           desc: 'cluster-wide throughput, lag and latency percentiles' },
  { verb: 'WS',   path: '/ws/live',           desc: 'pushes worker_status, rebalance and truck telemetry events as they happen' },
  { verb: 'GET',  path: '/workers',           desc: 'extension — [{ id, status, partitions[], lagMs, eventsPerSec, cpu, mem }]' },
  { verb: 'POST', path: '/workers/{id}/kill', desc: 'extension — chaos-test trigger for a single worker' },
  { verb: 'GET',  path: '/fleet',             desc: 'extension — [{ truck_id, lat, lon, tempF, lastSeen }] sampled from the digital twin' },
];

export function makeWorkers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `Worker-${String(i + 1).padStart(2, '0')}`,
    status: 'healthy',
    partitions: [i % 32],
    eventsPerSec: 4900 + Math.random() * 500,
    lagMs: 8 + Math.random() * 8,
    cpu: 18 + Math.random() * 12,
    mem: 40 + Math.random() * 14,
    uptimeMin: 2 * 24 * 60 + 14 * 60 + 32 - i,
    lastHeartbeat: Date.now(),
    recoverAt: null,
  }));
}

const HUBS = [
  { x: 0.18, y: 0.28 }, { x: 0.36, y: 0.62 }, { x: 0.55, y: 0.22 }, { x: 0.68, y: 0.55 },
  { x: 0.82, y: 0.32 }, { x: 0.28, y: 0.8 }, { x: 0.6, y: 0.78 },
];
export function makeTrucks(count) {
  return Array.from({ length: count }, (_, i) => {
    const hub = HUBS[i % HUBS.length];
    return {
      id: 30000 + Math.floor(Math.random() * 20000),
      x: Math.min(0.97, Math.max(0.03, hub.x + (Math.random() - 0.5) * 0.3)),
      y: Math.min(0.94, Math.max(0.06, hub.y + (Math.random() - 0.5) * 0.3)),
      temp: 34 + Math.random() * 4,
      breach: false,
      breachTicks: 0,
    };
  });
}

export function computePartitions(workers) {
  const n = workers.length;
  const assignedN = Math.round(32 * 0.75);
  const standbyN = Math.round(32 * 0.19);
  const parts = [];
  for (let i = 0; i < 32; i++) {
    if (i < assignedN) {
      const owner = workers[i % n];
      parts.push({ id: i, role: 'assigned', owner: owner.id, replica: workers[(i + Math.floor(n / 2)) % n].id, ownerRef: owner });
    } else if (i < assignedN + standbyN) {
      parts.push({ id: i, role: 'standby', owner: null, replica: workers[(i + 3) % n].id, ownerRef: null });
    } else {
      parts.push({ id: i, role: 'unassigned', owner: null, replica: null, ownerRef: null });
    }
  }
  return parts;
}

export const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : Math.round(n).toString());
export const timeStr = (d) => d.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
export const fmtUptime = (min) => {
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = Math.floor(min % 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};
export const statusLabel = (s) => (s === 'failed' ? 'Failed' : s === 'rebalanced' ? 'Rebalanced' : 'Healthy');
export const statusColor = (s) => (s === 'failed' ? TOKENS.red : s === 'rebalanced' ? TOKENS.amber : TOKENS.green);
