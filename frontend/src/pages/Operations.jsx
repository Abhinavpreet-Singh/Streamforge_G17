import { useEffect, useState } from 'react';
import ChaosPanel from '../components/chaos/ChaosPanel';
import StackStatusCards from '../components/operations/StackStatusCards';
import PageLayout from '../components/layout/PageLayout';
import { useApp } from '../hooks/useApp';
import { apiUrl } from '../lib/api';

const CHAOS_STEPS = [
  'Start Docker stack and API on :8000',
  'Run the truck producer',
  'Click Start on the stream processor below',
  'Confirm sink rate rises in the header',
  'Click Crash — worker stops and Faust state is wiped',
  'Click Start again — pipeline recovers from Kafka replay',
];

export default function Operations() {
  const { stackStatus, workers } = useApp();
  const [logLines, setLogLines] = useState([]);
  const [logMessage, setLogMessage] = useState('');

  const checkedAt = stackStatus?.time
    ? new Date(stackStatus.time).toLocaleTimeString()
    : '—';
  const workerId = workers[0]?.id ?? 'stream-processor';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(apiUrl(`/api/workers/${workerId}/logs?tail=40`));
        if (!res.ok) throw new Error('fail');
        const data = await res.json();
        if (cancelled) return;
        setLogLines(data.lines ?? []);
        setLogMessage(data.message || '');
      } catch {
        if (!cancelled) {
          setLogLines([]);
          setLogMessage('Could not load logs');
        }
      }
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [workerId]);

  return (
    <PageLayout className="bg-neutral-50">
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        <div className="flex flex-col gap-4 min-h-full">
          <div className="flex flex-wrap items-end justify-between gap-2 shrink-0">
            <div>
              <p className="text-xs text-neutral-500">
                Stack health, worker controls, and chaos testing.
              </p>
              <p className="text-[10px] font-mono text-neutral-400 mt-1">
                Last status check: {checkedAt}
              </p>
            </div>
          </div>

          <StackStatusCards />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1 min-h-[420px]">
            <section className="xl:col-span-2 flex flex-col rounded-xl border border-neutral-200 bg-white overflow-hidden min-h-[320px]">
              <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
                <h2 className="text-sm font-semibold text-neutral-900">Chaos demo</h2>
                <ol className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-neutral-600 list-decimal list-inside">
                  {CHAOS_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <ChaosPanel className="flex-1 border-0" />
            </section>

            <div className="flex flex-col gap-4 min-h-[320px]">
              <section className="rounded-xl border border-neutral-200 bg-white p-4 shrink-0">
                <h2 className="text-sm font-semibold text-neutral-900 mb-2">Consumer lag</h2>
                <p className="text-xs text-neutral-500 mb-3">
                  Faust consumer group from{' '}
                  <code className="font-mono text-neutral-700 bg-neutral-100 px-1 rounded">/api/status</code>.
                </p>
                {stackStatus?.consumer_lag ? (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-1 font-mono text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Group</span>
                      <span className="text-neutral-800">{stackStatus.consumer_lag.group}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Status</span>
                      <span
                        className={
                          stackStatus.consumer_lag.status === 'ok'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {stackStatus.consumer_lag.status}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Total lag</span>
                      <span className="text-neutral-800">
                        {stackStatus.consumer_lag.total_lag ?? '—'}
                      </span>
                    </div>
                    {stackStatus.consumer_lag.by_topic &&
                      Object.entries(stackStatus.consumer_lag.by_topic).map(([topic, lag]) => (
                        <div key={topic} className="flex justify-between gap-2 text-[10px]">
                          <span className="text-neutral-400 truncate">{topic}</span>
                          <span className="text-neutral-600">{lag}</span>
                        </div>
                      ))}
                    {stackStatus.consumer_lag.error && (
                      <p className="text-[10px] text-amber-700 pt-1 border-t border-neutral-200 mt-2">
                        {stackStatus.consumer_lag.error}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-400 font-mono">
                    No lag data yet
                  </div>
                )}
              </section>

              <section className="flex-1 rounded-xl border border-neutral-200 bg-neutral-900 p-4 min-h-[180px] flex flex-col">
                <h2 className="text-sm font-semibold text-neutral-200 mb-1 shrink-0">Worker logs</h2>
                <p className="text-[10px] text-neutral-500 font-mono mb-2 shrink-0">
                  logs/{workerId}.log · last 40 lines
                </p>
                <div className="flex-1 overflow-auto rounded-lg bg-neutral-950 border border-neutral-800 p-3 font-mono text-[10px] leading-relaxed">
                  {logLines.length === 0 ? (
                    <p className="text-neutral-600">{logMessage || 'Start the processor to generate logs…'}</p>
                  ) : (
                    logLines.map((line, i) => (
                      <div key={i} className="text-neutral-400 whitespace-pre-wrap break-all">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
