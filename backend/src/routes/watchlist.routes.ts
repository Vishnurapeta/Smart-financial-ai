import { Router } from 'express';
import { WatchlistController } from '../controllers/watchlist.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createWatchlistSchema,
  addWatchlistSymbolSchema,
  removeWatchlistSymbolSchema,
} from '../validations/watchlist.validation.js';

const router = Router();
const controller = new WatchlistController();

router.use(authenticate);

router.get('/', controller.getWatchlists);
router.post('/', validate(createWatchlistSchema), controller.createWatchlist);
router.get('/:id', controller.getWatchlistById);
router.post('/:id/symbols', validate(addWatchlistSymbolSchema), controller.addSymbol);
router.delete(
  '/:id/symbols/:symbol',
  validate(removeWatchlistSymbolSchema),
  controller.removeSymbol,
);
router.delete('/:id', controller.deleteWatchlist);

export const watchlistRoutes = router;
