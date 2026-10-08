import { io, Socket } from 'socket.io-client';
import { api } from './api.ts';
import { AppNotification } from '../types/alert.ts';

// Extract root server URL (strip /api/v1 if present)
const getSocketUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '');
};

type NotificationHandler = (notification: AppNotification) => void;
type UnreadCountHandler = (data: { unreadCount: number }) => void;
type ConnectionStatusHandler = (connected: boolean) => void;

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private notificationListeners = new Set<NotificationHandler>();
  private unreadCountListeners = new Set<UnreadCountHandler>();
  private statusListeners = new Set<ConnectionStatusHandler>();

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Connect to Socket.IO using active JWT access token
   */
  public connect(customToken?: string): void {
    const token = customToken || api.getAccessToken();
    if (!token) {
      return;
    }

    if (this.socket && this.socket.connected) {
      return;
    }

    const socketUrl = getSocketUrl();

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      this.statusListeners.forEach((fn) => fn(true));
    });

    this.socket.on('disconnect', () => {
      this.statusListeners.forEach((fn) => fn(false));
    });

    this.socket.on('connect_error', () => {
      this.statusListeners.forEach((fn) => fn(false));
    });

    // Real-time notification received
    this.socket.on('notification:received', (notification: AppNotification) => {
      this.notificationListeners.forEach((listener) => {
        try {
          listener(notification);
        } catch {
          // Ignore listener error
        }
      });
    });

    // Real-time unread count update
    this.socket.on('notification:unread_count', (data: { unreadCount: number }) => {
      this.unreadCountListeners.forEach((listener) => {
        try {
          listener(data);
        } catch {
          // Ignore listener error
        }
      });
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.statusListeners.forEach((fn) => fn(false));
    }
  }

  public isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  public onNotification(listener: NotificationHandler): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  public onUnreadCount(listener: UnreadCountHandler): () => void {
    this.unreadCountListeners.add(listener);
    return () => this.unreadCountListeners.delete(listener);
  }

  public onConnectionStatus(listener: ConnectionStatusHandler): () => void {
    this.statusListeners.add(listener);
    listener(this.isConnected());
    return () => this.statusListeners.delete(listener);
  }

  public subscribeSymbol(symbol: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe:symbol', symbol);
    }
  }

  public on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  public off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = SocketService.getInstance();
