import Sidebar from './Sidebar';
import AppHeader from './AppHeader';

export default function AppShell({ activePage, onNavigate, children }) {
  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <AppHeader activePage={activePage} />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
