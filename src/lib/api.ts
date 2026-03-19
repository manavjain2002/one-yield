import axios, { AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: baseURL || undefined,
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('oneyield_jwt', token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem('oneyield_jwt');
  }
}

export function loadStoredToken() {
  const t = localStorage.getItem('oneyield_jwt');
  if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
  return t;
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
  return String(err);
}
