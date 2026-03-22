/** Normalize API / Socket.IO base URLs (hostname-only Railway vars get https://). */
export function normalizeApiBase(url: string): string {
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t.replace(/\/+$/, '');
  const host = t.replace(/^\/+/, '').replace(/\/+$/, '');
  if (/^(localhost\b|127\.0\.0\.1)(?::|$)/i.test(host)) return `http://${host}`;
  return `https://${host}`;
}

let runtimeApi = '';
let runtimeWs = '';

/** Fetches `/api-config.json` from the static server (Railway runtime env). Call before rendering the app. */
export async function loadRuntimeApiEnv(): Promise<void> {
  try {
    const r = await fetch('/api-config.json', { cache: 'no-store' });
    if (!r.ok) return;
    const j = (await r.json()) as { apiUrl?: string; wsUrl?: string };
    if (typeof j.apiUrl === 'string' && j.apiUrl.trim()) runtimeApi = j.apiUrl.trim();
    if (typeof j.wsUrl === 'string' && j.wsUrl.trim()) runtimeWs = j.wsUrl.trim();
  } catch {
    /* dev server may not serve this route */
  }
}

export function resolvedApiBase(): string {
  return normalizeApiBase(runtimeApi || import.meta.env.VITE_API_URL || '');
}

export function resolvedWsBase(): string {
  const ws = normalizeApiBase(runtimeWs || import.meta.env.VITE_WS_URL || '');
  return ws || resolvedApiBase();
}

export function isApiEnvConfigured(): boolean {
  return Boolean(resolvedApiBase());
}
