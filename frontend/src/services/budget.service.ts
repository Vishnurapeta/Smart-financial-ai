import { api } from './api.ts';
import {
  Budget,
  MonthlyBudgetSummary,
  BudgetHistoryPoint,
  MonthlyComparisonResult,
  CreateBudgetDTO,
  UpdateBudgetDTO,
} from '../types/budget.ts';

export class BudgetService {
  /**
   * Get all active budgets for a specific month (with real-time calculated transaction spending)
   */
  static async getBudgets(month?: string, categoryId?: string): Promise<Budget[]> {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (categoryId) params.append('categoryId', categoryId);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{
      success: boolean;
      data: { budgets: Budget[] };
    }>(`/budgets${qs}`);

    return res.data.budgets;
  }

  /**
   * Get consolidated monthly budget summary
   */
  static async getBudgetSummary(month?: string): Promise<MonthlyBudgetSummary> {
    const params = new URLSearchParams();
    if (month) params.append('month', month);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{
      success: boolean;
      data: { summary: MonthlyBudgetSummary };
    }>(`/budgets/summary${qs}`);

    return res.data.summary;
  }

  /**
   * Get budget history across recent months
   */
  static async getBudgetHistory(months = 6): Promise<BudgetHistoryPoint[]> {
    const res = await api.request<{
      success: boolean;
      data: { history: BudgetHistoryPoint[] };
    }>(`/budgets/history?months=${months}`);

    return res.data.history;
  }

  /**
   * Compare two months of budgets and spending side-by-side
   */
  static async getMonthlyComparison(
    month1?: string,
    month2?: string,
  ): Promise<MonthlyComparisonResult> {
    const params = new URLSearchParams();
    if (month1) params.append('month1', month1);
    if (month2) params.append('month2', month2);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{
      success: boolean;
      data: { comparison: MonthlyComparisonResult };
    }>(`/budgets/comparison${qs}`);

    return res.data.comparison;
  }

  /**
   * Create a new category budget
   */
  static async createBudget(data: CreateBudgetDTO): Promise<Budget> {
    const res = await api.request<{
      success: boolean;
      data: { budget: Budget };
    }>('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return res.data.budget;
  }

  /**
   * Update an existing budget limit or settings
   */
  static async updateBudget(id: string, data: UpdateBudgetDTO): Promise<Budget> {
    const res = await api.request<{
      success: boolean;
      data: { budget: Budget };
    }>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    return res.data.budget;
  }

  /**
   * Delete a budget
   */
  static async deleteBudget(id: string): Promise<void> {
    await api.request(`/budgets/${id}`, {
      method: 'DELETE',
    });
  }
}
