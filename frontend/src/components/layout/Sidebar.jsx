import { Activity } from 'lucide-react';
import { NAV_ITEMS } from '../../config/navigation';

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside
      className="group/sidebar shrink-0 flex flex-col bg-white border-r border-neutral-200
        w-[4.25rem] hover:w-56 transition-[width] duration-200 ease-out overflow-hidden"
    >
      <div className="flex items-center gap-3 px-3 py-4 border-b border-neutral-100 min-h-[4.25rem]">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
          <Activity size={20} />
        </div>
        <div className="min-w-0 opacity-0 -translate-x-2 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 transition-all duration-200 delay-75">
          <p className="text-sm font-semibold text-neutral-900 truncate">StreamForge</p>
          <p className="text-[10px] text-neutral-400 font-mono truncate">Console</p>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              title={item.label}
              className={`relative w-full flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors ${
                active
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-neutral-900 rounded-r-full" />
              )}
              <Icon size={20} className="shrink-0 mx-0.5" strokeWidth={active ? 2.25 : 1.75} />
              <span
                className="min-w-0 flex-1 text-left opacity-0 -translate-x-2 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 transition-all duration-200 delay-75"
              >
                <span className="block text-sm font-medium leading-tight truncate">{item.label}</span>
                {!item.ready && (
                  <span className="block text-[10px] text-neutral-400 mt-0.5 truncate">Coming soon</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div
        className="px-3 py-3 border-t border-neutral-100 text-[10px] text-neutral-400 font-mono leading-relaxed
          opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200"
      >
        <span className="whitespace-nowrap">src/pages/</span>
      </div>
    </aside>
  );
}
