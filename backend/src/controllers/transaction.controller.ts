import { Request, Response, NextFunction } from 'express';
import { TransactionService } from '../services/transaction.service.js';
import { QueryTransactionsInput } from '../validations/transaction.validation.js';

export class TransactionController {
  /**
   * Create a new transaction (income / expense / transfer)
   */
  static async createTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await TransactionService.createTransaction(req.user!.userId, req.body);

      res.status(201).json({
        success: true,
        data: { transaction },
        message: 'Transaction successfully created',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List transactions with filtering, search, sorting, pagination, and calculated financial summaries
   */
  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as QueryTransactionsInput;
      const result = await TransactionService.getTransactions(req.user!.userId, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single transaction details
   */
  static async getTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await TransactionService.getTransactionById(
        req.user!.userId,
        req.params.id,
      );

      res.status(200).json({
        success: true,
        data: { transaction },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update transaction details
   */
  static async updateTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await TransactionService.updateTransaction(
        req.user!.userId,
        req.params.id,
        req.body,
      );

      res.status(200).json({
        success: true,
        data: { transaction },
        message: 'Transaction successfully updated',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft-delete a transaction
   */
  static async deleteTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await TransactionService.deleteTransaction(req.user!.userId, req.params.id);

      res.status(200).json({
        success: true,
        data: null,
        message: 'Transaction successfully deleted',
      });
    } catch (error) {
      next(error);
    }
  }
}
