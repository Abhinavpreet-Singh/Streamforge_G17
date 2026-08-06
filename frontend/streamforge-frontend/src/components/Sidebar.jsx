import {
  LayoutGrid, GitBranch, Truck, Users, Boxes, Activity, ListChecks, Bell, Settings,
} from 'lucide-react';

const NAV_ICON = {
  overview: LayoutGrid, topology: GitBranch, fleet: Truck, workers: Users,
  partitions: Boxes, metrics: Activity, events: ListChecks, alerts: Bell, settings: Settings,
};

export default function Sidebar({ pages, activePage, onNavigate, navCount, clusterHealthy, healthyCount, totalWorkers, truckCount, breachCount }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" stroke="url(#brandGrad)" strokeWidth="2" />
          <path d="M11 21c2-6 8-6 10-12M11 21c1-3 1-6 0-9M21 9c-1 3-1 6 0 9" stroke="url(#brandGrad)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <defs>
            <linearGradient id="brandGrad" x1="0" y1="0" x2="32" y2="32">
              <stop stopColor="#38D6E0" /><stop offset="1" stopColor="#8B7FE8" />
            </linearGradient>
          </defs>
        </svg>
        <span className="brand-text">StreamForge</span>
      </div>

      <nav className="nav-list">
        {Object.entries(pages).map(([id, p]) => {
          const Icon = NAV_ICON[id];
          const count = navCount(id);
          return (
            <div key={id} className={`nav-item${activePage === id ? ' active' : ''}`} onClick={() => onNavigate(id)}>
              <Icon size={17} />
              <span>{p.label}</span>
              {count !== '' && <span className="nav-count">{count}</span>}
            </div>
          );
        })}
      </nav>

      <div className="cluster-card">
        <div className="cluster-label">Cluster Status</div>
        <div className="cluster-status" style={{ color: clusterHealthy ? 'var(--green)' : 'var(--amber)' }}>
          <i style={{ background: clusterHealthy ? 'var(--green)' : 'var(--amber)' }} />
          {clusterHealthy ? 'Healthy' : 'Degraded'}
        </div>
        <div className="cluster-row">{healthyCount} / {totalWorkers} workers active</div>
        <div className="cluster-row">Fleet: {truckCount} trucks · {breachCount} in breach</div>
        <div className="cluster-foot">
          <span className="cluster-avatar" /> StreamForge 1.0.0
        </div>
      </div>
    </aside>
  );
}
