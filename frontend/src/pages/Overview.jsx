import ThroughputChart from '../components/ThroughputChart';
import FleetMap from '../components/map/FleetMap';
import PipelineDAG from '../components/pipeline/PipelineDAG';
import ChaosPanel from '../components/chaos/ChaosPanel';
import LiveFeed from '../components/live/LiveFeed';
import { useApp } from '../hooks/useApp';

/** Original single-screen dashboard — chart, map, DAG, chaos, live feed */
export default function Overview() {
  const { throughputHistory, telemetry } = useApp();

  return (
    <>
      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 shrink-0">
        <ThroughputChart history={throughputHistory} currentRate={telemetry.ingestion_rate} />
      </div>

      <main className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-[38%] border-r border-neutral-200 min-h-0">
          <FleetMap className="h-full" />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="h-[52%] border-b border-neutral-200 min-h-0">
            <PipelineDAG className="h-full bg-white" />
          </div>

          <div className="flex-1 flex min-h-0">
            <ChaosPanel className="w-1/2 border-r border-neutral-200" />
            <LiveFeed className="w-1/2" />
          </div>
        </div>
      </main>
    </>
  );
}
