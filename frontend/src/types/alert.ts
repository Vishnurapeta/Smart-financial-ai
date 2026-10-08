export type StockAlertType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PERCENT_CHANGE_UP'
  | 'PERCENT_CHANGE_DOWN'
  | 'VOLUME_ABOVE';

export interface StockAlert {
  _id: string;
  userId: string;
  symbol: string;
  alertType: StockAlertType;
  threshold: number;
  isActive: boolean;
  isTriggered: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  cooldownMinutes: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockAlertPayload {
  symbol: string;
  alertType: StockAlertType;
  threshold: number;
  cooldownMinutes?: number;
  notes?: string;
}

export interface UpdateStockAlertPayload {
  alertType?: StockAlertType;
  threshold?: number;
  isActive?: boolean;
  cooldownMinutes?: number;
  notes?: string;
}

export type NotificationType =
  | 'BUDGET_THRESHOLD'
  | 'BUDGET_EXCEEDED'
  | 'RECURRING_PAYMENT_DUE'
  | 'SUBSCRIPTION_RENEWAL'
  | 'ANOMALY_DETECTED'
  | 'STOCK_ALERT'
  | 'PORTFOLIO_UPDATE'
  | 'MONTHLY_REPORT'
  | 'BILL_DUE'
  | 'GOAL_MILESTONE'
  | 'SYSTEM';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'ALERT' | 'CRITICAL';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SOCKET' | 'PUSH';
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ' | 'DISMISSED';

export interface AppNotification {
  _id: string;
  userId?: string;
  title: string;
  message: string;
  type: NotificationType | string;
  severity?: NotificationSeverity;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  status?: NotificationStatus;
  isRead: boolean;
  readAt?: string;
  isDismissed?: boolean;
  dismissedAt?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface ChannelPreference {
  inApp: boolean;
  email: boolean;
  socket: boolean;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string; // "22:00"
  endTime: string;   // "08:00"
  timezone: string;
}

export interface NotificationPreferences {
  _id?: string;
  userId?: string;
  theme?: 'dark' | 'light' | 'system';
  emailAlerts: boolean;
  pushAlerts: boolean;
  weeklyDigest?: boolean;
  stockAlertsEnabled: boolean;
  minCooldownMinutes: number;
  emailDailyDigest?: boolean;
  emailWeeklyDigest?: boolean;
  monthlyReportEmail?: boolean;
  maxNotificationsPerHour?: number;
  quietHours?: QuietHoursConfig;
  channels?: Record<string, ChannelPreference>;
}
