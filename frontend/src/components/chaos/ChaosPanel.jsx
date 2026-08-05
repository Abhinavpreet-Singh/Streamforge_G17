import { Play, Square, ShieldAlert } from 'lucide-react';
import { useApp } from '../../hooks/useApp';

export default function ChaosPanel({ className = '' }) {
  const {
    workers,
    processorRunning,
    actionLoading,
    tumbleLabel,
    handleWorkerAction,
  } = useApp();

  return (
    <div className={`p-4 overflow-y-auto bg-white ${className}`}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-100">
        <ShieldAlert size={16} />
        <h3 className="text-xs font-semibold">Chaos Panel</h3>
      </div>
      {!processorRunning && workers.length > 0 && (
        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded p-2 mb-3">
          Start the stream processor, then run the producer. Averages appear after {tumbleLabel}.
        </p>
      )}
      {workers.length === 0 ? (
        <p className="text-xs text-neutral-400 font-mono">Start API on :8000</p>
      ) : (
        workers.map((worker) => {
          const running = worker.status === 'running';
          const loading = actionLoading[worker.id];
          return (
            <div key={worker.id} className="p-3 mb-3 border rounded-lg font-mono text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{worker.label || worker.id}</span>
                <span className={running ? 'text-emerald-600' : 'text-rose-600'}>{worker.status}</span>
              </div>
              <p className="text-[10px] text-neutral-500 mb-2">PID: {worker.pid || '—'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={running || loading}
                  onClick={() => handleWorkerAction(worker.id, 'start')}
                  className="flex-1 py-1.5 bg-neutral-900 text-white rounded text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Play size={10} /> Start
                </button>
                <button
                  type="button"
                  disabled={!running || loading}
                  onClick={() => handleWorkerAction(worker.id, 'kill')}
                  className="flex-1 py-1.5 border border-rose-200 text-rose-700 rounded text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Square size={10} /> Crash
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
