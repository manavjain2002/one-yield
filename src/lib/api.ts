import axios, { AxiosError } from 'axios';
import {
  loadRuntimeApiEnv,
  resolvedApiBase,
  isApiEnvConfigured,
} from './api-env';

const baseURL = resolvedApiBase();

export const api = axios.create({
  baseURL: baseURL || undefined,
  headers: { 'Content-Type': 'application/json' },
});

/** Load `/api-config.json` then apply axios baseURL (Railway runtime env fallback). */
export async function initApiFromRuntime(): Promise<void> {
  await loadRuntimeApiEnv();
  const b = resolvedApiBase();
  api.defaults.baseURL = b || undefined;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[api] baseURL', b || '(relative — same origin)');
  }
}

// Dynamic Auth & Audit Logging Interceptors
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('oneyield_jwt');
  if (token) {
    if (config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  console.log(`%c[Frontend-API] Requesting: ${config.method?.toUpperCase()} ${config.url}`, 'color: #3b82f6; font-weight: bold;', {
    params: config.params,
    data: config.data,
    headers: config.headers, // Added headers here
  });
  return config;
});

/** Paths where 401 must not trigger refresh (public auth or refresh itself). */
const AUTH_401_NO_REFRESH = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/challenge',
  '/auth/verify',
  '/auth/username-available',
  '/auth/refresh',
]);

function requestPathname(config: { url?: string; baseURL?: string } | undefined): string {
  if (!config?.url) return '';
  const u = config.url;
  if (u.startsWith('http')) {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  }
  const base = config.baseURL ?? '';
  if (base) {
    try {
      const origin = base.endsWith('/') ? base.slice(0, -1) : base;
      return new URL(u, origin + '/').pathname;
    } catch {
      /* fall through */
    }
  }
  return u.startsWith('/') ? u : `/${u}`;
}

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => {
    console.log(`%c[Frontend-API] Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, 'color: #10b981; font-weight: bold;', {
      data: response.data,
    });
    return response;
  },
  async (error) => {
    if (axios.isAxiosError(error)) {
      const originalRequest = error.config;
      if ((originalRequest as { _skipAuthRefresh?: boolean } | undefined)?._skipAuthRefresh) {
        return Promise.reject(error);
      }

      const status = error.response?.status;
      if (status === 401 && originalRequest) {
        const path = requestPathname(originalRequest).split('?')[0];
        if (AUTH_401_NO_REFRESH.has(path)) {
          return Promise.reject(error);
        }

        const stored = loadStoredToken();
        if (!stored) {
          return Promise.reject(error);
        }

        if ((originalRequest as { _retry?: boolean })._retry) {
          window.dispatchEvent(new CustomEvent('yield_unauthorized'));
          return Promise.reject(error);
        }

        (originalRequest as { _retry?: boolean })._retry = true;

        try {
          if (!refreshPromise) {
            refreshPromise = api
              .post<{ accessToken: string }>('/auth/refresh', undefined, {
                _skipAuthRefresh: true,
              } as Record<string, unknown>)
              .then((res) => res.data.accessToken)
              .finally(() => {
                refreshPromise = null;
              });
          }
          const accessToken = await refreshPromise;
          setAuthToken(accessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        } catch {
          console.warn('[Frontend-API] Refresh failed - Triggering re-auth');
          window.dispatchEvent(new CustomEvent('yield_unauthorized'));
          return Promise.reject(error);
        }
      }
    }
    console.error(`%c[Frontend-API] Failed: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, 'color: #ef4444; font-weight: bold;', {
      message: error.message,
      response: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('oneyield_jwt', token);
    console.log('[Frontend-API] Token stored in localStorage');
  } else {
    localStorage.removeItem('oneyield_jwt');
    console.log('[Frontend-API] Token removed from localStorage');
  }
}

export function loadStoredToken() {
  return localStorage.getItem('oneyield_jwt');
}

export function isApiConfigured(): boolean {
  return isApiEnvConfigured();
}

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ message?: string | string[] }>;
    const m = ax.response?.data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
    return ax.message;
  }

  const msg = String(err);
  if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
    return 'Transaction cancelled by user.';
  }
  if (msg.includes('missing role') || msg.includes('AccessControl')) {
    return 'Unauthorized: Your account is missing the required role for this action.';
  }
  if (msg.includes('insufficient allowance')) {
    return 'Insufficient allowance: Please approve tokens first.';
  }
  if (msg.includes('execution reverted')) {
    const match = msg.match(/reverted with reason "([^"]+)"/);
    if (match) return `Transaction failed: ${match[1]}`;
    return 'Transaction failed: Execution reverted.';
  }

  return msg;
}
