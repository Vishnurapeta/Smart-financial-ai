import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  notificationQuerySchema,
  updateNotificationPreferencesSchema,
  testNotificationSchema,
} from '../validations/notification.validation.js';

const router = Router();
const controller = new NotificationController();

router.use(authenticate);

// List & unread count
router.get('/', validate(notificationQuerySchema), controller.getNotifications);
router.get('/unread-count', controller.getUnreadCount);

// Status updates
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', controller.markAsRead);
router.patch('/:id/dismiss', controller.dismissNotification);
router.delete('/:id', controller.deleteNotification);

// Notification Preferences
router.get('/preferences', controller.getPreferences);
router.patch(
  '/preferences',
  validate(updateNotificationPreferencesSchema),
  controller.updatePreferences,
);

// Dev / Testing Trigger
router.post('/test', validate(testNotificationSchema), controller.sendTestNotification);

export const notificationRoutes = router;
