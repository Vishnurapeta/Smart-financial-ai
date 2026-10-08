import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { verifyOwnership } from '../middleware/ownership.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { Transaction } from '../models/transaction.model.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  queryTransactionsSchema,
  getTransactionByIdSchema,
} from '../validations/transaction.validation.js';

const router = Router();

// All transaction endpoints require authentication
router.use(authenticate);

router.post('/', validate(createTransactionSchema), TransactionController.createTransaction);

router.get('/', validate(queryTransactionsSchema), TransactionController.getTransactions);

router.get(
  '/:id',
  validate(getTransactionByIdSchema),
  verifyOwnership(Transaction, { paramName: 'id', ownerField: 'userId' }),
  TransactionController.getTransaction,
);

router.put(
  '/:id',
  validate(updateTransactionSchema),
  verifyOwnership(Transaction, { paramName: 'id', ownerField: 'userId' }),
  TransactionController.updateTransaction,
);

router.delete(
  '/:id',
  validate(getTransactionByIdSchema),
  verifyOwnership(Transaction, { paramName: 'id', ownerField: 'userId' }),
  TransactionController.deleteTransaction,
);

export default router;
