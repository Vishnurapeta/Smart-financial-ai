import { Router } from 'express';
import { StockController } from '../controllers/stock.controller.js';
import { StockAlertController } from '../controllers/stock-alert.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  getStockHistorySchema,
  getStockQuoteSchema,
  searchStocksSchema,
} from '../validations/stock.validation.js';
import {
  createStockAlertSchema,
  updateStockAlertSchema,
  alertIdParamSchema,
} from '../validations/alert.validation.js';

const router = Router();
const alertController = new StockAlertController();

// Protect all stock intelligence endpoints
router.use(authenticate);

// 1. Alert endpoints (placed before :symbol parameter routes to prevent collision)
router.get('/alerts', alertController.getAlerts);
router.post('/alerts', validate(createStockAlertSchema), alertController.createAlert);
router.post('/alerts/evaluate', alertController.evaluateAlerts);
router.get('/alerts/:id', validate(alertIdParamSchema), alertController.getAlertById);
router.patch('/alerts/:id', validate(updateStockAlertSchema), alertController.updateAlert);
router.delete('/alerts/:id', validate(alertIdParamSchema), alertController.deleteAlert);

// 2. Search endpoint
router.get('/search', validate(searchStocksSchema), StockController.search);

import { stockPredictionRateLimiter } from '../middleware/rate-limiter.middleware.js';

// 3. Stock ML Predictions proxy (forwards to FastAPI ML service with rate limiting)
router.all('/predictions/proxy', stockPredictionRateLimiter, StockController.proxyPrediction);

// 4. Stock quote & history endpoints
router.get('/:symbol/quote', validate(getStockQuoteSchema), StockController.getQuote);
router.get('/:symbol/history', validate(getStockHistorySchema), StockController.getHistory);

export const stockRoutes = router;
