import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../utils/token.js';

let io: SocketIOServer | null = null;

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    email?: string;
  };
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // JWT Authentication Middleware for Socket.IO connections
  io.use((socket: Socket, next) => {
    try {
      let token: string | undefined;

      // Check auth object: { token: '...' }
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }
      // Check Authorization header
      else if (socket.handshake.headers.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim();
        }
      }
      // Check query parameter: ?token=...
      else if (socket.handshake.query && typeof socket.handshake.query.token === 'string') {
        token = socket.handshake.query.token;
      }

      if (!token) {
        logger.debug('[Socket.IO] Connection rejected: No authentication token provided');
        return next(new Error('Authentication token required'));
      }

      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;

      next();
    } catch (err: unknown) {
      const error = err as Error;
      logger.debug({ error: error.message }, '[Socket.IO] Authentication failed');
      next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    // Join dedicated user room for targeted notifications
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    logger.info({ userId, socketId: socket.id }, `[Socket.IO] User connected and joined room ${userRoom}`);

    // Allow user to subscribe to specific stock alert rooms if desired
    socket.on('subscribe:symbol', (symbol: string) => {
      if (typeof symbol === 'string' && symbol.trim()) {
        const stockRoom = `stock:${symbol.trim().toUpperCase()}`;
        socket.join(stockRoom);
        logger.debug({ userId, stockRoom }, `[Socket.IO] Joined stock room`);
      }
    });

    socket.on('unsubscribe:symbol', (symbol: string) => {
      if (typeof symbol === 'string' && symbol.trim()) {
        const stockRoom = `stock:${symbol.trim().toUpperCase()}`;
        socket.leave(stockRoom);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId, socketId: socket.id, reason }, '[Socket.IO] User disconnected');
    });
  });

  logger.info('[Socket.IO] Real-time WebSocket server initialized successfully');
  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emit event to a specific user across all their connected devices/tabs
 */
export function emitToUser(userId: string, event: string, data: unknown): boolean {
  if (!io) {
    logger.debug('[Socket.IO] Server not initialized, skipping emit');
    return false;
  }
  const userRoom = `user:${userId}`;
  io.to(userRoom).emit(event, data);
  logger.debug({ userId, event }, `[Socket.IO] Emitted event "${event}" to ${userRoom}`);
  return true;
}

/**
 * Emit event to all users connected to a specific room
 */
export function emitToRoom(room: string, event: string, data: unknown): boolean {
  if (!io) return false;
  io.to(room).emit(event, data);
  return true;
}

/**
 * Broadcast event to all connected clients
 */
export function broadcast(event: string, data: unknown): boolean {
  if (!io) return false;
  io.emit(event, data);
  return true;
}
