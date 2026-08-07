import { useApp } from '../../hooks/useApp';
import { NAV_ITEMS } from '../../config/navigation';

export default function AppHeader({ activePage, metricsTab, onNavigate }) {
  const { wsStatus, telemetry, stackStatus } = useApp();
  const page = NAV_ITEMS.find((item) => item.id === activePage);

  const obsBtn = (tab) => {
    const onMetrics = activePage === 'metrics' && metricsTab === tab;
    return `px-2 py-1 rounded border text-xs transition-colors ${
      onMetrics
        ? 'border-neutral-900 bg-neutral-900 text-white'
        : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-600'
    }`;
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-neutral-200 shrink-0 min-h-[3.25rem]">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold text-neutral-900 truncate">{page?.label ?? 'Dashboard'}</h1>
        <p className="text-[10px] text-neutral-400 font-mono truncate hidden sm:block">
          {page?.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
        <span className="text-neutral-500 hidden md:inline">
          Readings: <b className="text-neutral-900">{telemetry.total_readings.toLocaleString()}</b>
        </span>
        <span className="text-neutral-500">
          Anomalies: <b className="text-rose-600">{telemetry.anomalies.length}</b>
        </span>
        <span className="text-neutral-500">
          Sink: <b className="text-neutral-900">{telemetry.aggregate_rate}/s</b>
        </span>
        {['Kafka', 'Registry', 'Workers'].map((label, i) => {
          const ok =
            i === 0 ? stackStatus?.kafka?.status === 'ok'
            : i === 1 ? stackStatus?.schema_registry?.status === 'ok'
            : (stackStatus?.workers?.running ?? 0) > 0;
          return (
            <span
              key={label}
              className={`hidden lg:flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-neutral-400'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
              {label}
            </span>
          );
        })}
        <span
          className={`flex items-center gap-1.5 font-bold ${wsStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`}
          />
          <span className="hidden sm:inline">{wsStatus.toUpperCase()}</span>
        </span>
        <button type="button" onClick={() => onNavigate('metrics', 'grafana')} className={obsBtn('grafana')}>
          Grafana
        </button>
        <button
          type="button"
          onClick={() => onNavigate('metrics', 'prometheus')}
          className={`${obsBtn('prometheus')} hidden sm:inline`}
        >
          Prometheus
        </button>
      </div>
    </header>
  );
}
