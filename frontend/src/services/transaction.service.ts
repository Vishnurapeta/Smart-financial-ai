import { api } from './api.ts';
import {
  Transaction,
  Category,
  PaginatedTransactionsResponse,
  TransactionFiltersState,
  CreateTransactionDTO,
  UpdateTransactionDTO,
} from '../types/transaction.ts';

export class TransactionService {
  /**
   * Fetch paginated and filtered transactions with backend aggregation metrics
   */
  static async getTransactions(
    filters: Partial<TransactionFiltersState> = {},
  ): Promise<PaginatedTransactionsResponse> {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search);
    if (filters.type) params.append('type', filters.type);
    if (filters.category) params.append('category', filters.category);
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.minAmount !== undefined && filters.minAmount !== '') {
      params.append('minAmount', filters.minAmount.toString());
    }
    if (filters.maxAmount !== undefined && filters.maxAmount !== '') {
      params.append('maxAmount', filters.maxAmount.toString());
    }
    if (filters.recurring !== undefined) {
      params.append('recurring', filters.recurring.toString());
    }
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.request<{
      success: boolean;
      data: PaginatedTransactionsResponse;
    }>(`/transactions${queryString}`);

    return response.data;
  }

  /**
   * Fetch single transaction details
   */
  static async getTransactionById(id: string): Promise<Transaction> {
    const response = await api.request<{
      success: boolean;
      data: { transaction: Transaction };
    }>(`/transactions/${id}`);

    return response.data.transaction;
  }

  /**
   * Create new transaction
   */
  static async createTransaction(data: CreateTransactionDTO): Promise<Transaction> {
    const response = await api.request<{
      success: boolean;
      data: { transaction: Transaction };
    }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const tx = response.data.transaction;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartfin:transaction-changed', { detail: { action: 'create', transaction: tx } }));
    }
    return tx;
  }

  /**
   * Update existing transaction
   */
  static async updateTransaction(id: string, data: UpdateTransactionDTO): Promise<Transaction> {
    const response = await api.request<{
      success: boolean;
      data: { transaction: Transaction };
    }>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    const tx = response.data.transaction;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartfin:transaction-changed', { detail: { action: 'update', transaction: tx } }));
    }
    return tx;
  }

  /**
   * Soft-delete transaction
   */
  static async deleteTransaction(id: string): Promise<void> {
    await api.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartfin:transaction-changed', { detail: { action: 'delete', id } }));
    }
  }

  /**
   * Fetch available system & custom categories
   */
  static async getCategories(): Promise<Category[]> {
    const response = await api.request<{
      success: boolean;
      data: { categories: Category[] };
    }>('/categories');

    return response.data.categories;
  }
}
