import { Activity } from 'lucide-react';
import { useApp } from '../../hooks/useApp';

export default function AppHeader() {
  const { wsStatus, telemetry, stackStatus } = useApp();

  return (
    <header className="flex flex-wrap justify-between items-center gap-3 px-6 py-3 bg-white border-b border-neutral-200 shadow-sm z-10 shrink-0">
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
        <span className="text-neutral-500">
          Readings: <b className="text-neutral-900">{telemetry.total_readings.toLocaleString()}</b>
        </span>
        <span className="text-neutral-500">
          Anomalies: <b className="text-rose-600">{telemetry.anomalies.length}</b>
        </span>
        <span className="text-neutral-500">
          Sink: <b className="text-neutral-900">{telemetry.aggregate_rate} msg/s</b>
        </span>
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
        <a
          href="http://localhost:3001/d/streamforge-api"
          target="_blank"
          rel="noreferrer"
          className="px-2 py-1 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600"
        >
          Grafana
        </a>
        <a
          href="http://localhost:9090/targets"
          target="_blank"
          rel="noreferrer"
          className="px-2 py-1 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600"
        >
          Prometheus
        </a>
      </div>
    </header>
  );
}
