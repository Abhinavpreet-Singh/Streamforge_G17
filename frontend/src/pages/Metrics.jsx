import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import PageLayout, { PageBody } from '../components/layout/PageLayout';
import MetricsStatCards from '../components/metrics/MetricsStatCards';
import { OBS_TABS } from '../lib/observability';
import { apiUrl } from '../lib/api';

const TAB_LIST = [OBS_TABS.grafana, OBS_TABS.prometheus, OBS_TABS.api];

export default function Metrics() {
  const [tab, setTab] = useState('grafana');
  const [rawMetrics, setRawMetrics] = useState('');
  const [metricsError, setMetricsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const current = TAB_LIST.find((t) => t.id === tab) ?? OBS_TABS.grafana;

  const loadRawMetrics = useCallback(() => {
    fetch(apiUrl('/metrics'))
      .then((r) => {
        if (!r.ok) throw new Error('bad response');
        return r.text();
      })
      .then((text) => {
        setRawMetrics(text);
        setMetricsError(false);
        setLastUpdated(new Date());
      })
      .catch(() => {
        setMetricsError(true);
        setLastUpdated(new Date());
      });
  }, []);

  useEffect(() => {
    if (tab !== 'api') return;
    loadRawMetrics();
    const id = setInterval(loadRawMetrics, 10000);
    return () => clearInterval(id);
  }, [tab, loadRawMetrics]);

  return (
    <PageLayout>
      <PageBody className="flex flex-col gap-4 !p-4 md:!p-5 min-h-0">
        <div className="shrink-0">
          <p className="text-xs text-neutral-500">
            Live rates from the dashboard WebSocket, plus Grafana / Prometheus embeds.
          </p>
        </div>

        <MetricsStatCards />

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {TAB_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {t.label}
            </button>
          ))}
          {tab === 'api' && (
            <button
              type="button"
              onClick={loadRawMetrics}
              className="flex items-center gap-1 px-2 py-1 border border-neutral-200 rounded-lg text-neutral-600 text-[10px] font-mono hover:bg-neutral-50"
            >
              <RefreshCw size={10} />
              {lastUpdated ? lastUpdated.toLocaleTimeString() : '…'}
            </button>
          )}
          <a
            href={current.externalHref}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-800"
          >
            Open {current.label} <ExternalLink size={12} />
          </a>
        </div>

        <div className="flex-1 min-h-[360px] rounded-xl border border-neutral-200 bg-white overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-neutral-100 shrink-0">
            <p className="text-xs text-neutral-500">{current.description}</p>
          </div>

          {tab === 'api' ? (
            <div className="flex-1 overflow-auto bg-neutral-950 p-4">
              {metricsError ? (
                <p className="text-xs text-rose-400 font-mono">
                  Could not reach /metrics — is API on :8000?
                </p>
              ) : (
                <pre className="text-[10px] leading-relaxed text-emerald-400/90 font-mono whitespace-pre-wrap">
                  {rawMetrics || 'Loading…'}
                </pre>
              )}
            </div>
          ) : (
            <iframe
              key={current.embedSrc}
              title={current.label}
              src={current.embedSrc}
              className="flex-1 w-full min-h-[320px] border-0 bg-neutral-50"
            />
          )}
        </div>
      </PageBody>
    </PageLayout>
  );
}
