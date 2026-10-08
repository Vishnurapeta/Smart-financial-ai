import { Router } from 'express';
import { RecurringController } from '../controllers/recurring.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createSubscriptionSchema,
  subscriptionQuerySchema,
  updateSubscriptionSchema,
} from '../validations/recurring.validation.js';

const router = Router();

// All subscription routes require authentication
router.use(authenticate);

// Subscription Intelligence Dashboard
router.get('/dashboard', RecurringController.getSubscriptionDashboard);

// Standard subscriptions CRUD
router.get('/', validate(subscriptionQuerySchema), RecurringController.getSubscriptions);
router.get('/:id/history', RecurringController.getSubscriptionHistory);
router.post('/', validate(createSubscriptionSchema), RecurringController.createSubscription);
router.put('/:id', validate(updateSubscriptionSchema), RecurringController.updateSubscription);
router.delete('/:id', RecurringController.deleteSubscription);

export const subscriptionRoutes = router;
