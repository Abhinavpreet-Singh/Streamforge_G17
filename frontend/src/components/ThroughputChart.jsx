import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ThroughputChart({ history, currentRate }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-mono text-neutral-500 uppercase tracking-wide">Live Throughput</span>
        <span className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
          {currentRate ?? 0}
          <span className="text-sm font-normal text-neutral-400 ml-1">msg/s</span>
        </span>
      </div>
      <div className="h-[100px] w-full">
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-400 font-mono">
            Waiting for stream…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} width={32} />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                formatter={(v) => [`${v} msg/s`, undefined]}
              />
              <Area
                type="monotone"
                dataKey="ingestion"
                name="Ingestion"
                stroke="#10b981"
                fill="#10b98122"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="filtered"
                name="Filtered"
                stroke="#f59e0b"
                fill="#f59e0b22"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
