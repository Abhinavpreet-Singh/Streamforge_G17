/** Grafana & Prometheus — embed the real origins (not the Vite subpath proxy).
 *  Proxying /grafana rewrites the path, so Grafana's /public/*.js 404 on :5173
 *  and the iframe shows "failed to load its application files".
 */

const GRAFANA_DASH = '/d/streamforge-api';

export const GRAFANA_URL = `http://localhost:3001${GRAFANA_DASH}`;
export const PROMETHEUS_URL = 'http://localhost:9090/targets';

export const OBS_TABS = {
  grafana: {
    id: 'grafana',
    label: 'Grafana',
    description: 'Live charts from Prometheus',
    embedSrc: `${GRAFANA_URL}?orgId=1&theme=light&kiosk`,
    externalHref: GRAFANA_URL,
  },
  prometheus: {
    id: 'prometheus',
    label: 'Prometheus',
    description: 'Scrape targets and query UI',
    embedSrc: PROMETHEUS_URL,
    externalHref: PROMETHEUS_URL,
  },
  api: {
    id: 'api',
    label: 'API /metrics',
    description: 'Raw Prometheus exposition from FastAPI',
    embedSrc: null,
    externalHref: '/metrics',
  },
};
