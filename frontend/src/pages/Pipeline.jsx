import { useEffect, useState } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import PageLayout from '../components/layout/PageLayout';
import PipelineDAG from '../components/pipeline/PipelineDAG';
import { useApp } from '../hooks/useApp';
import { apiUrl } from '../lib/api';

const STAGE_BLURBS = {
  ingest: 'Raw Avro/JSON truck readings land on Kafka topic truck-telemetry.',
  dedup: 'Drops duplicate (truck_id, timestamp) pairs within the rolling cache.',
  filter: 'Rejects invalid temperatures (≤ 0°C) before aggregation.',
  map: 'Normalizes fields into a consistent reading schema.',
  tumbling: 'Fixed non-overlapping windows — average temperature per truck.',
  hopping: 'Sliding windows with a hop step — smoother rolling averages.',
  state: 'Faust table store on disk (*-dat) for window state.',
  changelog: 'RocksDB dual-write + truck-state-changelog (mirrors rolling averages for recovery demos).',
  sink: 'Publishes tumbling and hopping aggregates to truck-averages.',
};

export default function Pipeline() {
  const { stackStatus, processorRunning, tumbleLabel, telemetry } = useApp();
  const [topology, setTopology] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(apiUrl('/topology'));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setTopology(data);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load /topology');
          setLoading(false);
        }
      }
    };

    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const refresh = () => {
    setLoading(true);
    fetch(apiUrl('/topology'))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTopology(data);
        setError(null);
      })
      .catch((e) => setError(e.message || 'Failed to load /topology'))
      .finally(() => setLoading(false));
  };

  const nodes = topology?.dag?.nodes ?? [];
  const windowSec = stackStatus?.pipeline?.window_size_seconds;
  const hopSec = stackStatus?.pipeline?.hopping_step_seconds;
  const appId = stackStatus?.pipeline?.app_id ?? topology?.pipeline?.app_id ?? 'streamforge';

  return (
    <PageLayout className="bg-white">
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0">
          <PipelineDAG className="h-full bg-white" />
        </div>

        <aside className="w-full max-w-md lg:w-[22rem] shrink-0 border-l border-neutral-200 flex flex-col min-h-0 bg-neutral-50">
          <div className="p-4 border-b border-neutral-200 bg-white shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-neutral-700" />
                <h2 className="text-sm font-semibold text-neutral-900">Topology</h2>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="text-[10px] font-mono px-2 py-1 bg-neutral-100 border border-neutral-200 rounded flex items-center gap-1 hover:bg-neutral-200"
              >
                <RefreshCw size={10} /> Refresh
              </button>
            </div>
            <p className="text-[10px] font-mono text-neutral-400 mt-2">
              App: {appId} · Window: {tumbleLabel}
              {hopSec != null ? ` · Hop: ${hopSec}s` : ''}
            </p>
            <p className={`text-[10px] font-mono mt-1 ${processorRunning ? 'text-emerald-600' : 'text-amber-600'}`}>
              Processor: {processorRunning ? 'running' : 'stopped'}
              {' · '}
              Sink: {telemetry.aggregate_rate}/s
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && !topology && (
              <p className="text-xs text-neutral-400 font-mono text-center py-8">Loading /topology…</p>
            )}
            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded p-3">
                {error} — is API on :8000?
              </p>
            )}
            {nodes.map((node) => (
              <div
                key={node.id}
                className="rounded-lg border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-neutral-900">{node.label}</span>
                  <span className="text-[10px] font-mono uppercase text-neutral-400">{node.type}</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  {STAGE_BLURBS[node.id] ?? 'Pipeline stage.'}
                </p>
              </div>
            ))}
            {!loading && !error && nodes.length === 0 && (
              <p className="text-xs text-neutral-400 font-mono text-center py-8">No stages returned</p>
            )}
          </div>

          <div className="p-3 border-t border-neutral-200 bg-white text-[10px] font-mono text-neutral-400 shrink-0">
            GET /topology · window {windowSec ?? '—'}s
          </div>
        </aside>
      </main>
    </PageLayout>
  );
}
