import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { 
  Activity, Play, Square, AlertTriangle, Cpu, HardDrive, Terminal, 
  MapPin, CheckCircle2, ShieldAlert, ArrowRightLeft, RefreshCw 
} from 'lucide-react';
import PipelineNode from './components/PipelineNode';

// Set custom React Flow node types
const nodeTypes = {
  pipelineNode: PipelineNode,
};

// Deterministic baseline coordinate paths for 500 trucks inside USA
// Maps truck ID to a US city coordinate baseline with minor motion simulation
function getTruckRoute(truckId) {
  const seed = (truckId * 12345.67) % 1;
  // Box limits: USA
  const baselines = [
    { lat: 40.7128, lng: -74.0060, name: "New York" },
    { lat: 34.0522, lng: -118.2437, name: "Los Angeles" },
    { lat: 41.8781, lng: -87.6298, name: "Chicago" },
    { lat: 29.7604, lng: -95.3698, name: "Houston" },
    { lat: 39.7392, lng: -104.9903, name: "Denver" },
    { lat: 47.6062, lng: -122.3321, name: "Seattle" },
    { lat: 25.7617, lng: -80.1918, name: "Miami" },
    { lat: 32.7767, lng: -96.7970, name: "Dallas" },
  ];
  
  const startCity = baselines[Math.floor(seed * baselines.length)];
  const endCity = baselines[(Math.floor(seed * baselines.length) + 1) % baselines.length];
  
  return { startCity, endCity, seed };
}

function calculateCurrentPosition(truckId, timeSecs) {
  const { startCity, endCity, seed } = getTruckRoute(truckId);
  // Speed offset
  const speed = 0.005 + (seed * 0.01);
  const progress = (timeSecs * speed + seed) % 1.0;
  
  // Interpolate lat/lng
  const lat = startCity.lat + (endCity.lat - startCity.lat) * progress;
  const lng = startCity.lng + (endCity.lng - startCity.lng) * progress;
  
  return [lat, lng];
}

// Map center adjustment component
function ChangeMapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function App() {
  const [wsStatus, setWsStatus] = useState('connecting');
  const [telemetry, setTelemetry] = useState({
    total_readings: 0,
    ingestion_rate: 0.0,
    filter_rate: 0.0,
    recent_readings: [],
    trucks: [],
    anomalies: [],
  });
  const [workers, setWorkers] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]); // US geographic center
  const [mapZoom, setMapZoom] = useState(4);
  const [actionLoading, setActionLoading] = useState({});
  const socketRef = useRef(null);
  
  // Track continuous system time for map animation
  const [systemTime, setSystemTime] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Connect to live WebSocket feed
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    setWsStatus('connecting');
    const wsUrl = `ws://${window.location.hostname}:8000/ws/live`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      console.log('WebSocket connected!');
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (frame.type === 'telemetry' || frame.type === 'init') {
          setTelemetry(frame.data);
          setWorkers(frame.workers);
        }
      } catch (e) {
        console.error('Error parsing WebSocket frame:', e);
      }
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      console.warn('WebSocket closed. Retrying in 4 seconds...');
      setTimeout(connectWebSocket, 4000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  };

  // Spawning / Killing Workers via API
  const handleWorkerAction = async (workerId, action) => {
    setActionLoading(prev => ({ ...prev, [workerId]: true }));
    try {
      const response = await fetch(`http://${window.location.hostname}:8000/api/workers/${workerId}/${action}`, {
        method: 'POST',
      });
      const data = await response.json();
      console.log(`Worker ${workerId} ${action} returned:`, data);
      
      // Update local workers state immediately before next WS poll
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, status: action === 'start' ? 'running' : 'stopped' } : w));
    } catch (e) {
      console.error(`Failed to perform ${action} on ${workerId}:`, e);
    } finally {
      setActionLoading(prev => ({ ...prev, [workerId]: false }));
    }
  };

  // Check if workers are running
  const w1Running = workers.find(w => w.id === 'worker-1')?.status === 'running';
  const w2Running = workers.find(w => w.id === 'worker-2')?.status === 'running';
  const systemActive = w1Running || w2Running;

  // React Flow Node & Edge layout
  const nodes = useMemo(() => {
    const isW1Active = w1Running;
    const isW2Active = w2Running;
    
    return [
      {
        id: 'ingest',
        type: 'pipelineNode',
        data: {
          type: 'input',
          label: 'Kafka Telemetry Ingestion',
          status: systemActive ? 'active' : 'crashed',
          metricName: 'Throughput',
          metricValue: `${telemetry.ingestion_rate} msg/s`,
          subMetricName: 'Topic',
          subMetricValue: 'truck-telemetry'
        },
        position: { x: 50, y: 150 },
      },
      {
        id: 'dedup',
        type: 'pipelineNode',
        data: {
          type: 'process',
          label: 'Deduplication Stage',
          status: systemActive ? 'active' : 'crashed',
          metricName: 'Duplicate Drops',
          metricValue: '0/s',
          subMetricName: 'Dedup Cache',
          subMetricValue: 'Active (100k cap)'
        },
        position: { x: 300, y: 150 },
      },
      {
        id: 'filter',
        type: 'pipelineNode',
        data: {
          type: 'filter',
          label: 'Filter Anomalies (>0°C)',
          status: systemActive ? 'active' : 'crashed',
          metricName: 'Filtered Out',
          metricValue: `${telemetry.filter_rate} msg/s`,
          subMetricName: 'Filter Logic',
          subMetricValue: 'temperature > 0'
        },
        position: { x: 550, y: 150 },
      },
      {
        id: 'map',
        type: 'pipelineNode',
        data: {
          type: 'process',
          label: 'Normalization & Parsing',
          status: systemActive ? 'active' : 'crashed',
          metricName: 'Parsed Events',
          metricValue: `${Math.max(0, roundValue(telemetry.ingestion_rate - telemetry.filter_rate, 2))} msg/s`,
          subMetricName: 'Schema',
          subMetricValue: 'NormalizedReading'
        },
        position: { x: 800, y: 150 },
      },
      // Windows
      {
        id: 'tumbling',
        type: 'pipelineNode',
        data: {
          type: 'window',
          label: 'Tumbling Averages',
          status: isW1Active ? 'active' : 'crashed',
          metricName: 'Window Size',
          metricValue: '5 Min (Tumble)',
          subMetricName: 'Worker Allocation',
          subMetricValue: 'Worker 1 (P 0-9)'
        },
        position: { x: 1080, y: 50 },
      },
      {
        id: 'hopping',
        type: 'pipelineNode',
        data: {
          type: 'window',
          label: 'Hopping Averages',
          status: isW2Active ? 'active' : 'crashed',
          metricName: 'Window Size',
          metricValue: '5m / 1m Step',
          subMetricName: 'Worker Allocation',
          subMetricValue: 'Worker 2 (P 10-19)'
        },
        position: { x: 1080, y: 250 },
      },
      // RocksDB & Changelog
      {
        id: 'rocksdb',
        type: 'pipelineNode',
        data: {
          type: 'storage',
          label: 'RocksDB Local Cache',
          status: systemActive ? 'active' : 'crashed',
          metricName: 'Local Database',
          metricValue: 'rdict (RocksDB)',
          subMetricName: 'Data Path',
          subMetricValue: './streamforge-data'
        },
        position: { x: 1360, y: 50 },
      },
      {
        id: 'changelog',
        type: 'pipelineNode',
        data: {
          type: 'storage',
          label: 'Kafka Compacted Changelog',
          status: systemActive ? 'active' : 'crashed',
          metricName: 'Replication Source',
          metricValue: 'Compact Queue',
          subMetricName: 'Changelog Topic',
          subMetricValue: 'truck-state-changelog'
        },
        position: { x: 1360, y: 250 },
      },
      // Sinks
      {
        id: 'sink',
        type: 'pipelineNode',
        data: {
          type: 'output',
          label: 'Final Telemetry Sink',
          status: systemActive ? 'active' : 'crashed',
          metricName: 'Egress Topic',
          metricValue: 'truck-averages',
          subMetricName: 'Sink Format',
          subMetricValue: 'Avro JSON'
        },
        position: { x: 1640, y: 150 },
      },
    ];
  }, [telemetry, w1Running, w2Running, systemActive]);

  const edges = useMemo(() => {
    const isW1Active = w1Running;
    const isW2Active = w2Running;
    
    return [
      { id: 'e1', source: 'ingest', target: 'dedup', animated: systemActive, style: { stroke: systemActive ? '#000' : '#d4d4d4', strokeWidth: 2 } },
      { id: 'e2', source: 'dedup', target: 'filter', animated: systemActive, style: { stroke: systemActive ? '#000' : '#d4d4d4', strokeWidth: 2 } },
      { id: 'e3', source: 'filter', target: 'map', animated: systemActive, style: { stroke: systemActive ? '#000' : '#d4d4d4', strokeWidth: 2 } },
      
      { id: 'e4', source: 'map', target: 'tumbling', animated: isW1Active, style: { stroke: isW1Active ? '#000' : '#d4d4d4', strokeWidth: 2 } },
      { id: 'e5', source: 'map', target: 'hopping', animated: isW2Active, style: { stroke: isW2Active ? '#000' : '#d4d4d4', strokeWidth: 2 } },
      
      { id: 'e6', source: 'tumbling', target: 'rocksdb', animated: isW1Active, style: { stroke: isW1Active ? '#10b981' : '#d4d4d4', strokeWidth: 2, strokeDasharray: '5,5' } },
      { id: 'e7', source: 'hopping', target: 'rocksdb', animated: isW2Active, style: { stroke: isW2Active ? '#10b981' : '#d4d4d4', strokeWidth: 2, strokeDasharray: '5,5' } },
      
      { id: 'e8', source: 'rocksdb', target: 'changelog', animated: systemActive, style: { stroke: systemActive ? '#059669' : '#d4d4d4', strokeWidth: 2 } },
      
      { id: 'e9', source: 'tumbling', target: 'sink', animated: isW1Active, style: { stroke: isW1Active ? '#000' : '#d4d4d4', strokeWidth: 2 } },
      { id: 'e10', source: 'hopping', target: 'sink', animated: isW2Active, style: { stroke: isW2Active ? '#000' : '#d4d4d4', strokeWidth: 2 } },
    ];
  }, [w1Running, w2Running, systemActive]);

  // Map truck objects with calculated coordinates
  const animatedTrucks = useMemo(() => {
    return telemetry.trucks.map(truck => {
      const coords = calculateCurrentPosition(truck.truck_id, systemTime);
      const isAnomalous = truck.last_temperature > 42.0;
      return {
        ...truck,
        coords,
        isAnomalous
      };
    });
  }, [telemetry.trucks, systemTime]);

  const selectTruckOnMap = (truck) => {
    setSelectedTruck(truck);
    setMapCenter(truck.coords);
    setMapZoom(6);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 overflow-hidden font-sans">
      {/* Header Panel */}
      <header className="flex justify-between items-center px-6 py-4 bg-white border-b border-neutral-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 text-white rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900">StreamForge Telemetry</h1>
            <p className="text-xs text-neutral-500 font-mono">Axlero Solutions Event Pipeline Console</p>
          </div>
        </div>

        {/* Real-time stats */}
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="bg-neutral-50 px-3 py-1.5 border border-neutral-200 rounded-md">
            <span className="text-neutral-500 mr-2">Throughput:</span>
            <span className="font-bold text-neutral-900">{telemetry.ingestion_rate} msg/s</span>
          </div>
          <div className="bg-neutral-50 px-3 py-1.5 border border-neutral-200 rounded-md">
            <span className="text-neutral-500 mr-2">Total Readings:</span>
            <span className="font-bold text-neutral-900">{telemetry.total_readings.toLocaleString()}</span>
          </div>
          <div className="bg-neutral-50 px-3 py-1.5 border border-neutral-200 rounded-md">
            <span className="text-neutral-500 mr-2">Anomalies Detected:</span>
            <span className="font-bold text-rose-600">{telemetry.anomalies.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">API Broker:</span>
            <span className={`flex items-center gap-1.5 font-bold ${
              wsStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'
              }`} />
              {wsStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: Map Visualizer (Digital Fleet Twin) */}
        <div className="w-[40%] h-full border-r border-neutral-200 relative bg-white flex flex-col">
          <div className="p-4 border-b border-neutral-200 bg-white z-10 flex justify-between items-center">
            <div className="flex items-center gap-2 text-neutral-800">
              <MapPin size={16} />
              <h2 className="text-sm font-semibold">Digital Fleet Twin Map</h2>
            </div>
            <button 
              onClick={() => { setMapCenter([39.8283, -98.5795]); setMapZoom(4); }}
              className="text-[10px] uppercase font-mono px-2 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded text-neutral-600 flex items-center gap-1"
            >
              <RefreshCw size={10} /> Reset View
            </button>
          </div>

          <div className="flex-1 relative z-0">
            <MapContainer 
              center={mapCenter} 
              zoom={mapZoom} 
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <ChangeMapCenter center={mapCenter} />
              {animatedTrucks.map((truck) => (
                <CircleMarker
                  key={truck.truck_id}
                  center={truck.coords}
                  radius={truck.isAnomalous ? 10 : 6}
                  fillColor={truck.isAnomalous ? '#f43f5e' : '#10b981'}
                  color={truck.isAnomalous ? '#be123c' : '#047857'}
                  weight={2}
                  fillOpacity={truck.isAnomalous ? 0.75 : 0.6}
                  className={truck.isAnomalous ? 'animate-pulse' : ''}
                >
                  <Popup>
                    <div className="font-sans text-xs p-1">
                      <div className="flex items-center gap-1.5 font-bold text-neutral-900 border-b border-neutral-100 pb-1 mb-1.5">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        Truck #{truck.truck_id}
                      </div>
                      <table className="w-full text-[10px] font-mono text-neutral-600 border-collapse">
                        <tbody>
                          <tr>
                            <td className="pr-3 py-0.5 text-neutral-400">Temperature:</td>
                            <td className={`font-bold py-0.5 ${truck.isAnomalous ? 'text-rose-600' : 'text-neutral-900'}`}>
                              {truck.last_temperature.toFixed(2)} °C
                            </td>
                          </tr>
                          <tr>
                            <td className="pr-3 py-0.5 text-neutral-400">Fuel Level:</td>
                            <td className="font-bold py-0.5 text-neutral-900">
                              {truck.fuel_level ? `${truck.fuel_level.toFixed(1)}%` : 'N/A'}
                            </td>
                          </tr>
                          <tr>
                            <td className="pr-3 py-0.5 text-neutral-400">Tumble Avg:</td>
                            <td className="font-bold py-0.5 text-neutral-900">
                              {truck.tumbling_avg ? `${truck.tumbling_avg.toFixed(2)} °C` : 'Calculating...'}
                            </td>
                          </tr>
                          <tr>
                            <td className="pr-3 py-0.5 text-neutral-400">Hopping Avg:</td>
                            <td className="font-bold py-0.5 text-neutral-900">
                              {truck.hopping_avg ? `${truck.hopping_avg.toFixed(2)} °C` : 'Calculating...'}
                            </td>
                          </tr>
                          <tr>
                            <td className="pr-3 py-0.5 text-neutral-400">Last Telemetry:</td>
                            <td className="py-0.5 text-[9px] text-neutral-500 truncate max-w-[120px]">
                              {truck.last_timestamp.split('T')[1]?.substring(0, 8)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Map legend / status summary */}
          <div className="p-4 bg-white border-t border-neutral-100 flex justify-between items-center text-xs font-mono text-neutral-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600 block" /> Healthy Fleet
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600 animate-pulse block" /> Anomaly Alert
              </span>
            </div>
            <span>Active Trucks: {telemetry.trucks.length}</span>
          </div>
        </div>

        {/* Right Side: DAG Graph and Control Console */}
        <div className="w-[60%] h-full flex flex-col overflow-hidden">
          {/* Top Panel: React Flow DAG */}
          <div className="h-[55%] border-b border-neutral-200 bg-white relative flex flex-col">
            <div className="p-4 border-b border-neutral-100 bg-white flex items-center justify-between z-10">
              <div className="flex items-center gap-2 text-neutral-800">
                <Cpu size={16} />
                <h2 className="text-sm font-semibold">Active Stream DAG Visualization</h2>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono uppercase bg-neutral-100 px-2 py-0.5 rounded">
                React Flow canvas
              </span>
            </div>

            <div className="flex-1 z-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                className="bg-neutral-50"
                minZoom={0.2}
                maxZoom={1.5}
              >
                <Background variant="dots" gap={16} size={1} color="#e5e5e5" />
                <Controls showInteractive={false} className="!bg-white !border-neutral-200 !shadow-sm" />
              </ReactFlow>
            </div>
          </div>

          {/* Bottom Panel: Split logs and chaos console */}
          <div className="h-[45%] flex overflow-hidden">
            {/* Left Box: Chaos Engineering Control Panel */}
            <div className="w-[50%] border-r border-neutral-200 p-4 bg-white flex flex-col overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-neutral-100">
                <ShieldAlert className="text-neutral-800" size={16} />
                <h3 className="text-xs font-semibold text-neutral-900">Chaos Engineering Panel</h3>
              </div>

              {workers.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs font-mono text-neutral-400">
                  Worker status unavailable. Run backend API.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {workers.map((worker) => {
                    const isRunning = worker.status === 'running';
                    const loading = actionLoading[worker.id];
                    return (
                      <div 
                        key={worker.id}
                        className={`p-3 border rounded-lg flex flex-col gap-2 font-mono text-xs transition-all ${
                          isRunning 
                            ? 'bg-white border-neutral-200 shadow-sm' 
                            : 'bg-rose-50/20 border-rose-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                              isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                            }`} />
                            <span className="font-bold text-neutral-800 uppercase">{worker.id}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            isRunning 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {worker.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 text-[10px] text-neutral-500 gap-1 mt-1 border-t border-neutral-50 pt-2">
                          <div>PID: <span className="font-bold text-neutral-700">{worker.pid || 'N/A'}</span></div>
                          <div>Port: <span className="font-bold text-neutral-700">{worker.port}</span></div>
                          <div className="col-span-2">Partitions: <span className="font-bold text-neutral-700">{worker.partitions}</span></div>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <button
                            disabled={isRunning || loading}
                            onClick={() => handleWorkerAction(worker.id, 'start')}
                            className="flex-1 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                          >
                            <Play size={10} /> Start Process
                          </button>
                          <button
                            disabled={!isRunning || loading}
                            onClick={() => handleWorkerAction(worker.id, 'kill')}
                            className="flex-1 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 rounded text-[10px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                          >
                            <Square size={10} fill="currentColor" /> Crash Worker
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Box: Combined Alerts & Raw Log terminal */}
            <div className="w-[50%] bg-neutral-900 text-neutral-300 p-4 flex flex-col font-mono text-[10px] overflow-hidden">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800 text-neutral-400">
                <Terminal size={12} />
                <span className="text-xs font-semibold">Live Kafka Event Feed</span>
              </div>
              
              <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 scrollbar-thin">
                {telemetry.anomalies.slice(0, 3).map((anomaly, idx) => (
                  <div key={`anom-${idx}`} className="text-rose-400 bg-rose-950/40 p-2 border border-rose-900/50 rounded flex gap-1.5 items-start">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold">[ANOMALY]</span> Truck #{anomaly.truck_id} at {anomaly.temperature.toFixed(1)}°C
                    </div>
                  </div>
                ))}
                
                {telemetry.recent_readings.length === 0 ? (
                  <div className="text-neutral-600 italic text-center py-6">
                    Waiting for Kafka stream...
                  </div>
                ) : (
                  telemetry.recent_readings.map((msg, idx) => (
                    <div key={`msg-${idx}`} className="text-neutral-400 leading-normal hover:text-white transition-colors">
                      <span className="text-neutral-600">[{msg.timestamp.split('T')[1]?.substring(0, 8) || 'API'}]</span>{' '}
                      <span className="text-emerald-400">TRUCK-{msg.truck_id}</span>{' '}
                      temp={<span className="text-amber-400">{msg.temperature.toFixed(2)}</span>}
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

function roundValue(value, decimals = 2) {
  if (value === undefined || value === null) return 0;
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}
