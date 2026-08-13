import { AlertTriangle, Terminal } from 'lucide-react';
import { useApp } from '../../hooks/useApp';

export default function LiveFeed({ className = '' }) {
  const { telemetry, focusAnomaly, processorRunning } = useApp();
  const kafkaConnected = telemetry.kafka_connected;

  return (
    <div className={`bg-neutral-900 text-neutral-300 p-4 flex flex-col font-mono text-[10px] min-h-0 ${className}`}>
      <div className="flex items-center gap-2 mb-2 border-b border-neutral-800 pb-2 text-neutral-400 shrink-0">
        <Terminal size={12} />
        <span className="text-xs font-semibold">Live Feed</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {telemetry.anomalies.slice(0, 5).map((a, i) => (
          <button
            key={`${a.truck_id}-${a.timestamp}-${i}`}
            type="button"
            onClick={() => focusAnomaly(a)}
            className="w-full text-left text-rose-400 bg-rose-950/40 p-2 rounded flex gap-1 hover:bg-rose-950/60"
          >
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>Truck #{a.truck_id} @ {a.temperature?.toFixed(1)}°C — click to focus map</span>
          </button>
        ))}
        {telemetry.recent_readings.length === 0 ? (
          <p className="text-neutral-600 italic text-center py-8">
            {!kafkaConnected
              ? 'Waiting for Kafka… is the API + producer running?'
              : !processorRunning
                ? 'Ingest live — start the processor for averages.'
                : 'Waiting for readings…'}
          </p>
        ) : (
          telemetry.recent_readings.map((msg, i) => (
            <div key={i} className="text-neutral-400">
              <span className="text-neutral-600">[{msg.timestamp?.split('T')[1]?.slice(0, 8)}]</span>
              {' '}TRUCK-{msg.truck_id} temp={msg.temperature?.toFixed(2)}
              {msg.fuel_level != null ? ` fuel=${Number(msg.fuel_level).toFixed(1)}%` : ''}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
