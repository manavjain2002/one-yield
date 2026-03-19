import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const wsUrl = import.meta.env.VITE_WS_URL;

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
