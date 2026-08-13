import { useApp } from '../../hooks/useApp';

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-[10px] font-mono uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1 font-mono">{value}</p>
      {sub && <p className="text-[10px] text-neutral-500 font-mono mt-1">{sub}</p>}
    </div>
  );
}

export default function MetricsStatCards() {
  const { telemetry } = useApp();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
      <StatCard label="Ingestion" value={`${telemetry.ingestion_rate}/s`} sub="filtered readings" />
      <StatCard label="Sink" value={`${telemetry.aggregate_rate}/s`} sub="truck-averages" />
      <StatCard label="Trucks" value={telemetry.trucks.length} sub="active in state" />
      <StatCard label="Anomalies" value={telemetry.anomalies.length} sub="rolling buffer" />
    </div>
  );
}
