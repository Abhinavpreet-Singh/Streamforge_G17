import Sidebar from './Sidebar';
import AppHeader from './AppHeader';

export default function AppShell({ activePage, onNavigate, children }) {
  return (
    <div className="flex flex-col h-screen bg-neutral-50 overflow-hidden font-sans">
      <AppHeader />
      <div className="flex flex-1 min-h-0">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
