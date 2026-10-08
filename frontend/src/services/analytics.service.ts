import { api } from './api.ts';
import { DashboardAnalyticsResponse } from '../types/analytics.ts';

export class AnalyticsService {
  /**
   * Fetch complete consolidated financial intelligence dashboard metrics
   */
  static async getDashboardAnalytics(): Promise<DashboardAnalyticsResponse> {
    const response = await api.request<{
      success: boolean;
      data: DashboardAnalyticsResponse;
    }>('/analytics/dashboard');

    return response.data;
  }
}
