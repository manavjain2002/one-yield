import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

function normalizeSocketBase(url: string): string {
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t.replace(/\/+$/, '');
  const host = t.replace(/^\/+/, '').replace(/\/+$/, '');
  if (/^(localhost\b|127\.0\.0\.1)(?::|$)/i.test(host)) return `http://${host}`;
  return `https://${host}`;
}

const apiBase = normalizeSocketBase(import.meta.env.VITE_API_URL ?? '');
const wsUrl =
  normalizeSocketBase(import.meta.env.VITE_WS_URL ?? '') || apiBase;

/**
 * Subscribes to backend `/events` namespace and invalidates pool-related queries on tx updates.
 */
export function useEventsSocket(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || !wsUrl) return;

    const socket: Socket = io(`${wsUrl}/events`, {
      transports: ['websocket'],
    });

    socket.on('tx', () => {
      void qc.invalidateQueries({ queryKey: ['pools'] });
      void qc.invalidateQueries({ queryKey: ['pool'] });
      void qc.invalidateQueries({ queryKey: ['lender-positions'] });
      void qc.invalidateQueries({ queryKey: ['tx-history'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled, qc]);
}
