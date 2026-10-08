import { Router } from 'express';
import { PortfolioController } from '../controllers/portfolio.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  portfolioIdParamSchema,
  addHoldingSchema,
  editHoldingSchema,
  holdingIdParamSchema,
} from '../validations/portfolio.validation.js';

const router = Router();
const controller = new PortfolioController();

router.use(authenticate);

router.get('/', controller.getPortfolios);
router.post('/', validate(createPortfolioSchema), controller.createPortfolio);
router.get('/:id', validate(portfolioIdParamSchema), controller.getPortfolioById);
router.patch('/:id', validate(updatePortfolioSchema), controller.updatePortfolio);
router.delete('/:id', validate(portfolioIdParamSchema), controller.deletePortfolio);

router.get('/:id/dashboard', validate(portfolioIdParamSchema), controller.getDashboard);
router.post('/:id/holdings', validate(addHoldingSchema), controller.addHolding);
router.patch('/:id/holdings/:holdingId', validate(editHoldingSchema), controller.editHolding);
router.delete('/:id/holdings/:holdingId', validate(holdingIdParamSchema), controller.removeHolding);

export const portfolioRoutes = router;
