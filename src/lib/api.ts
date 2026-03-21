import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: baseURL || undefined,
  headers: { 'Content-Type': 'application/json' },
});

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

api.interceptors.response.use(
  (response) => {
    console.log(`%c[Frontend-API] Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, 'color: #10b981; font-weight: bold;', {
      data: response.data,
    });
    return response;
  },
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.warn('[Frontend-API] Unauthorized - Triggering re-auth');
        window.dispatchEvent(new CustomEvent('yield_unauthorized'));
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
  return Boolean(import.meta.env.VITE_API_URL);
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
