import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage, Server } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';

type Client = WebSocket & { userId?: string };

let wss: WebSocketServer | null = null;

export const attachEventHub = (server: Server): void => {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket: Client, request: IncomingMessage) => {
    const url = new URL(request.url || '', 'http://localhost');
    const token = url.searchParams.get('token') || '';
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || '') as { userId: string };
      socket.userId = payload.userId;
    } catch {
      socket.close(4401, 'Unauthorized');
      return;
    }
    socket.send(JSON.stringify({ type: 'connected' }));
  });
  logger.info('WebSocket event hub attached at /ws');
};

export const publishUserEvent = (userId: string, event: Record<string, unknown>): void => {
  if (!wss) return;
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    const typed = client as Client;
    if (typed.userId === userId && typed.readyState === WebSocket.OPEN) {
      typed.send(payload);
    }
  });
};
