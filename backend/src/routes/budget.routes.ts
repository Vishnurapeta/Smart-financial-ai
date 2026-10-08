import { Router } from 'express';
import { BudgetController } from '../controllers/budget.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { verifyOwnership } from '../middleware/ownership.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { Budget } from '../models/budget.model.js';
import {
  createBudgetSchema,
  updateBudgetSchema,
  getBudgetByIdSchema,
  getBudgetsQuerySchema,
  getBudgetSummaryQuerySchema,
  getBudgetHistoryQuerySchema,
  getBudgetComparisonQuerySchema,
} from '../validations/budget.validation.js';

const router = Router();

// All budgeting endpoints require authentication
router.use(authenticate);

// Aggregations and comparative endpoints
router.get('/summary', validate(getBudgetSummaryQuerySchema), BudgetController.getBudgetSummary);
router.get('/history', validate(getBudgetHistoryQuerySchema), BudgetController.getBudgetHistory);
router.get(
  '/comparison',
  validate(getBudgetComparisonQuerySchema),
  BudgetController.getMonthlyComparison,
);

// List & Create
router.get('/', validate(getBudgetsQuerySchema), BudgetController.getBudgets);
router.post('/', validate(createBudgetSchema), BudgetController.createBudget);

// Individual budget operations (protected by resource ownership verification)
router.get(
  '/:id',
  validate(getBudgetByIdSchema),
  verifyOwnership(Budget, { paramName: 'id', ownerField: 'userId' }),
  BudgetController.getBudget,
);

router.put(
  '/:id',
  validate(updateBudgetSchema),
  verifyOwnership(Budget, { paramName: 'id', ownerField: 'userId' }),
  BudgetController.updateBudget,
);

router.delete(
  '/:id',
  validate(getBudgetByIdSchema),
  verifyOwnership(Budget, { paramName: 'id', ownerField: 'userId' }),
  BudgetController.deleteBudget,
);

export default router;
