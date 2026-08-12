import PageLayout, { PageBody } from '../components/layout/PageLayout';
import { BarChart3 } from 'lucide-react';

/** Assigned to Surya — build Grafana / Prometheus / API metrics UI here */
export default function Metrics() {
  return (
    <PageLayout>
      <PageBody className="flex items-center justify-center">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="inline-flex p-3 rounded-full bg-neutral-100 text-neutral-700 mb-4">
            <BarChart3 size={28} />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Metrics</h2>
          <p className="text-sm text-neutral-600 mb-6">
            Observability home — embed Grafana, Prometheus targets, and live API gauges.
          </p>
          <div className="text-left bg-white border border-neutral-200 rounded-xl p-4 text-xs font-mono space-y-2 shadow-sm">
            <p>
              <span className="text-neutral-400">File: </span>
              <span className="text-neutral-800">src/pages/Metrics.jsx</span>
            </p>
            <p>
              <span className="text-neutral-400">Use: </span>
              <span className="text-neutral-600">useApp() for rates · fetch /metrics · iframe Grafana</span>
            </p>
            <p>
              <span className="text-neutral-400">Links: </span>
              <span className="text-neutral-600">localhost:3001 · localhost:9090</span>
            </p>
          </div>
        </div>
      </PageBody>
    </PageLayout>
  );
}
