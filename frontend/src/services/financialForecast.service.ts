import { api } from './api.ts';
import {
  ExpenseForecastResponse,
  CashFlowForecastResponse,
  ForecastHistoryRecord,
} from '../types/forecasting.ts';

export class FinancialForecastService {
  /**
   * Generates or fetches an expense forecast for the authenticated user.
   */
  static async getExpenseForecast(
    options: {
      horizon?: number;
      frequency?: string;
      category?: string;
      preferredModel?: string;
    } = {},
  ): Promise<ExpenseForecastResponse> {
    const params = new URLSearchParams();
    if (options.horizon) params.append('horizon', options.horizon.toString());
    if (options.frequency) params.append('frequency', options.frequency);
    if (options.category && options.category !== 'all') params.append('category', options.category);
    if (options.preferredModel) params.append('preferredModel', options.preferredModel);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{ success: boolean; data: ExpenseForecastResponse }>(
      `/forecasts/expenses${queryStr}`,
    );
    return res.data;
  }

  /**
   * Generates or fetches a cash-flow forecast for the authenticated user.
   */
  static async getCashFlowForecast(
    options: {
      horizon?: number;
      frequency?: string;
    } = {},
  ): Promise<CashFlowForecastResponse> {
    const params = new URLSearchParams();
    if (options.horizon) params.append('horizon', options.horizon.toString());
    if (options.frequency) params.append('frequency', options.frequency);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{ success: boolean; data: CashFlowForecastResponse }>(
      `/forecasts/cash-flow${queryStr}`,
    );
    return res.data;
  }

  /**
   * Retrieves past persisted forecasts for audit and accuracy tracking.
   */
  static async getForecastHistory(
    options: { type?: string; limit?: number } = {},
  ): Promise<ForecastHistoryRecord[]> {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.limit) params.append('limit', options.limit.toString());

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{
      success: boolean;
      data: { history: ForecastHistoryRecord[]; total: number };
    }>(`/forecasts/history${queryStr}`);
    return res.data?.history || [];
  }
}
