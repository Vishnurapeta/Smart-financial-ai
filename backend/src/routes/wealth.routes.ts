import { Router } from 'express';
import { WealthController } from '../controllers/wealth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createAssetSchema,
  createLiabilitySchema,
  createSnapshotSchema,
  updateAssetSchema,
  updateLiabilitySchema,
} from '../validations/wealth.validation.js';

// 1. Assets Router
const assetRouter = Router();
assetRouter.use(authenticate);
assetRouter.post('/', validate(createAssetSchema), WealthController.createAsset);
assetRouter.get('/', WealthController.getAssets);
assetRouter.get('/summary', WealthController.getAssetsSummary);
assetRouter.get('/:id', WealthController.getAssetById);
assetRouter.put('/:id', validate(updateAssetSchema), WealthController.updateAsset);
assetRouter.delete('/:id', WealthController.deleteAsset);

// 2. Liabilities Router
const liabilityRouter = Router();
liabilityRouter.use(authenticate);
liabilityRouter.post('/', validate(createLiabilitySchema), WealthController.createLiability);
liabilityRouter.get('/', WealthController.getLiabilities);
liabilityRouter.get('/summary', WealthController.getLiabilitiesSummary);
liabilityRouter.get('/:id', WealthController.getLiabilityById);
liabilityRouter.put('/:id', validate(updateLiabilitySchema), WealthController.updateLiability);
liabilityRouter.delete('/:id', WealthController.deleteLiability);

// 3. Net Worth Router
const netWorthRouter = Router();
netWorthRouter.use(authenticate);
netWorthRouter.get('/', WealthController.getNetWorth);
netWorthRouter.post('/snapshot', validate(createSnapshotSchema), WealthController.createSnapshot);
netWorthRouter.get('/history', WealthController.getHistory);
netWorthRouter.delete('/snapshot/:id', WealthController.deleteSnapshot);

export { assetRouter, liabilityRouter, netWorthRouter };
