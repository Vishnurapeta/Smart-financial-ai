import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppNotification } from '../types/alert.ts';
import { AlertService } from '../services/alert.service.ts';
import { socketService } from '../services/socket.service.ts';
import { useAuth } from './AuthContext.tsx';

export interface ToastItem {
  id: string;
  notification: AppNotification;
}

interface NotificationContextType {
  unreadCount: number;
  notifications: AppNotification[];
  recentNotifications: AppNotification[];
  toasts: ToastItem[];
  isSocketConnected: boolean;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  removeToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await AlertService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Quiet fail if network/auth offline
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await AlertService.getNotifications({ limit: 50 });
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Quiet fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Connect / Disconnect socket when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
      fetchUnreadCount();
      fetchNotifications();

      const unsubscribeStatus = socketService.onConnectionStatus((connected) => {
        setIsSocketConnected(connected);
      });

      const unsubscribeNotification = socketService.onNotification((newNotif) => {
        // Prepend to notifications list
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)]);
        setUnreadCount((prev) => prev + 1);

        // Add toast
        const toastId = `${newNotif._id || Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id: toastId, notification: newNotif }]);

        // Auto dismiss toast after 6 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 6000);
      });

      const unsubscribeCount = socketService.onUnreadCount(({ unreadCount: count }) => {
        setUnreadCount(count);
      });

      return () => {
        unsubscribeStatus();
        unsubscribeNotification();
        unsubscribeCount();
        socketService.disconnect();
      };
    } else {
      socketService.disconnect();
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
    }
  }, [isAuthenticated, fetchUnreadCount, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await AlertService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await AlertService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      await AlertService.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to dismiss notification', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await AlertService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        recentNotifications,
        toasts,
        isSocketConnected,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        deleteNotification,
        removeToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
