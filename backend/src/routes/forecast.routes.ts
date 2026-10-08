import { Router } from 'express';
import { ForecastController } from '../controllers/forecast.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  getExpenseForecastSchema,
  getCashFlowForecastSchema,
  getForecastHistorySchema,
} from '../validations/forecast.validation.js';

const router = Router();

// Protect all forecasting endpoints with strict user authentication
router.use(authenticate);

// 1. Expense Forecast Endpoint
router.get('/expenses', validate(getExpenseForecastSchema), ForecastController.getExpenseForecast);

// 2. Cash-Flow Forecast Endpoint
router.get('/cash-flow', validate(getCashFlowForecastSchema), ForecastController.getCashFlowForecast);

// 3. Forecast History & Audit Endpoint
router.get('/history', validate(getForecastHistorySchema), ForecastController.getForecastHistory);

export const forecastRoutes = router;
