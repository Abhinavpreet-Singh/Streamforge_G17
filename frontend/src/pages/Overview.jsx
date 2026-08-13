import ThroughputChart from '../components/ThroughputChart';
import FleetMap from '../components/map/FleetMap';
import PipelineDAG from '../components/pipeline/PipelineDAG';
import LiveFeed from '../components/live/LiveFeed';
import PageLayout from '../components/layout/PageLayout';
import { useApp } from '../hooks/useApp';

export default function Overview() {
  const { throughputHistory, telemetry } = useApp();

  return (
    <PageLayout className="bg-white">
      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 shrink-0">
        <ThroughputChart history={throughputHistory} currentRate={telemetry.ingestion_rate} />
      </div>

      <main className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-full lg:w-[40%] border-r border-neutral-200 min-h-0 flex flex-col">
          <FleetMap className="h-full min-h-[280px]" />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="h-[55%] min-h-[220px] border-b border-neutral-200">
            <PipelineDAG className="h-full bg-white" />
          </div>
          <div className="flex-1 min-h-[160px]">
            <LiveFeed className="h-full" />
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
