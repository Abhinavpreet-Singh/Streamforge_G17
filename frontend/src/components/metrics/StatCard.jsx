export default function StatCard({ icon: Icon, label, value, unit, accent = 'neutral' }) {
  const accentMap = {
    neutral: 'text-neutral-900 bg-neutral-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
    sky: 'text-sky-600 bg-sky-50',
  };
  const colors = accentMap[accent] ?? accentMap.neutral;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{label}</span>
        {Icon && (
          <div className={`p-1.5 rounded-lg ${colors}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-neutral-900 font-mono">
        {value}
        {unit && <span className="text-sm font-normal text-neutral-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}