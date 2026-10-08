import { api } from './api.ts';
import {
  StockAlert,
  CreateStockAlertPayload,
  UpdateStockAlertPayload,
  AppNotification,
  NotificationPreferences,
  NotificationType,
  NotificationSeverity,
} from '../types/alert.ts';

export class AlertService {
  /**
   * Get all active & triggered stock alerts for current user
   */
  static async getAlerts(): Promise<StockAlert[]> {
    const res = await api.request<{ success: boolean; data: StockAlert[] }>('/stocks/alerts');
    return res.data;
  }

  /**
   * Create a new configurable stock alert
   */
  static async createAlert(payload: CreateStockAlertPayload): Promise<StockAlert> {
    const res = await api.request<{ success: boolean; data: StockAlert }>('/stocks/alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Update an existing stock alert
   */
  static async updateAlert(id: string, payload: UpdateStockAlertPayload): Promise<StockAlert> {
    const res = await api.request<{ success: boolean; data: StockAlert }>(`/stocks/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Delete a stock alert
   */
  static async deleteAlert(id: string): Promise<void> {
    await api.request(`/stocks/alerts/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Trigger background evaluation of stock alerts
   */
  static async evaluateAlerts(): Promise<{ totalEvaluated: number; totalTriggered: number }> {
    const res = await api.request<{
      success: boolean;
      data: { totalEvaluated: number; totalTriggered: number };
    }>('/stocks/alerts/evaluate', {
      method: 'POST',
    });
    return res.data;
  }

  /**
   * List notifications (filter by type, severity, isRead, isDismissed)
   */
  static async getNotifications(params?: {
    type?: NotificationType | string;
    severity?: NotificationSeverity | string;
    isRead?: boolean;
    isDismissed?: boolean;
    limit?: number;
    page?: number;
  }): Promise<{ notifications: AppNotification[]; total: number; unreadCount: number }> {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.severity) query.append('severity', params.severity);
    if (params?.isRead !== undefined) query.append('isRead', String(params.isRead));
    if (params?.isDismissed !== undefined) query.append('isDismissed', String(params.isDismissed));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.page) query.append('page', String(params.page));

    const endpoint = `/notifications${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await api.request<{
      success: boolean;
      data: { notifications: AppNotification[]; total: number; unreadCount: number };
    }>(endpoint);
    return res.data;
  }

  /**
   * Get unread notifications count
   */
  static async getUnreadCount(): Promise<number> {
    const res = await api.request<{ success: boolean; data: { unreadCount: number } }>(
      '/notifications/unread-count',
    );
    return res.data.unreadCount;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id: string): Promise<AppNotification> {
    const res = await api.request<{ success: boolean; data: AppNotification }>(
      `/notifications/${id}/read`,
      {
        method: 'PATCH',
      },
    );
    return res.data;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<void> {
    await api.request('/notifications/read-all', {
      method: 'PATCH',
    });
  }

  /**
   * Dismiss notification
   */
  static async dismissNotification(id: string): Promise<AppNotification> {
    const res = await api.request<{ success: boolean; data: AppNotification }>(
      `/notifications/${id}/dismiss`,
      {
        method: 'PATCH',
      },
    );
    return res.data;
  }

  /**
   * Delete notification
   */
  static async deleteNotification(id: string): Promise<void> {
    await api.request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get notification preferences
   */
  static async getPreferences(): Promise<NotificationPreferences> {
    const res = await api.request<{
      success: boolean;
      data: { preferences: NotificationPreferences };
    }>('/notifications/preferences');
    return res.data.preferences;
  }

  /**
   * Update notification preferences
   */
  static async updatePreferences(
    payload: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const res = await api.request<{
      success: boolean;
      data: { preferences: NotificationPreferences };
    }>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data.preferences;
  }

  /**
   * Trigger test notification
   */
  static async sendTestNotification(payload: {
    title: string;
    message: string;
    type?: string;
    severity?: string;
    channels?: string[];
    actionUrl?: string;
  }): Promise<unknown> {
    const res = await api.request<{ success: boolean; data: unknown }>('/notifications/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }
}
