import { useState, useEffect, useRef, useMemo } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import {
  Activity, Play, Square, AlertTriangle, Cpu, Terminal,
  MapPin, ShieldAlert, RefreshCw,
} from 'lucide-react';
import PipelineNode from './components/PipelineNode';
import ThroughputChart from './components/ThroughputChart';
import { apiUrl, wsLiveUrl } from './lib/api';
import { calculateCurrentPosition } from './lib/mapUtils';

const nodeTypes = { pipelineNode: PipelineNode };

function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

function roundValue(value, decimals = 2) {
  if (value === undefined || value === null) return 0;
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

function pushThroughputPoint(prev, ingestion, filtered) {
  const point = {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ingestion,
    filtered,
  };
  return [...prev, point].slice(-60);
}

export default function App() {
  const [wsStatus, setWsStatus] = useState('connecting');
  const [telemetry, setTelemetry] = useState({
    total_readings: 0,
    total_aggregates: 0,
    ingestion_rate: 0,
    filter_rate: 0,
    duplicate_drop_rate: 0,
    aggregate_rate: 0,
    kafka_connected: false,
    recent_readings: [],
    trucks: [],
    anomalies: [],
  });
  const [throughputHistory, setThroughputHistory] = useState([]);
  const [stackStatus, setStackStatus] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]);
  const [mapZoom, setMapZoom] = useState(4);
  const [actionLoading, setActionLoading] = useState({});
  const [systemTime, setSystemTime] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setSystemTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/status'));
        if (res.ok) setStackStatus(await res.json());
      } catch {
        setStackStatus(null);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const connect = () => {
      setWsStatus('connecting');
      const ws = new WebSocket(wsLiveUrl());
      socketRef.current = ws;

      ws.onopen = () => setWsStatus('connected');

      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === 'telemetry' || frame.type === 'init') {
            const data = frame.data;
            setTelemetry(data);
            setWorkers(frame.workers ?? []);
            setThroughputHistory((prev) =>
              pushThroughputPoint(prev, data.ingestion_rate ?? 0, data.filter_rate ?? 0)
            );
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        setTimeout(connect, 4000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => socketRef.current?.close();
  }, []);

  const handleWorkerAction = async (workerId, action) => {
    setActionLoading((prev) => ({ ...prev, [workerId]: true }));
    try {
      const response = await fetch(apiUrl(`/api/workers/${workerId}/${action}`), { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error('failed');
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? { ...w, status: action === 'start' ? 'running' : 'stopped', pid: action === 'start' ? w.pid : null }
            : w
        )
      );
    } catch {
      /* WS reconciles */
    } finally {
      setActionLoading((prev) => ({ ...prev, [workerId]: false }));
    }
  };

  const processorRunning = workers.some((w) => w.status === 'running');
  const ingestLive = telemetry.kafka_connected || telemetry.ingestion_rate > 0;
  const pipelineActive = processorRunning;
  const windowSec = stackStatus?.pipeline?.window_size_seconds ?? 300;
  const hopSec = stackStatus?.pipeline?.hopping_step_seconds ?? 60;
  const tumbleLabel = formatDuration(windowSec);
  const hopLabel = `${formatDuration(windowSec)} / ${formatDuration(hopSec)} step`;

  const nodes = useMemo(
    () => [
      {
        id: 'ingest', type: 'pipelineNode', position: { x: 50, y: 150 },
        data: {
          type: 'input', label: 'Kafka Telemetry Ingestion', status: ingestLive ? 'active' : 'crashed',
          metricName: 'Throughput', metricValue: `${telemetry.ingestion_rate} msg/s`,
          subMetricName: 'Topic', subMetricValue: 'truck-telemetry',
        },
      },
      {
        id: 'dedup', type: 'pipelineNode', position: { x: 300, y: 150 },
        data: {
          type: 'process', label: 'Deduplication', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Duplicate Drops', metricValue: `${telemetry.duplicate_drop_rate} msg/s`,
          subMetricName: 'Cache', subMetricValue: '100k cap',
        },
      },
      {
        id: 'filter', type: 'pipelineNode', position: { x: 550, y: 150 },
        data: {
          type: 'filter', label: 'Temp Filter (>0°C)', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Filtered', metricValue: `${telemetry.filter_rate} msg/s`,
          subMetricName: 'Logic', subMetricValue: 'temperature > 0',
        },
      },
      {
        id: 'map', type: 'pipelineNode', position: { x: 800, y: 150 },
        data: {
          type: 'process', label: 'Normalize', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Parsed', metricValue: `${Math.max(0, roundValue(telemetry.ingestion_rate - telemetry.filter_rate))} msg/s`,
          subMetricName: 'Schema', subMetricValue: 'NormalizedReading',
        },
      },
      {
        id: 'tumbling', type: 'pipelineNode', position: { x: 1080, y: 50 },
        data: {
          type: 'window', label: 'Tumbling Avg', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Window', metricValue: tumbleLabel,
          subMetricName: 'Table', subMetricValue: 'tumbling-temperature',
        },
      },
      {
        id: 'hopping', type: 'pipelineNode', position: { x: 1080, y: 250 },
        data: {
          type: 'window', label: 'Hopping Avg', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Window', metricValue: hopLabel,
          subMetricName: 'Table', subMetricValue: 'hopping-temperature',
        },
      },
      {
        id: 'state', type: 'pipelineNode', position: { x: 1360, y: 50 },
        data: {
          type: 'storage', label: 'Faust State Tables', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Backend', metricValue: 'In-memory + disk',
          subMetricName: 'Store', subMetricValue: `${stackStatus?.pipeline?.app_id ?? 'streamforge'}-dat`,
        },
      },
      {
        id: 'changelog', type: 'pipelineNode', position: { x: 1360, y: 250 },
        data: {
          type: 'storage', label: 'Changelog Recovery', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Topic', metricValue: 'truck-state-changelog',
          subMetricName: 'Demo', subMetricValue: 'chaos_recovery_demo',
        },
      },
      {
        id: 'sink', type: 'pipelineNode', position: { x: 1640, y: 150 },
        data: {
          type: 'output', label: 'Kafka Sink', status: pipelineActive ? 'active' : 'crashed',
          metricName: 'Egress', metricValue: `${telemetry.aggregate_rate} msg/s`,
          subMetricName: 'Emitted', subMetricValue: String(telemetry.total_aggregates ?? 0),
        },
      },
    ],
    [telemetry, pipelineActive, ingestLive, tumbleLabel, hopLabel, stackStatus]
  );

  const edges = useMemo(() => {
    const stroke = pipelineActive ? '#171717' : '#d4d4d4';
    const dash = pipelineActive ? '#10b981' : '#d4d4d4';
    const anim = pipelineActive;
    const ingestAnim = ingestLive;
    return [
      { id: 'e1', source: 'ingest', target: 'dedup', animated: ingestAnim, style: { stroke, strokeWidth: 2 } },
      { id: 'e2', source: 'dedup', target: 'filter', animated: anim, style: { stroke, strokeWidth: 2 } },
      { id: 'e3', source: 'filter', target: 'map', animated: anim, style: { stroke, strokeWidth: 2 } },
      { id: 'e4', source: 'map', target: 'tumbling', animated: anim, style: { stroke, strokeWidth: 2 } },
      { id: 'e5', source: 'map', target: 'hopping', animated: anim, style: { stroke, strokeWidth: 2 } },
      { id: 'e6', source: 'tumbling', target: 'state', animated: anim, style: { stroke: dash, strokeWidth: 2, strokeDasharray: '5,5' } },
      { id: 'e7', source: 'hopping', target: 'state', animated: anim, style: { stroke: dash, strokeWidth: 2, strokeDasharray: '5,5' } },
      { id: 'e9', source: 'tumbling', target: 'sink', animated: anim, style: { stroke, strokeWidth: 2 } },
      { id: 'e10', source: 'hopping', target: 'sink', animated: anim, style: { stroke, strokeWidth: 2 } },
    ];
  }, [pipelineActive, ingestLive]);

  const animatedTrucks = useMemo(
    () =>
      telemetry.trucks.map((truck) => ({
        ...truck,
        coords: calculateCurrentPosition(truck.truck_id, systemTime),
        isAnomalous: truck.last_temperature > 42,
      })),
    [telemetry.trucks, systemTime]
  );

  const selectTruckOnMap = (truck) => {
    setSelectedTruck(truck);
    setMapCenter(truck.coords);
    setMapZoom(6);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 overflow-hidden font-sans">
      <header className="flex flex-wrap justify-between items-center gap-3 px-6 py-3 bg-white border-b border-neutral-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 text-white rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900">StreamForge</h1>
            <p className="text-xs text-neutral-500 font-mono">Distributed Event Pipeline Console</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <span className="text-neutral-500">Readings: <b className="text-neutral-900">{telemetry.total_readings.toLocaleString()}</b></span>
          <span className="text-neutral-500">Anomalies: <b className="text-rose-600">{telemetry.anomalies.length}</b></span>
          <span className="text-neutral-500">Sink: <b className="text-neutral-900">{telemetry.aggregate_rate} msg/s</b></span>
          {['Kafka', 'Registry', 'Workers'].map((label, i) => {
            const ok =
              i === 0 ? stackStatus?.kafka?.status === 'ok'
              : i === 1 ? stackStatus?.schema_registry?.status === 'ok'
              : (stackStatus?.workers?.running ?? 0) > 0;
            return (
              <span key={label} className={`flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-neutral-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                {label}
              </span>
            );
          })}
          <span className={`flex items-center gap-1.5 font-bold ${wsStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}>
            <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
            {wsStatus.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <ThroughputChart history={throughputHistory} currentRate={telemetry.ingestion_rate} />
      </div>

      <main className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-[38%] border-r border-neutral-200 bg-white flex flex-col min-h-0">
          <div className="p-3 border-b border-neutral-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <div>
                <h2 className="text-sm font-semibold">Fleet Map</h2>
                <p className="text-[10px] text-neutral-400 font-mono">Simulated routes per truck ID</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setMapCenter([39.8283, -98.5795]); setMapZoom(4); }}
              className="text-[10px] font-mono px-2 py-1 bg-neutral-100 border border-neutral-200 rounded flex items-center gap-1"
            >
              <RefreshCw size={10} /> Reset
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <ChangeMapView center={mapCenter} zoom={mapZoom} />
              {animatedTrucks.map((truck) => {
                const sel = selectedTruck?.truck_id === truck.truck_id;
                return (
                  <CircleMarker
                    key={truck.truck_id}
                    center={truck.coords}
                    radius={sel ? 12 : truck.isAnomalous ? 10 : 6}
                    fillColor={truck.isAnomalous ? '#f43f5e' : '#10b981'}
                    color={sel ? '#2563eb' : truck.isAnomalous ? '#be123c' : '#047857'}
                    weight={sel ? 3 : 2}
                    fillOpacity={0.7}
                    eventHandlers={{ click: () => selectTruckOnMap(truck) }}
                  >
                    <Popup>
                      <div className="text-xs font-sans">
                        <b>Truck #{truck.truck_id}</b>
                        <div className="font-mono mt-1">{truck.last_temperature?.toFixed(2)} °C</div>
                        <div className="font-mono text-neutral-500">
                          Tumble: {truck.tumbling_avg != null ? truck.tumbling_avg.toFixed(2) : `pending (${tumbleLabel})`}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
          <div className="p-2 border-t text-[10px] font-mono text-neutral-500 flex justify-between">
            <span>Active trucks: {telemetry.trucks.length}</span>
            <span className="text-emerald-600">● healthy</span>
            <span className="text-rose-500">● anomaly &gt;42°C</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="h-[52%] border-b border-neutral-200 flex flex-col min-h-0">
            <div className="p-3 border-b border-neutral-100 flex items-center gap-2">
              <Cpu size={16} />
              <h2 className="text-sm font-semibold">Stream DAG</h2>
            </div>
            <div className="flex-1 min-h-0">
              <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.15}>
                <Background variant="dots" gap={16} size={1} color="#e5e5e5" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </div>

          <div className="flex-1 flex min-h-0">
            <div className="w-1/2 border-r border-neutral-200 p-4 overflow-y-auto bg-white">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-100">
                <ShieldAlert size={16} />
                <h3 className="text-xs font-semibold">Chaos Panel</h3>
              </div>
              {!processorRunning && workers.length > 0 && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded p-2 mb-3">
                  Start the stream processor, then run the producer. Averages appear after {tumbleLabel}.
                </p>
              )}
              {workers.length === 0 ? (
                <p className="text-xs text-neutral-400 font-mono">Start API on :8000</p>
              ) : (
                workers.map((worker) => {
                  const running = worker.status === 'running';
                  const loading = actionLoading[worker.id];
                  return (
                    <div key={worker.id} className="p-3 mb-3 border rounded-lg font-mono text-xs">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">{worker.label || worker.id}</span>
                        <span className={running ? 'text-emerald-600' : 'text-rose-600'}>{worker.status}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 mb-2">PID: {worker.pid || '—'}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={running || loading}
                          onClick={() => handleWorkerAction(worker.id, 'start')}
                          className="flex-1 py-1.5 bg-neutral-900 text-white rounded text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Play size={10} /> Start
                        </button>
                        <button
                          type="button"
                          disabled={!running || loading}
                          onClick={() => handleWorkerAction(worker.id, 'kill')}
                          className="flex-1 py-1.5 border border-rose-200 text-rose-700 rounded text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Square size={10} /> Crash
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="w-1/2 bg-neutral-900 text-neutral-300 p-4 flex flex-col font-mono text-[10px] min-h-0">
              <div className="flex items-center gap-2 mb-2 border-b border-neutral-800 pb-2 text-neutral-400">
                <Terminal size={12} />
                <span className="text-xs font-semibold">Live Feed</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {telemetry.anomalies.slice(0, 3).map((a, i) => (
                  <div key={i} className="text-rose-400 bg-rose-950/40 p-2 rounded flex gap-1">
                    <AlertTriangle size={12} />
                    <span>Truck #{a.truck_id} @ {a.temperature?.toFixed(1)}°C</span>
                  </div>
                ))}
                {telemetry.recent_readings.length === 0 ? (
                  <p className="text-neutral-600 italic text-center py-8">Waiting for Kafka…</p>
                ) : (
                  telemetry.recent_readings.map((msg, i) => (
                    <div key={i} className="text-neutral-400">
                      <span className="text-neutral-600">[{msg.timestamp?.split('T')[1]?.slice(0, 8)}]</span>
                      TRUCK-{msg.truck_id} temp={msg.temperature?.toFixed(2)}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
