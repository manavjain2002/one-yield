import { Logger } from '@nestjs/common';
import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface TxUpdatePayload {
  jobId?: string;
  status: string;
  txHash?: string;
  poolAddress?: string;
  functionName?: string;
  error?: string;
}

@WebSocketGateway({
  cors: { origin: true },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayInit {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('WebSocket /events gateway ready');
  }

  emitTxUpdate(payload: TxUpdatePayload) {
    this.server?.emit('tx', payload);
  }

  emitIndexerSync(payload: Record<string, unknown>) {
    this.server?.emit('indexer', payload);
  }
}
