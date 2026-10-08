import { Types } from 'mongoose';
import { Transaction, ITransaction, TransactionType } from '../models/transaction.model.js';
import { Category } from '../models/category.model.js';
import { NotFoundError } from '../utils/errors.js';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  QueryTransactionsInput,
} from '../validations/transaction.validation.js';
import { escapeRegex, safeSortField } from '../utils/security.util.js';
import { cacheService } from '../config/redis.js';
import { emitToUser } from '../config/socket.js';
import { RecurringService } from './recurring.service.js';
import { logger } from '../utils/logger.js';

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  transactionCount: number;
}

export interface PaginatedTransactionsResponse {
  transactions: ITransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: FinancialSummary;
}

export class TransactionService {
  /**
   * Create a new transaction with category validation
   */
  static async createTransaction(
    userId: string,
    input: CreateTransactionInput,
  ): Promise<ITransaction> {
    // Verify referenced category exists and belongs to system or current user
    const categoryDoc = await Category.findOne({
      _id: input.category,
      isDeleted: false,
      $or: [{ isSystem: true }, { userId: new Types.ObjectId(userId) }, { userId: null }],
    });

    if (!categoryDoc) {
      throw new NotFoundError('Referenced category was not found or is inactive');
    }

    const isRecurring = input.recurring ?? input.isRecurring ?? false;

    const transaction = await Transaction.create({
      ...input,
      userId: new Types.ObjectId(userId),
      isRecurring,
    });

    // Populate category reference for immediate UI response
    await transaction.populate('category', 'name slug icon color type');

    // Invalidate cached user dashboard analytics on mutation
    cacheService.del(`user:${userId}:analytics:dashboard`).catch(() => {});
    emitToUser(userId, 'report:invalidate', { action: 'create', transactionId: transaction._id });
    emitToUser(userId, 'transaction:changed', { action: 'create', transactionId: transaction._id });

    // Real-time synchronization of recurring subscriptions and expenses
    RecurringService.syncOnTransactionChange(userId, transaction, 'create').catch((err) => {
      logger.error('Failed to sync recurring patterns on transaction create', err);
    });

    return transaction;
  }

  /**
   * Query transactions with advanced filtering, sorting, pagination, and backend financial aggregation
   */
  static async getTransactions(
    userId: string,
    query: QueryTransactionsInput,
  ): Promise<PaginatedTransactionsResponse> {
    const userObjectId = new Types.ObjectId(userId);
    const filter: Record<string, unknown> = {
      userId: userObjectId,
      isDeleted: false,
    };

    // 1. Keyword search (case-insensitive with ReDoS protection)
    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [
        { merchant: searchRegex },
        { description: searchRegex },
        { notes: searchRegex },
        { tags: { $in: [searchRegex] } },
      ];
    }

    // 2. Type filter
    if (query.type) {
      filter.type = query.type;
    }

    // 3. Category filter
    if (query.category && Types.ObjectId.isValid(query.category)) {
      filter.category = new Types.ObjectId(query.category);
    }

    // 4. Payment method filter
    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }

    // 5. Date range filtering
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) {
        dateFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        // Ensure end date includes the full day if passed as YYYY-MM-DD
        const end = new Date(query.endDate);
        if (end.getHours() === 0 && end.getMinutes() === 0) {
          end.setHours(23, 59, 59, 999);
        }
        dateFilter.$lte = end;
      }
      filter.date = dateFilter;
    }

    // 6. Amount range filtering
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      const amountFilter: Record<string, number> = {};
      if (query.minAmount !== undefined) {
        amountFilter.$gte = query.minAmount;
      }
      if (query.maxAmount !== undefined) {
        amountFilter.$lte = query.maxAmount;
      }
      filter.amount = amountFilter;
    }

    // 7. Recurring filter
    const recurringFilter = query.recurring ?? query.isRecurring;
    if (recurringFilter !== undefined) {
      filter.isRecurring = recurringFilter;
    }

    // 8. Sorting with allowlist protection
    const ALLOWED_TX_SORT_FIELDS = ['date', 'amount', 'merchant', 'createdAt'] as const;
    const sortBy = safeSortField(query.sortBy, ALLOWED_TX_SORT_FIELDS, 'createdAt');
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder, _id: -1 };

    // 9. Pagination calculations
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    // 10. Execute data query & financial summary aggregation in parallel
    const [transactions, total, summaryAggregation] = await Promise.all([
      Transaction.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug icon color type')
        .lean(),

      Transaction.countDocuments(filter),

      Transaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalIncome: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.INCOME] }, '$amount', 0],
              },
            },
            totalExpense: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.EXPENSE] }, '$amount', 0],
              },
            },
            transactionCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summaryResult = summaryAggregation[0] || {
      totalIncome: 0,
      totalExpense: 0,
      transactionCount: 0,
    };

    const totalIncome = Math.round(summaryResult.totalIncome * 100) / 100;
    const totalExpense = Math.round(summaryResult.totalExpense * 100) / 100;
    const netCashFlow = Math.round((totalIncome - totalExpense) * 100) / 100;

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalIncome,
        totalExpense,
        netCashFlow,
        transactionCount: summaryResult.transactionCount || total,
      },
    };
  }

  /**
   * Get single transaction details by ID
   */
  static async getTransactionById(userId: string, transactionId: string): Promise<ITransaction> {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).populate('category', 'name slug icon color type');

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }

  /**
   * Update transaction details
   */
  static async updateTransaction(
    userId: string,
    transactionId: string,
    input: UpdateTransactionInput,
  ): Promise<ITransaction> {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // If category is being updated, verify it exists
    if (input.category) {
      const categoryDoc = await Category.findOne({
        _id: input.category,
        isDeleted: false,
        $or: [{ isSystem: true }, { userId: new Types.ObjectId(userId) }, { userId: null }],
      });
      if (!categoryDoc) {
        throw new NotFoundError('Referenced category was not found or is inactive');
      }
      transaction.category = new Types.ObjectId(input.category);
    }

    if (input.amount !== undefined) transaction.amount = input.amount;
    if (input.type !== undefined) transaction.type = input.type;
    if (input.merchant !== undefined) transaction.merchant = input.merchant;
    if (input.description !== undefined) transaction.description = input.description;
    if (input.subcategory !== undefined) transaction.subcategory = input.subcategory;
    if (input.date !== undefined) transaction.date = input.date;
    if (input.paymentMethod !== undefined) transaction.paymentMethod = input.paymentMethod;
    if (input.currency !== undefined) transaction.currency = input.currency;
    if (input.notes !== undefined) transaction.notes = input.notes;
    if (input.tags !== undefined) transaction.tags = input.tags;
    if (input.source !== undefined) transaction.source = input.source;
    if (input.attachments !== undefined) transaction.attachments = input.attachments;
    if (input.metadata !== undefined) transaction.metadata = input.metadata;

    const recurringUpdate = input.recurring ?? input.isRecurring;
    if (recurringUpdate !== undefined) {
      transaction.isRecurring = recurringUpdate;
    }

    await transaction.save();
    await transaction.populate('category', 'name slug icon color type');

    // Invalidate cached user dashboard analytics on mutation
    cacheService.del(`user:${userId}:analytics:dashboard`).catch(() => {});
    emitToUser(userId, 'report:invalidate', { action: 'update', transactionId: transaction._id });
    emitToUser(userId, 'transaction:changed', { action: 'update', transactionId: transaction._id });

    // Real-time synchronization of recurring patterns on edit
    RecurringService.syncOnTransactionChange(userId, transaction, 'update').catch((err) => {
      logger.error('Failed to sync recurring patterns on transaction update', err);
    });

    return transaction;
  }

  /**
   * Soft-delete a transaction
   */
  static async deleteTransaction(userId: string, transactionId: string): Promise<void> {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    transaction.isDeleted = true;
    transaction.deletedAt = new Date();
    await transaction.save();

    // Invalidate cached user dashboard analytics on mutation
    cacheService.del(`user:${userId}:analytics:dashboard`).catch(() => {});
    emitToUser(userId, 'report:invalidate', { action: 'delete', transactionId });
    emitToUser(userId, 'transaction:changed', { action: 'delete', transactionId });

    // Real-time synchronization of recurring patterns on deletion
    RecurringService.syncOnTransactionChange(userId, transaction, 'delete').catch((err) => {
      logger.error('Failed to sync recurring patterns on transaction delete', err);
    });
  }
}
