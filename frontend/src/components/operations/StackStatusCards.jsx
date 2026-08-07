import { useApp } from '../../hooks/useApp';

function StatusCard({ label, ok, detail }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-600">{label}</span>
        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
      </div>
      <p className={`text-sm font-semibold font-mono ${ok ? 'text-emerald-700' : 'text-neutral-500'}`}>
        {ok ? 'OK' : 'DOWN'}
      </p>
      {detail && <p className="text-[10px] text-neutral-400 font-mono mt-1 truncate">{detail}</p>}
    </div>
  );
}

export default function StackStatusCards() {
  const { stackStatus, processorRunning, wsStatus } = useApp();

  const kafkaOk = stackStatus?.kafka?.status === 'ok';
  const registryOk = stackStatus?.schema_registry?.status === 'ok';
  const workersRunning = (stackStatus?.workers?.running ?? 0) > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatusCard label="Kafka" ok={kafkaOk} detail={stackStatus?.kafka?.broker ?? 'localhost:9092'} />
      <StatusCard label="Schema Registry" ok={registryOk} detail={stackStatus?.schema_registry?.url} />
      <StatusCard
        label="Stream Processor"
        ok={processorRunning || workersRunning}
        detail={processorRunning ? 'running' : 'stopped'}
      />
      <StatusCard
        label="WebSocket"
        ok={wsStatus === 'connected'}
        detail={wsStatus}
      />
    </div>
  );
}
