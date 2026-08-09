/** Relative URLs — Vite dev server proxies to FastAPI on :8000 */

export function apiUrl(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

export function wsLiveUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/live`;
}
