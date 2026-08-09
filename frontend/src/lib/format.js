export function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

export function roundValue(value, decimals = 2) {
  if (value === undefined || value === null) return 0;
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

export function pushThroughputPoint(prev, ingestion, filtered) {
  const point = {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ingestion,
    filtered,
  };
  return [...prev, point].slice(-60);
}
