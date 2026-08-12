import { BarChart3, Gauge, Truck, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/metrics/StatCard';
import { useApp } from '../hooks/useApp';
import { apiUrl } from '../lib/api';
import { GRAFANA_URL, PROMETHEUS_URL } from '../config/monitoring';

export default function Metrics() {
  const { telemetry } = useApp();
  const [rawMetrics, setRawMetrics] = useState('');
  const [rawError, setRawError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRawMetrics = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/metrics'));
      if (!res.ok) throw new Error('bad response');
      setRawMetrics(await res.text());
      setRawError(false);
    } catch {
      setRawError(true);
    } finally {
      setLastUpdated(new Date());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRawMetrics();
    const id = setInterval(fetchRawMetrics, 10000);
    return () => clearInterval(id);
  }, [fetchRawMetrics]);

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-neutral-700" />
          <h2 className="text-lg font-semibold text-neutral-900">Metrics</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 font-mono">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
          </span>
          <button
            type="button"
            onClick={fetchRawMetrics}
            className="flex items-center gap-1 px-2 py-1 border border-neutral-200 rounded hover:bg-neutral-50 text-neutral-600 text-xs"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Gauge} label="Ingestion Rate" value={telemetry.ingestion_rate} unit="msg/s" accent="sky" />
        <StatCard icon={BarChart3} label="Sink Rate" value={telemetry.aggregate_rate} unit="msg/s" accent="emerald" />
        <StatCard icon={Truck} label="Trucks" value={telemetry.trucks.length} />
        <StatCard
          icon={AlertTriangle}
          label="Anomalies"
          value={telemetry.anomalies.length}
          accent={telemetry.anomalies.length > 0 ? 'rose' : 'neutral'}
        />
      </div>

      <div className="flex gap-3 mb-6">
        <a
          href={GRAFANA_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800"
        >
          <ExternalLink size={14} /> Open Grafana
        </a>
        <a
          href={PROMETHEUS_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 border border-neutral-200 bg-white rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <ExternalLink size={14} /> Open Prometheus
        </a>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Raw /metrics</h3>
        {loading ? (
          <p className="text-xs text-neutral-400 font-mono">Loading…</p>
        ) : rawError ? (
          <p className="text-xs text-rose-600 font-mono">Failed to load /metrics — is the API running on :8000?</p>
        ) : (
          <pre className="text-[11px] font-mono text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap">
            {rawMetrics}
          </pre>
        )}
      </div>
    </div>
  );
}