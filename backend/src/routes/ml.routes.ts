import { Router } from 'express';
import { MLController } from '../controllers/ml.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  categorizeTransactionSchema,
  categorizationFeedbackSchema,
} from '../validations/ml.validation.js';

const router = Router();

// All ML categorization endpoints require authentication
router.use(authenticate);

router.post('/categorize', validate(categorizeTransactionSchema), MLController.categorize);
router.post('/feedback', validate(categorizationFeedbackSchema), MLController.recordFeedback);

export default router;
