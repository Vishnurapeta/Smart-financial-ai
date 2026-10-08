import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

router.get('/dashboard', AnalyticsController.getDashboardAnalytics);

export default router;
