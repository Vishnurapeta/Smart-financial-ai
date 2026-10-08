import { Router } from 'express';
import { RecurringController } from '../controllers/recurring.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createRecurringExpenseSchema,
  recurringQuerySchema,
  updateRecurringExpenseSchema,
} from '../validations/recurring.validation.js';

const router = Router();

// All recurring routes require authentication
router.use(authenticate);

// Detect patterns from historical transactions
router.post('/detect', RecurringController.detect);

// Reminder architecture
router.get('/reminders/upcoming', RecurringController.getUpcomingBills);
router.post('/reminders/trigger', RecurringController.triggerBillReminders);

// Standard recurring expenses CRUD
router.get('/', validate(recurringQuerySchema), RecurringController.getRecurringExpenses);
router.get('/:id', RecurringController.getRecurringExpenseById);
router.post(
  '/',
  validate(createRecurringExpenseSchema),
  RecurringController.createRecurringExpense,
);
router.put(
  '/:id',
  validate(updateRecurringExpenseSchema),
  RecurringController.updateRecurringExpense,
);
router.delete('/:id', RecurringController.deleteRecurringExpense);

export const recurringRoutes = router;
