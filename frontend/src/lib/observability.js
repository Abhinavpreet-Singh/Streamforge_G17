/** Grafana & Prometheus URLs — proxied in dev via vite.config.js */

const GRAFANA_DASH = '/d/streamforge-api';

export const OBS_TABS = {
  grafana: {
    id: 'grafana',
    label: 'Grafana',
    description: 'Live charts from Prometheus',
    embedSrc: `/grafana${GRAFANA_DASH}?orgId=1&theme=light&kiosk`,
    externalHref: `http://localhost:3001${GRAFANA_DASH}`,
  },
  prometheus: {
    id: 'prometheus',
    label: 'Prometheus',
    description: 'Scrape targets and query UI',
    embedSrc: '/prometheus/targets',
    externalHref: 'http://localhost:9090/targets',
  },
  api: {
    id: 'api',
    label: 'API /metrics',
    description: 'Raw Prometheus exposition from FastAPI',
    embedSrc: null,
    externalHref: '/metrics',
  },
};
