import { Construction } from 'lucide-react';
import { NAV_ITEMS } from '../../config/navigation';

export default function PagePlaceholder({ pageId }) {
  const item = NAV_ITEMS.find((n) => n.id === pageId) ?? NAV_ITEMS[0];

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50">
      <div className="max-w-md w-full bg-white border border-neutral-200 rounded-xl p-8 text-center shadow-sm">
        <div className="inline-flex p-3 rounded-full bg-amber-50 text-amber-600 mb-4">
          <Construction size={28} />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">{item.label}</h2>
        <p className="text-sm text-neutral-600 mb-6">{item.description}</p>
        <div className="text-left bg-neutral-50 border border-neutral-100 rounded-lg p-4 text-xs font-mono space-y-2">
          <p>
            <span className="text-neutral-400">File: </span>
            <span className="text-neutral-800">src/pages/{capitalize(item.id)}.jsx</span>
          </p>
          <p>
            <span className="text-neutral-400">Tip: </span>
            <span className="text-neutral-600">Use useApp() from hooks/useApp.js for live data</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function capitalize(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}
