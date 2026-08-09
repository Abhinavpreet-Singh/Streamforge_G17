import { useState } from 'react';
import { AppProvider } from './context/AppProvider';
import AppShell from './components/layout/AppShell';
import { DEFAULT_PAGE } from './config/navigation';
import Overview from './pages/Overview';
import Fleet from './pages/Fleet';
import Pipeline from './pages/Pipeline';
import Operations from './pages/Operations';
import Metrics from './pages/Metrics';

export default function App() {
  const [activePage, setActivePage] = useState(DEFAULT_PAGE);
  const [metricsTab, setMetricsTab] = useState('grafana');

  const navigate = (page, tab) => {
    setActivePage(page);
    if (tab) setMetricsTab(tab);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <Overview />;
      case 'fleet': return <Fleet />;
      case 'pipeline': return <Pipeline />;
      case 'operations': return <Operations />;
      case 'metrics': return <Metrics tab={metricsTab} onTabChange={setMetricsTab} />;
      default: return <Overview />;
    }
  };

  return (
    <AppProvider>
      <AppShell activePage={activePage} metricsTab={metricsTab} onNavigate={navigate}>
        {renderPage()}
      </AppShell>
    </AppProvider>
  );
}
