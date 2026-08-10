import { BarChart3, Gauge, Truck, AlertTriangle } from 'lucide-react';
import StatCard from '../components/metrics/StatCard';
import { useApp } from '../hooks/useApp';
import { ExternalLink } from 'lucide-react';
import { GRAFANA_URL, PROMETHEUS_URL } from '../config/monitoring';

export default function Metrics() {
  const { telemetry } = useApp();
  
  return (
    <>
      <div className="flex-1 overflow-y-auto bg-neutral-50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 size={20} className="text-neutral-700" />
          <h2 className="text-lg font-semibold text-neutral-900">Metrics</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Gauge} label="Ingestion Rate" value={telemetry.ingestion_rate} unit="msg/s" accent="sky" />
          <StatCard icon={BarChart3} label="Sink Rate" value={telemetry.aggregate_rate} unit="msg/s" accent="emerald" />
          <StatCard icon={Truck} label="Trucks" value={telemetry.trucks.length} />
          <StatCard
           icon={AlertTriangle}
           label="Anomalies"
           value={telemetry.anomalies.length}
           accent={telemetry.anomalies.length > 0 ? 'rose' : 'neutral'}
          />
          <StatCard icon={Truck} label="Trucks" value={telemetry.trucks.length} />
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <a href={GRAFANA_URL} target="_blank" rel="noreferrer"
           className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800">
          <ExternalLink size={14} /> Open Grafana
        </a>
        <a href={PROMETHEUS_URL} target="_blank" rel="noreferrer"
           className="flex items-center gap-2 px-4 py-2 border border-neutral-200 bg-white rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          <ExternalLink size={14} /> Open Prometheus
        </a>
      </div>
    </>
  );
}