import { useEffect, useMemo, useRef, useState } from 'react';
import { AppContext } from './AppContext';
import { apiUrl, wsLiveUrl } from '../lib/api';
import { calculateCurrentPosition } from '../lib/mapUtils';
import { formatDuration, pushThroughputPoint, roundValue } from '../lib/format';

const EMPTY_TELEMETRY = {
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
};

export function AppProvider({ children }) {
  const [wsStatus, setWsStatus] = useState('connecting');
  const [telemetry, setTelemetry] = useState(EMPTY_TELEMETRY);
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

  const pipelineNodes = useMemo(
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

  const pipelineEdges = useMemo(() => {
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

  const resetMapView = () => {
    setMapCenter([39.8283, -98.5795]);
    setMapZoom(4);
    setSelectedTruck(null);
  };

  const value = {
    wsStatus,
    telemetry,
    throughputHistory,
    stackStatus,
    workers,
    selectedTruck,
    mapCenter,
    mapZoom,
    actionLoading,
    processorRunning,
    pipelineActive,
    tumbleLabel,
    pipelineNodes,
    pipelineEdges,
    animatedTrucks,
    handleWorkerAction,
    selectTruckOnMap,
    resetMapView,
    setSelectedTruck,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
