import { Router } from 'express';
import { AnomalyController } from '../controllers/anomaly.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  detectAnomaliesSchema,
  getAnomaliesSchema,
  getAnomalyByIdSchema,
  updateAnomalyStatusSchema,
  recordAnomalyFeedbackSchema,
} from '../validations/anomaly.validation.js';

const router = Router();

// Protect all anomaly detection endpoints with strict authentication
router.use(authenticate);

// 1. Detect Anomalies (manually or scheduled)
router.post('/detect', validate(detectAnomaliesSchema), AnomalyController.detectAnomalies);

// 2. Get Aggregated Summary
router.get('/summary', AnomalyController.getSummary);

// 3. List Anomalies with filters and pagination
router.get('/', validate(getAnomaliesSchema), AnomalyController.getAnomalies);

// 4. Get Single Anomaly Details
router.get('/:id', validate(getAnomalyByIdSchema), AnomalyController.getAnomalyById);

// 5. Update Status
router.patch('/:id/status', validate(updateAnomalyStatusSchema), AnomalyController.updateStatus);

// 6. Record User Feedback
router.post('/:id/feedback', validate(recordAnomalyFeedbackSchema), AnomalyController.recordFeedback);

export const anomalyRoutes = router;
