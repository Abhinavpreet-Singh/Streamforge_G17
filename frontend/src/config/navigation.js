import {
  LayoutDashboard,
  MapPin,
  GitBranch,
  Settings2,
  BarChart3,
} from 'lucide-react';

export const NAV_ITEMS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Live dashboard: chart, map, DAG, chaos',
    description: 'Live dashboard: chart, map, DAG, live feed',
    icon: LayoutDashboard,
    ready: true,
  },
  {
    id: 'fleet',
    label: 'Fleet',
    description: 'Full map, truck list, truck detail drawer',
    icon: MapPin,
    ready: false,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    description: 'Topology DAG + stage docs from /topology',
    icon: GitBranch,
    ready: false,
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Workers, stack health, consumer lag, logs',
    icon: Settings2,
    ready: false,
    ready: true,
  },
  {
    id: 'metrics',
    label: 'Metrics',
    description: 'Prometheus cards + Grafana links',
    icon: BarChart3,
    ready: false,
    description: 'Grafana, Prometheus, and API metrics embedded',
    icon: BarChart3,
    ready: true,
  },
];

export const DEFAULT_PAGE = 'overview';
