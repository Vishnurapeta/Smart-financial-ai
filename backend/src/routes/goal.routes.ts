import { Router } from 'express';
import { GoalController } from '../controllers/goal.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  contributeGoalSchema,
  createGoalSchema,
  queryGoalsSchema,
  updateGoalSchema,
} from '../validations/goal.validation.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createGoalSchema), GoalController.create);
router.get('/', validate(queryGoalsSchema), GoalController.getAll);
router.get('/summary', GoalController.getSummary);
router.get('/:id', GoalController.getById);
router.put('/:id', validate(updateGoalSchema), GoalController.update);
router.post('/:id/contribute', validate(contributeGoalSchema), GoalController.contribute);
router.delete('/:id', GoalController.delete);

export const goalRoutes = router;
