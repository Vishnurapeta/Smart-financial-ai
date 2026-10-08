import { z } from 'zod';
import {
  NotificationType,
  NotificationSeverity,
  NotificationChannel,
} from '../models/notification.model.js';

export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    emailAlerts: z.boolean().optional(),
    pushAlerts: z.boolean().optional(),
    stockAlertsEnabled: z.boolean().optional(),
    minCooldownMinutes: z.number().min(1, 'Minimum cooldown is 1 minute').optional(),
    emailDailyDigest: z.boolean().optional(),
    emailWeeklyDigest: z.boolean().optional(),
    monthlyReportEmail: z.boolean().optional(),
    maxNotificationsPerHour: z.number().min(1).max(200).optional(),
    quietHours: z
      .object({
        enabled: z.boolean().optional(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:mm').optional(),
        endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:mm').optional(),
        timezone: z.string().optional(),
      })
      .optional(),
    channels: z
      .record(
        z.object({
          inApp: z.boolean().default(true),
          email: z.boolean().default(true),
          socket: z.boolean().default(true),
        }),
      )
      .optional(),
  }),
});

export const notificationQuerySchema = z.object({
  query: z.object({
    type: z.nativeEnum(NotificationType).optional(),
    severity: z.nativeEnum(NotificationSeverity).optional(),
    isRead: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    isDismissed: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .optional(),
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .optional(),
  }),
});

export const testNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    message: z.string().min(1),
    type: z.nativeEnum(NotificationType).default(NotificationType.SYSTEM),
    severity: z.nativeEnum(NotificationSeverity).default(NotificationSeverity.INFO),
    channels: z.array(z.nativeEnum(NotificationChannel)).optional(),
    actionUrl: z.string().optional(),
  }),
});
