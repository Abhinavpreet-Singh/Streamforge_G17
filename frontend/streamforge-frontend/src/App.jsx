import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Activity, Users, Boxes, Clock, Bell, Search, Server, Database, Filter as FilterIcon,
  ArrowRight, AlertTriangle, CheckCircle2, PlayCircle, Radio, Truck, MapPinned,
  Thermometer, ShieldAlert,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Sidebar from './components/Sidebar';
import TopologyDag from './components/TopologyDag';
import FleetMap from './components/FleetMap';
import {
  TOKENS as T, DEFAULT_CONFIG, ENDPOINTS, makeWorkers, makeTrucks, computePartitions,
  fmt, timeStr, fmtUptime, statusLabel, statusColor,
} from './lib/simulation';
import './App.css';

const PAGES = {
  overview:   { label: 'Overview',   title: 'Overview Dashboard', subtitle: 'Real-time overview of your stream processing infrastructure' },
  topology:   { label: 'Topology',   title: 'Stream Topology',    subtitle: 'Kafka (Avro + Schema Registry) → Faust/Bytewax → RocksDB, changelog-backed' },
  fleet:      { label: 'Fleet Map',  title: 'Digital Fleet Twin', subtitle: 'Live positions and cold-chain temperature for the simulated truck fleet' },
  workers:    { label: 'Workers',    title: 'Worker Nodes',       subtitle: 'Detailed health, resource usage and partition ownership per worker' },
  partitions: { label: 'Partitions', title: 'Kafka Partitions',   subtitle: '32 partitions across the truck-telemetry topic' },
  metrics:    { label: 'Metrics',    title: 'Metrics',            subtitle: 'Cluster-wide throughput, latency and load distribution' },
  events:     { label: 'Events',     title: 'Event Log',          subtitle: 'Raw stream of worker-status, rebalance and cold-chain events' },
  alerts:     { label: 'Alerts',     title: 'Alerts',             subtitle: 'Active and historical alerts across infrastructure and fleet' },
  settings:   { label: 'Settings',  title: 'Settings',           subtitle: 'Connection, simulation and threshold configuration' },
};

const CHAIN = [
  { icon: Radio, t: 'Kafka', s: '32 partitions · Avro' },
  { icon: FilterIcon, t: 'Filter', s: 'temp > 0' },
  { icon: ArrowRight, t: 'Map', s: 'normalize' },
  { icon: Clock, t: '5 Min Window', s: 'rolling avg' },
  { icon: Database, t: 'RocksDB', s: 'state store' },
];

function lagColor(ms, thresh) { return ms > thresh.lagBad ? T.red : ms > thresh.lagWarn ? T.amber : T.text2; }
function cpuColor(v, thresh) { return v > thresh.cpuBad ? T.red : v > thresh.cpuWarn ? T.amber : T.blue; }

function StatusChip({ status }) {
  const c = statusColor(status);
  return (
    <span className="status-chip" style={{ color: c }}>
      <i className={`dot${status === 'rebalanced' ? ' pulse' : ''}`} style={{ background: c }} />
      {statusLabel(status)}
    </span>
  );
}
function MiniBar({ pct, color }) {
  return (
    <div className="bar-cell">
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <span className="bar-pct">{Math.round(pct)}%</span>
    </div>
  );
}
function KpiCard({ label, value, unit, icon: Icon, color, delta, valueColor, spark }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon" style={{ background: `${color}22`, color }}><Icon size={16} /></span>
      </div>
      <div className="kpi-value-row">
        <div className="kpi-value mono" style={valueColor ? { color: valueColor } : undefined}>{value}<span className="kpi-unit">{unit}</span></div>
        {spark}
      </div>
      <div className="kpi-delta">{delta}</div>
    </div>
  );
}
function Sparkline({ values, color }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = (max - min) || 1;
  const w = 90, h = 30, step = w / (values.length - 1);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - ((v - min) / range) * h}`).join(' ');
  return <svg width={90} height={34} viewBox={`0 0 ${w} ${h + 4}`}><path d={d} fill="none" stroke={color} strokeWidth={2} /></svg>;
}
function AlertRow({ a, onAck }) {
  const Icon = a.kind === 'red' ? AlertTriangle : a.kind === 'amber' ? Clock : a.kind === 'green' ? CheckCircle2 : PlayCircle;
  const colorMap = { red: T.red, amber: T.amber, green: T.green, blue: T.blue };
  const c = colorMap[a.kind];
  return (
    <div className={`alert-row${a.acked ? ' acked' : ''}`}>
      <div className="alert-icon" style={{ background: `${c}22`, color: c }}><Icon size={14} /></div>
      <div className="alert-body">
        <div className="alert-title" style={{ color: c }}>{a.title}</div>
        <div className="alert-sub">{a.sub}</div>
      </div>
      <div className="alert-time mono">{timeStr(a.time)}</div>
      {onAck && <button className="ack-btn" disabled={a.acked} onClick={onAck}>{a.acked ? 'Acked' : 'Ack'}</button>}
    </div>
  );
}
function TopoChain() {
  return (
    <div className="topo-chain">
      {CHAIN.map((n, i) => (
        <div key={n.t} style={{ display: 'contents' }}>
          {i > 0 && <div className="topo-arrow"><ArrowRight size={16} /></div>}
          <div className="topo-node">
            <div className="ti"><n.icon size={16} /></div>
            <div className="tt">{n.t}</div>
            <div className="ts">{n.s}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function chartTooltipStyle() { return { background: T.bgPanelRaised, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 11, fontFamily: 'IBM Plex Mono' }; }
function ThroughputArea({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs><linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.cyan} stopOpacity={0.35} /><stop offset="100%" stopColor={T.cyan} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke={T.lineSoft} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: T.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: T.lineSoft }} tickLine={false} minTickGap={30} />
        <YAxis tick={{ fill: T.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: T.text2 }} />
        <Area type="monotone" dataKey="throughput" stroke={T.cyan} strokeWidth={2} fill="url(#tGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
function LagArea({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs><linearGradient id="lGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.violet} stopOpacity={0.35} /><stop offset="100%" stopColor={T.violet} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke={T.lineSoft} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: T.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: T.lineSoft }} tickLine={false} minTickGap={30} />
        <YAxis tick={{ fill: T.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={30} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: T.text2 }} />
        <Area type="monotone" dataKey="lag" stroke={T.violet} strokeWidth={2} fill="url(#lGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
function PartitionDonut({ assigned, standby, unassigned }) {
  const data = [{ name: 'Assigned', value: assigned, color: T.green }, { name: 'Standby', value: standby, color: T.blue }, { name: 'Unassigned', value: unassigned, color: T.amber }];
  return (
    <ResponsiveContainer width={150} height={150}>
      <PieChart><Pie data={data} dataKey="value" innerRadius={54} outerRadius={72} paddingAngle={2} stroke="none">{data.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie></PieChart>
    </ResponsiveContainer>
  );
}
function LatencyBars({ p50, p95, p99 }) {
  const data = [{ name: 'p50', v: p50, color: T.cyan }, { name: 'p95', v: p95, color: T.amber }, { name: 'p99', v: p99, color: T.red }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={T.lineSoft} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: T.text3, fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: T.lineSoft }} tickLine={false} />
        <YAxis tick={{ fill: T.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: T.text2 }} />
        <Bar dataKey="v" radius={[6, 6, 0, 0]} maxBarSize={60}>{data.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
function WorkerLoadBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={T.lineSoft} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: T.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} axisLine={{ stroke: T.lineSoft }} tickLine={false} />
        <YAxis tick={{ fill: T.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: T.text2 }} />
        <Bar dataKey="v" fill={T.blue} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('overview');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [thresh, setThresh] = useState({ lagWarn: 150, lagBad: 400, cpuWarn: 55, cpuBad: 75, tempWarn: 38, tempBad: 42 });
  const [modeIsLive, setModeIsLive] = useState(false);
  const [connResult, setConnResult] = useState(null);

  const [workers, setWorkers] = useState(() => makeWorkers(DEFAULT_CONFIG.workerCount));
  const [trucks, setTrucks] = useState(() => makeTrucks(360));
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([{ time: new Date(), kind: 'blue', title: 'Dashboard connected', sub: 'Streaming live metrics from cluster', acked: false }]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [rebalanceCount, setRebalanceCount] = useState(0);
  const bootTime = useRef(Date.now());

  const [workerSearch, setWorkerSearch] = useState('');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('all');
  const [partitionSearch, setPartitionSearch] = useState('');
  const [eventsFilter, setEventsFilter] = useState('all');
  const [alertsFilter, setAlertsFilter] = useState('all');

  const addAlert = useCallback((kind, title, sub) => {
    setAlerts(prev => [{ time: new Date(), kind, title, sub, acked: false }, ...prev].slice(0, 120));
  }, []);

  const killWorker = useCallback((id) => {
    setWorkers(prev => prev.map(w => (w.id === id && w.status === 'healthy')
      ? { ...w, status: 'failed', recoverAt: Date.now() + 3000, lastHeartbeat: Date.now() }
      : w));
    addAlert('red', `${id} unavailable`, 'Heartbeat timeout detected');
  }, [addAlert]);

  const ackAlert = useCallback((idx) => {
    setAlerts(prev => prev.map((a, i) => (i === idx ? { ...a, acked: true } : a)));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      let totalThroughput = 0, totalLag = 0, healthy = 0;
      setWorkers(prev => prev.map(w => {
        if (w.status === 'healthy') {
          const eventsPerSec = Math.max(3800, w.eventsPerSec + (Math.random() - 0.5) * 300);
          const lagMs = Math.max(6, w.lagMs + (Math.random() - 0.5) * 3);
          totalThroughput += eventsPerSec; totalLag += lagMs; healthy++;
          return { ...w, eventsPerSec, lagMs, cpu: Math.min(70, Math.max(12, w.cpu + (Math.random() - 0.5) * 3)), mem: Math.min(80, Math.max(30, w.mem + (Math.random() - 0.5) * 2)), lastHeartbeat: Date.now() };
        }
        if (w.status === 'failed') {
          if (Date.now() > w.recoverAt) {
            setRebalanceCount(c => c + 1);
            addAlert('amber', 'Partition rebalancing', `Partition ${w.partitions.join(', ')} reassigned to standby worker`);
            setTimeout(() => {
              setWorkers(p2 => p2.map(x => (x.id === w.id ? { ...x, status: 'healthy', lagMs: 10, cpu: 20, mem: 42, lastHeartbeat: Date.now() } : x)));
              addAlert('green', 'State recovered', 'RocksDB state restored successfully');
              setTimeout(() => addAlert('blue', 'Processing resumed', `Partition ${w.partitions.join(', ')} processing is operational`), 900);
            }, 2200);
            return { ...w, status: 'rebalanced', eventsPerSec: 0, cpu: 0, mem: 0 };
          }
          return { ...w, eventsPerSec: 0, cpu: 0, mem: 0 };
        }
        return w;
      }));

      setHistory(prev => [...prev, { ts: Date.now(), label: new Date().toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' }), throughput: totalThroughput, lag: healthy ? totalLag / healthy : 0 }].slice(-40));
      setTotalEvents(prev => prev + totalThroughput * (config.pollMs / 1000));

      setTrucks(prev => prev.map(tk => {
        let { x, y, temp, breach, breachTicks } = tk;
        x = Math.min(0.98, Math.max(0.02, x + (Math.random() - 0.5) * 0.01));
        y = Math.min(0.96, Math.max(0.04, y + (Math.random() - 0.5) * 0.01));
        if (breach) {
          breachTicks -= 1;
          temp = temp + (Math.random() - 0.35) * 0.6;
          if (breachTicks <= 0) { breach = false; temp = 34 + Math.random() * 4; }
        } else {
          temp = Math.max(30, temp + (Math.random() - 0.5) * 0.5);
          if (Math.random() < 0.0009) {
            breach = true; breachTicks = 10 + Math.floor(Math.random() * 10); temp = 43 + Math.random() * 4;
            addAlert('red', `Truck #${tk.id} cold-chain breach`, `Reefer temperature ${temp.toFixed(1)}°F exceeds safe threshold`);
          }
        }
        return { ...tk, x, y, temp, breach, breachTicks };
      }));
    }, config.pollMs);
    return () => clearInterval(id);
  }, [config.pollMs, addAlert]);

  const healthyCount = workers.filter(w => w.status === 'healthy').length;
  const totalThroughput = workers.reduce((s, w) => s + (w.status === 'healthy' ? w.eventsPerSec : 0), 0);
  const avgLag = healthyCount ? workers.filter(w => w.status === 'healthy').reduce((s, w) => s + w.lagMs, 0) / healthyCount : 0;
  const partitions = useMemo(() => computePartitions(workers), [workers]);
  const partCounts = useMemo(() => ({ assigned: partitions.filter(p => p.role === 'assigned').length, standby: partitions.filter(p => p.role === 'standby').length, unassigned: partitions.filter(p => p.role === 'unassigned').length }), [partitions]);
  const unackedCount = alerts.filter(a => !a.acked).length;
  const breachCount = trucks.filter(t => t.breach).length;
  const avgTruckTemp = trucks.length ? trucks.reduce((s, t) => s + t.temp, 0) / trucks.length : 0;
  const lags = workers.filter(w => w.status === 'healthy').map(w => w.lagMs).sort((a, b) => a - b);
  const pct = p => (lags.length ? lags[Math.min(lags.length - 1, Math.floor(lags.length * p))] : 0);
  const p50 = pct(0.5), p95 = pct(0.95), p99 = pct(0.99);
  const rebalanceRate = rebalanceCount / Math.max(1, (Date.now() - bootTime.current) / 60000);

  const testConnection = async () => {
    setConnResult({ status: 'checking', text: `Checking ${config.apiBase}/health …` });
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(config.apiBase + '/health', { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(String(res.status));
      setConnResult({ status: 'ok', text: `Connected — ${config.apiBase} responded OK. Switching to live data.` });
      setModeIsLive(true);
    } catch {
      setConnResult({ status: 'fail', text: `Could not reach ${config.apiBase} — staying on demo data. Start your FastAPI backend and try again.` });
      setModeIsLive(false);
    }
  };

  const goTo = (id) => setActivePage(id);
  const navCount = (id) => {
    if (id === 'workers') return workers.length;
    if (id === 'alerts') return unackedCount || '';
    if (id === 'partitions') return 32;
    if (id === 'fleet') return breachCount || '';
    return '';
  };

  return (
    <div className="app-root">
      <div className="app-shell">
        <Sidebar
          pages={PAGES}
          activePage={activePage}
          onNavigate={goTo}
          navCount={navCount}
          clusterHealthy={healthyCount === workers.length}
          healthyCount={healthyCount}
          totalWorkers={workers.length}
          truckCount={trucks.length}
          breachCount={breachCount}
        />

        <main className="content">
          <div className="topbar">
            <div>
              <h1>{PAGES[activePage].title}</h1>
              <p>{PAGES[activePage].subtitle}</p>
            </div>
            <div className="top-right">
              <div className={`health-pill ${avgLag > thresh.lagBad ? 'warn' : 'ok'}`}>
                <i style={{ background: avgLag > thresh.lagBad ? T.amber : T.green }} />
                {avgLag > thresh.lagBad ? 'DEGRADED' : 'SYSTEM HEALTHY'}
              </div>
              <div className="icon-btn">
                <Bell size={16} />
                {unackedCount > 0 && <span className="badge">{unackedCount > 9 ? '9+' : unackedCount}</span>}
              </div>
              <div className="time-pill mono">
                <Clock size={13} color={T.text3} /> {new Date().toLocaleTimeString('en-US', { hour12: true })}
              </div>
            </div>
          </div>

          {activePage === 'overview' && (
            <div className="fade-in">
              <div className="kpi-row">
                <KpiCard label="Events / Sec" value={fmt(totalThroughput)} unit="" icon={Activity} color={T.cyan} delta="Live · updates each tick" spark={<Sparkline values={history.slice(-14).map(h => h.throughput)} color={T.cyan} />} />
                <KpiCard label="Active Workers" value={healthyCount} unit={`/ ${workers.length}`} icon={Users} color={T.green} delta={`${Math.round((healthyCount / workers.length) * 100)}% active`} />
                <KpiCard label="Kafka Partitions" value="32" unit="" icon={Boxes} color={T.blue} delta={`${partCounts.assigned} assigned · ${partCounts.standby} standby · ${partCounts.unassigned} unassigned`} />
                <KpiCard label="Processing Lag" value={Math.round(avgLag)} unit="ms" icon={Clock} color={T.amber} delta={avgLag > thresh.lagBad ? 'Above critical threshold' : avgLag > thresh.lagWarn ? 'Above warning threshold' : 'Within normal range'} valueColor={avgLag > thresh.lagBad ? T.red : avgLag > thresh.lagWarn ? T.amber : undefined} />
              </div>

              <div className="row-2" style={{ marginBottom: 14 }}>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-head"><span className="panel-title">Stream Processing Topology</span><button className="panel-link" onClick={() => goTo('topology')}>View full topology →</button></div>
                  <div className="topo-body">
                    <TopoChain />
                    <div className="worker-strip">
                      {workers.slice(0, 5).map(w => (
                        <div key={w.id} className={`wnode ${w.status}`} onClick={() => goTo('workers')}>
                          <div className="wnode-top"><Server size={14} color={T.text3} />{w.id.replace('Worker-', 'Worker #')}</div>
                          <StatusChip status={w.status} />
                        </div>
                      ))}
                      <div className="wnode more" onClick={() => goTo('workers')}>... {Math.max(0, workers.length - 5)} more</div>
                    </div>
                  </div>
                </div>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-head"><span className="panel-title">Alerts</span><button className="panel-link" onClick={() => goTo('alerts')}>View all →</button></div>
                  <div className="alerts-list" style={{ maxHeight: 340 }}>
                    {alerts.slice(0, 6).map((a, i) => <AlertRow key={i} a={a} />)}
                  </div>
                </div>
              </div>

              <div className="row-3" style={{ marginBottom: 14 }}>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-head"><span className="panel-title">Processing Throughput</span><span className="mono" style={{ fontSize: 11, color: T.text2 }}>Last 30 min</span></div>
                  <div className="chart-body"><ThroughputArea data={history} /></div>
                  <div className="chart-legend"><i style={{ background: T.cyan }} /> Events / sec</div>
                </div>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-head"><span className="panel-title">Processing Lag (ms)</span><span className="mono" style={{ fontSize: 11, color: T.text2 }}>Last 30 min</span></div>
                  <div className="chart-body"><LagArea data={history} /></div>
                  <div className="chart-legend"><i style={{ background: T.violet }} /> Processing lag</div>
                </div>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-head"><span className="panel-title">Kafka Partitions</span><button className="panel-link" onClick={() => goTo('partitions')}>View all →</button></div>
                  <div className="donut-body">
                    <div className="donut-wrap">
                      <PartitionDonut assigned={partCounts.assigned} standby={partCounts.standby} unassigned={partCounts.unassigned} />
                      <div className="donut-center"><div className="n">32</div><div className="l">Total</div></div>
                    </div>
                    <div className="donut-legend">
                      {[['Assigned', T.green, partCounts.assigned], ['Standby', T.blue, partCounts.standby], ['Unassigned', T.amber, partCounts.unassigned]].map(([label, c, n]) => (
                        <div key={label} className="dl-row"><span className="dl-dot" style={{ background: c }} /><span className="dl-label">{label}</span><span className="dl-count">{n}</span><span className="dl-pct">{Math.round((n / 32) * 100)}%</span></div>
                      ))}
                      <div className="rebalance-stat">
                        <div className="rl">Rebalance Rate</div>
                        <div className="rv">{rebalanceRate.toFixed(2)}<span className="ru"> rebalance/min</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-head">
                  <span className="panel-title">Worker Nodes</span>
                  <div className="search-box"><Search size={14} color={T.text3} /><input placeholder="Search workers..." value={workerSearch} onChange={e => setWorkerSearch(e.target.value)} /></div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Worker ID</th><th>Status</th><th>Partitions</th><th>Events / Sec</th><th>Processing Lag (ms)</th><th>CPU</th><th>Memory</th><th>Uptime</th><th>Last Heartbeat</th><th></th></tr></thead>
                    <tbody>
                      {workers.filter(w => w.id.toLowerCase().includes(workerSearch.toLowerCase())).map(w => (
                        <tr key={w.id}>
                          <td style={{ fontWeight: 600 }}>{w.id}</td>
                          <td><StatusChip status={w.status} /></td>
                          <td className="mono">{w.partitions.join(', ')}</td>
                          <td className="mono">{w.status === 'failed' ? '0' : Math.round(w.eventsPerSec).toLocaleString()}</td>
                          <td className="mono" style={{ color: w.status === 'failed' ? T.text3 : lagColor(w.lagMs, thresh) }}>{w.status === 'failed' ? '–' : Math.round(w.lagMs)}</td>
                          <td><MiniBar pct={w.cpu} color={cpuColor(w.cpu, thresh)} /></td>
                          <td><MiniBar pct={w.mem} color={T.violet} /></td>
                          <td className="mono" style={{ color: T.text2 }}>{w.status === 'failed' ? '—' : fmtUptime(w.uptimeMin)}</td>
                          <td className="mono" style={{ color: w.status === 'failed' ? T.red : T.text2 }}>{timeStr(new Date(w.lastHeartbeat))}</td>
                          <td><button className="kill-btn" onClick={() => killWorker(w.id)} disabled={w.status !== 'healthy'}>Kill</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'topology' && (
            <div className="fade-in">
              <div className="metric-cards">
                <div className="kpi-card"><div className="kpi-label">Topic</div><div className="kpi-value mono" style={{ fontSize: 16 }}>truck-telemetry</div><div className="kpi-delta">1 topic · 32 partitions · Avro + Schema Registry</div></div>
                <div className="kpi-card"><div className="kpi-label">Workers</div><div className="kpi-value">{workers.length}</div><div className="kpi-delta">consumer group: streamforge-workers</div></div>
                <div className="kpi-card"><div className="kpi-label">Replication</div><div className="kpi-value">3x</div><div className="kpi-delta">changelog-backed to RocksDB</div></div>
                <div className="kpi-card"><div className="kpi-label">Rebalances (session)</div><div className="kpi-value">{rebalanceCount}</div><div className="kpi-delta">since dashboard connected</div></div>
              </div>
              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-head"><span className="panel-title">Full Streaming DAG</span><span className="mono" style={{ fontSize: 11, color: T.text3 }}>drag to pan · scroll to zoom</span></div>
                <div className="topo-body">
                  <TopoChain />
                  <TopologyDag workers={workers} />
                </div>
              </div>
            </div>
          )}

          {activePage === 'fleet' && (
            <div className="fade-in">
              <div className="kpi-row">
                <KpiCard label="Simulated Fleet" value="50,000" unit="" icon={Truck} color={T.blue} delta="sending temp/id/timestamp every 10s" />
                <KpiCard label="Twin Sample Size" value={trucks.length} unit="trucks" icon={MapPinned} color={T.cyan} delta="rendered live on this map" />
                <KpiCard label="Avg Reefer Temp" value={avgTruckTemp.toFixed(1)} unit="°F" icon={Thermometer} color={T.violet} delta={`safe range up to ${thresh.tempWarn}°F`} />
                <KpiCard label="Cold-Chain Breaches" value={breachCount} unit="" icon={ShieldAlert} color={breachCount > 0 ? T.red : T.green} delta={breachCount > 0 ? 'active — check Alerts' : 'no active breaches'} valueColor={breachCount > 0 ? T.red : undefined} />
              </div>
              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-head">
                  <span className="panel-title">Digital Fleet Twin</span>
                  <div className="fleet-legend">
                    <span><i style={{ width: 7, height: 7, borderRadius: '50%', background: T.cyan, display: 'inline-block' }} />nominal</span>
                    <span><i style={{ width: 7, height: 7, borderRadius: '50%', background: T.amber, display: 'inline-block' }} />warm</span>
                    <span><i style={{ width: 7, height: 7, borderRadius: '50%', background: T.red, display: 'inline-block' }} />breach</span>
                  </div>
                </div>
                <div style={{ padding: 16 }}><FleetMap trucks={trucks} tempWarn={thresh.tempWarn} /></div>
              </div>
            </div>
          )}

          {activePage === 'workers' && (
            <div className="fade-in panel" style={{ marginBottom: 0 }}>
              <div className="panel-head">
                <span className="panel-title">All Worker Nodes</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="filter-tabs">
                    {['all', 'healthy', 'rebalanced', 'failed'].map(s => (
                      <button key={s} className={`ftab${workerStatusFilter === s ? ' active' : ''}`} onClick={() => setWorkerStatusFilter(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
                    ))}
                  </div>
                  <div className="search-box"><Search size={14} color={T.text3} /><input placeholder="Search workers..." value={workerSearch} onChange={e => setWorkerSearch(e.target.value)} /></div>
                </div>
              </div>
              <div className="workers-grid">
                {workers.filter(w => w.id.toLowerCase().includes(workerSearch.toLowerCase()) && (workerStatusFilter === 'all' || w.status === workerStatusFilter)).map(w => (
                  <div key={w.id} className="wcard" style={{ borderColor: w.status === 'failed' ? 'rgba(240,82,82,0.4)' : w.status === 'rebalanced' ? 'rgba(245,166,35,0.4)' : T.line }}>
                    <div className="wcard-head">
                      <div className="wcard-id"><Server size={14} color={T.text3} />{w.id}</div>
                      <StatusChip status={w.status} />
                    </div>
                    <div className="wcard-parts">partitions {w.partitions.join(', ')}</div>
                    <div className="wcard-metrics">
                      <div><div className="wm-label">Events/sec</div><div className="wm-value">{w.status === 'failed' ? '0' : Math.round(w.eventsPerSec).toLocaleString()}</div></div>
                      <div><div className="wm-label">Lag</div><div className="wm-value" style={{ color: w.status === 'failed' ? T.text3 : lagColor(w.lagMs, thresh) }}>{w.status === 'failed' ? '–' : Math.round(w.lagMs) + 'ms'}</div></div>
                      <div><div className="wm-label">CPU</div><MiniBar pct={w.cpu} color={cpuColor(w.cpu, thresh)} /></div>
                      <div><div className="wm-label">Memory</div><MiniBar pct={w.mem} color={T.violet} /></div>
                    </div>
                    <div className="wcard-foot">
                      <span className="wcard-hb">heartbeat {timeStr(new Date(w.lastHeartbeat))}</span>
                      <button className="kill-btn" onClick={() => killWorker(w.id)} disabled={w.status !== 'healthy'}>Kill</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePage === 'partitions' && (
            <div className="fade-in">
              <div className="metric-cards">
                <div className="kpi-card"><div className="kpi-label">Total Partitions</div><div className="kpi-value">32</div></div>
                <div className="kpi-card"><div className="kpi-label">Assigned</div><div className="kpi-value" style={{ color: T.green }}>{partCounts.assigned}</div></div>
                <div className="kpi-card"><div className="kpi-label">Standby</div><div className="kpi-value" style={{ color: T.blue }}>{partCounts.standby}</div></div>
                <div className="kpi-card"><div className="kpi-label">Unassigned</div><div className="kpi-value" style={{ color: T.amber }}>{partCounts.unassigned}</div></div>
              </div>
              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-head">
                  <span className="panel-title">Partition Assignment</span>
                  <div className="search-box"><Search size={14} color={T.text3} /><input placeholder="Search partitions or workers..." value={partitionSearch} onChange={e => setPartitionSearch(e.target.value)} /></div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Partition</th><th>Role</th><th>Owner Worker</th><th>Replica Worker</th><th>Lag (ms)</th><th>Events / Sec</th></tr></thead>
                    <tbody>
                      {partitions.filter(p => `partition ${p.id}`.includes(partitionSearch.toLowerCase()) || (p.owner || '').toLowerCase().includes(partitionSearch.toLowerCase()) || (p.replica || '').toLowerCase().includes(partitionSearch.toLowerCase())).map(p => {
                        const ownerHealthy = p.ownerRef && p.ownerRef.status === 'healthy';
                        const roleColor = p.role === 'unassigned' ? T.amber : p.role === 'standby' ? T.blue : ownerHealthy ? T.green : T.amber;
                        const roleText = p.role === 'unassigned' ? 'Unassigned' : p.role === 'standby' ? 'Standby' : ownerHealthy ? 'Assigned' : 'Reassigning';
                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }} className="mono">P-{String(p.id).padStart(2, '0')}</td>
                            <td><span className="status-chip" style={{ color: roleColor }}><i className="dot" style={{ background: roleColor }} />{roleText}</span></td>
                            <td className="mono">{p.owner || <span style={{ color: T.text3 }}>—</span>}</td>
                            <td className="mono">{p.replica || <span style={{ color: T.text3 }}>—</span>}</td>
                            <td className="mono" style={{ color: p.ownerRef ? lagColor(p.ownerRef.lagMs, thresh) : T.text3 }}>{p.ownerRef ? Math.round(p.ownerRef.lagMs) : '–'}</td>
                            <td className="mono">{p.ownerRef ? Math.round(p.ownerRef.eventsPerSec / Math.max(1, p.ownerRef.partitions.length)).toLocaleString() : '–'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'metrics' && (
            <div className="fade-in">
              <div className="metric-cards">
                <KpiCard label="Total Events Processed" value={fmt(totalEvents)} unit="" icon={Activity} color={T.cyan} delta="since dashboard connected" />
                <KpiCard label="p50 Latency" value={Math.round(p50)} unit="ms" icon={Clock} color={T.cyan} delta="median across healthy workers" />
                <KpiCard label="p95 Latency" value={Math.round(p95)} unit="ms" icon={Clock} color={T.amber} delta="95th percentile" />
                <KpiCard label="p99 Latency" value={Math.round(p99)} unit="ms" icon={Clock} color={T.red} delta="99th percentile" />
              </div>
              <div className="row-half" style={{ marginBottom: 14 }}>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-head"><span className="panel-title">Throughput — Full Window</span></div>
                  <div className="chart-body lg"><ThroughputArea data={history} /></div>
                </div>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-head"><span className="panel-title">Latency Percentiles</span></div>
                  <div className="chart-body lg"><LatencyBars p50={p50} p95={p95} p99={p99} /></div>
                </div>
              </div>
              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-head"><span className="panel-title">Events / Sec by Worker (top 12)</span></div>
                <div className="chart-body lg">
                  <WorkerLoadBars data={[...workers].sort((a, b) => b.eventsPerSec - a.eventsPerSec).slice(0, 12).map(w => ({ name: w.id.replace('Worker-', 'w'), v: Math.round(w.eventsPerSec) }))} />
                </div>
              </div>
            </div>
          )}

          {activePage === 'events' && (
            <div className="fade-in panel" style={{ marginBottom: 0 }}>
              <div className="panel-head">
                <span className="panel-title">Raw Event Stream</span>
                <div className="filter-tabs">
                  {[['all', 'All'], ['red', 'Critical'], ['amber', 'Warning'], ['green', 'Resolved'], ['blue', 'Info']].map(([id, label]) => (
                    <button key={id} className={`ftab${eventsFilter === id ? ' active' : ''}`} onClick={() => setEventsFilter(id)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="alerts-list" style={{ maxHeight: 560 }}>
                {alerts.filter(a => eventsFilter === 'all' || a.kind === eventsFilter).map((a, i) => <AlertRow key={i} a={a} />)}
                {alerts.filter(a => eventsFilter === 'all' || a.kind === eventsFilter).length === 0 && <div style={{ padding: 24, color: T.text3, fontSize: 12.5 }}>No events match this filter.</div>}
              </div>
            </div>
          )}

          {activePage === 'alerts' && (
            <div className="fade-in panel" style={{ marginBottom: 0 }}>
              <div className="panel-head">
                <span className="panel-title">All Alerts</span>
                <div className="filter-tabs">
                  {[['all', 'All'], ['red', 'Critical'], ['amber', 'Warning'], ['green', 'Resolved'], ['blue', 'Info']].map(([id, label]) => (
                    <button key={id} className={`ftab${alertsFilter === id ? ' active' : ''}`} onClick={() => setAlertsFilter(id)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="alerts-list" style={{ maxHeight: 560 }}>
                {alerts.map((a, i) => ({ a, i })).filter(({ a }) => alertsFilter === 'all' || a.kind === alertsFilter).map(({ a, i }) => <AlertRow key={i} a={a} onAck={() => ackAlert(i)} />)}
                {alerts.filter(a => alertsFilter === 'all' || a.kind === alertsFilter).length === 0 && <div style={{ padding: 24, color: T.text3, fontSize: 12.5 }}>No alerts match this filter.</div>}
              </div>
            </div>
          )}

          {activePage === 'settings' && (
            <div className="fade-in settings-grid">
              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-head"><span className="panel-title">Backend Connection</span></div>
                <div className="field">
                  <div className="field-label">Mode</div>
                  <div className="field-hint">Demo mode simulates the cluster locally. Live mode reads from your FastAPI backend.</div>
                  <div className="toggle-row">
                    <span className="mono" style={{ fontSize: 12.5 }}>{modeIsLive ? 'Live API (falls back to demo if unreachable)' : 'Demo data'}</span>
                    <div className={`switch${modeIsLive ? ' on' : ''}`} onClick={() => (modeIsLive ? setModeIsLive(false) : testConnection())}><div className="knob" /></div>
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">API base URL</div>
                  <div className="field-hint">REST endpoints are read from this base — see contract below</div>
                  <input className="field-input" value={config.apiBase} onChange={e => setConfig(c => ({ ...c, apiBase: e.target.value }))} />
                </div>
                <div className="field">
                  <div className="field-label">WebSocket URL</div>
                  <div className="field-hint">Live rebalance, worker-status and truck-telemetry events stream from here</div>
                  <input className="field-input" value={config.wsUrl} onChange={e => setConfig(c => ({ ...c, wsUrl: e.target.value }))} />
                </div>
                <div className="field">
                  <button className="btn primary" onClick={testConnection}>Test connection</button>
                  {connResult && <div className={`conn-result mono ${connResult.status}`}>{connResult.text}</div>}
                </div>
              </div>

              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-head"><span className="panel-title">Simulation &amp; Thresholds</span></div>
                <div className="field">
                  <div className="field-label">Worker count</div>
                  <div className="field-hint">Regenerates the demo cluster with a new worker count</div>
                  <div className="field-row">
                    <input type="range" min={4} max={40} step={1} value={config.workerCount}
                      onChange={e => setConfig(c => ({ ...c, workerCount: parseInt(e.target.value, 10) }))}
                      onMouseUp={e => { const n = parseInt(e.target.value, 10); setWorkers(makeWorkers(n)); addAlert('blue', 'Cluster resized', `Demo cluster regenerated with ${n} workers`); }}
                      onTouchEnd={e => { const n = parseInt(e.target.value, 10); setWorkers(makeWorkers(n)); addAlert('blue', 'Cluster resized', `Demo cluster regenerated with ${n} workers`); }} />
                    <span className="range-val mono">{config.workerCount}</span>
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">Poll / tick interval</div>
                  <div className="field-hint">How often the dashboard refreshes metrics</div>
                  <div className="field-row">
                    <input type="range" min={500} max={4000} step={100} value={config.pollMs} onChange={e => setConfig(c => ({ ...c, pollMs: parseInt(e.target.value, 10) }))} />
                    <span className="range-val mono">{config.pollMs}ms</span>
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">Lag warning threshold</div>
                  <div className="field-hint">Lag above this turns amber across every table and chart</div>
                  <div className="field-row">
                    <input type="range" min={20} max={300} step={10} value={thresh.lagWarn} onChange={e => setThresh(t => ({ ...t, lagWarn: parseInt(e.target.value, 10) }))} />
                    <span className="range-val mono">{thresh.lagWarn}ms</span>
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">Lag critical threshold</div>
                  <div className="field-hint">Lag above this turns red and marks system health degraded</div>
                  <div className="field-row">
                    <input type="range" min={100} max={800} step={20} value={thresh.lagBad} onChange={e => setThresh(t => ({ ...t, lagBad: parseInt(e.target.value, 10) }))} />
                    <span className="range-val mono">{thresh.lagBad}ms</span>
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">Cold-chain temp warning (°F)</div>
                  <div className="field-hint">Reefer readings above this render amber on the fleet twin</div>
                  <div className="field-row">
                    <input type="range" min={35} max={50} step={1} value={thresh.tempWarn} onChange={e => setThresh(t => ({ ...t, tempWarn: parseInt(e.target.value, 10) }))} />
                    <span className="range-val mono">{thresh.tempWarn}°F</span>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <div className="panel-head"><span className="panel-title">API contract expected by this frontend</span></div>
                <div style={{ padding: '8px 18px 18px' }}>
                  {ENDPOINTS.map(e => (
                    <div key={e.path} className="endpoint">
                      <span className={`verb ${e.verb.toLowerCase()}`}>{e.verb}</span>
                      <span className="mono">{e.path}</span>
                      <span style={{ color: T.text3, fontSize: 11 }}>— {e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
