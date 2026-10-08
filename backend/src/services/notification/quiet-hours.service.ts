import { IQuietHours } from '../../models/notification-preference.model.js';
import { NotificationSeverity } from '../../models/notification.model.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface QuietHoursEvaluation {
  inQuietHours: boolean;
  delaySeconds: number;
  bypassed?: boolean;
}

export class QuietHoursService {
  private static instance: QuietHoursService;

  private constructor() {}

  public static getInstance(): QuietHoursService {
    if (!QuietHoursService.instance) {
      QuietHoursService.instance = new QuietHoursService();
    }
    return QuietHoursService.instance;
  }

  /**
   * Evaluate whether the given user is currently in their designated quiet hours.
   * CRITICAL notifications bypass quiet hours unconditionally.
   */
  public evaluate(
    quietHours?: IQuietHours,
    severity: NotificationSeverity = NotificationSeverity.INFO,
  ): QuietHoursEvaluation {
    if (!env.NOTIFICATION_QUIET_HOURS_ENABLED || !quietHours || !quietHours.enabled) {
      return { inQuietHours: false, delaySeconds: 0 };
    }

    // Critical alerts always bypass quiet hours
    if (severity === NotificationSeverity.CRITICAL) {
      return { inQuietHours: false, delaySeconds: 0, bypassed: true };
    }

    try {
      const timezone = quietHours.timezone || 'UTC';
      const now = new Date();

      // Format current time in user's timezone to "HH:mm"
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = timeFormatter.formatToParts(now);
      const hourPart = parts.find((p) => p.type === 'hour')?.value || '00';
      const minutePart = parts.find((p) => p.type === 'minute')?.value || '00';
      const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minutePart, 10);

      const [startH, startM] = (quietHours.startTime || '22:00').split(':').map((v) => parseInt(v, 10));
      const [endH, endM] = (quietHours.endTime || '08:00').split(':').map((v) => parseInt(v, 10));

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      let isInRange = false;
      let minutesUntilEnd = 0;

      if (startMinutes <= endMinutes) {
        // Same-day window, e.g., 13:00 to 17:00
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          isInRange = true;
          minutesUntilEnd = endMinutes - currentMinutes;
        }
      } else {
        // Overnight window, e.g., 22:00 to 08:00
        if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
          isInRange = true;
          if (currentMinutes >= startMinutes) {
            minutesUntilEnd = (24 * 60 - currentMinutes) + endMinutes;
          } else {
            minutesUntilEnd = endMinutes - currentMinutes;
          }
        }
      }

      if (isInRange) {
        const delaySeconds = Math.max(60, minutesUntilEnd * 60);
        logger.debug(
          { timezone, startTime: quietHours.startTime, endTime: quietHours.endTime, delaySeconds },
          '[QuietHoursService] Current time falls within quiet hours. Delivery will be delayed.',
        );
        return { inQuietHours: true, delaySeconds };
      }

      return { inQuietHours: false, delaySeconds: 0 };
    } catch (err: unknown) {
      const error = err as Error;
      logger.warn({ error: error.message }, '[QuietHoursService] Error evaluating quiet hours, proceeding with immediate delivery');
      return { inQuietHours: false, delaySeconds: 0 };
    }
  }
}

export const quietHoursService = QuietHoursService.getInstance();
