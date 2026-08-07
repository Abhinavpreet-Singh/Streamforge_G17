import ChaosPanel from '../components/chaos/ChaosPanel';
import StackStatusCards from '../components/operations/StackStatusCards';
import PageLayout, { PageBody } from '../components/layout/PageLayout';
import { useApp } from '../hooks/useApp';

const CHAOS_STEPS = [
  'Start Docker stack and API on :8000',
  'Run the truck producer',
  'Click Start on the stream processor below',
  'Confirm sink rate rises in the header',
  'Click Crash — worker stops and Faust state is wiped',
  'Click Start again — pipeline recovers from Kafka replay',
];

export default function Operations() {
  const { stackStatus } = useApp();
  const checkedAt = stackStatus?.time
    ? new Date(stackStatus.time).toLocaleTimeString()
    : '—';

  return (
    <PageLayout>
      <PageBody>
        <div className="flex flex-col gap-4 h-full min-h-0">
          <p className="text-[10px] font-mono text-neutral-400 shrink-0">
            Last status check: {checkedAt}
          </p>

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
              <section className="flex-1 rounded-xl border border-neutral-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-neutral-900 mb-2">Consumer lag</h2>
                <p className="text-xs text-neutral-500">
                  Per-topic lag will appear here when exposed on{' '}
                  <code className="font-mono text-neutral-700 bg-neutral-100 px-1 rounded">/api/status</code>.
                </p>
                <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-xs text-neutral-400 font-mono">
                  No lag data yet
                </div>
              </section>

              <section className="flex-1 rounded-xl border border-neutral-200 bg-neutral-900 p-4 min-h-[140px]">
                <h2 className="text-sm font-semibold text-neutral-200 mb-2">Worker logs</h2>
                <p className="text-xs text-neutral-500 font-mono mb-3">logs/stream-processor.log</p>
                <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-3 text-[10px] text-neutral-600 font-mono">
                  Tail endpoint coming soon…
                </div>
              </section>
            </div>
          </div>
        </div>
      </PageBody>
    </PageLayout>
  );
}
