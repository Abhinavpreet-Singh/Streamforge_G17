import { BarChart3, Gauge, Truck, AlertTriangle } from 'lucide-react';
import StatCard from '../components/metrics/StatCard';
import { useApp } from '../hooks/useApp';

export default function Metrics() {
  const { telemetry } = useApp();
  
  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 size={20} className="text-neutral-700" />
        <h2 className="text-lg font-semibold text-neutral-900">Metrics</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Gauge} label="Ingestion Rate" value={telemetry.ingestion_rate} unit="msg/s" accent="sky" />
        <StatCard icon={BarChart3} label="Sink Rate" value={telemetry.aggregate_rate} unit="msg/s" accent="emerald" />
        <StatCard icon={Truck} label="Trucks" value="—" />
        <StatCard icon={AlertTriangle} label="Anomalies" value="—" accent="rose" />
      </div>
    </div>
  );
}