import { api } from './api.ts';
import {
  FinancialAnomaly,
  AnomalySummary,
  AnomalyFilters,
  AnomalyStatus,
  AnomalyFeedbackType,
} from '../types/anomaly.ts';

export interface AnomalyListResponse {
  success: boolean;
  data: FinancialAnomaly[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface DetectionResult {
  status: 'success' | 'insufficient_data';
  message: string;
  userId: string;
  totalEvaluated: number;
  anomaliesDetected: number;
  anomalies: FinancialAnomaly[];
  detectorMetadata?: any;
}

export class AnomalyService {
  /**
   * Triggers anomaly detection scan for the user.
   */
  static async detectAnomalies(
    options: { lookbackDays?: number; minHistoryCount?: number } = {},
  ): Promise<DetectionResult> {
    const res = await api.request<{ success: boolean; data: DetectionResult }>(
      '/anomalies/detect',
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
    );
    return res.data;
  }

  /**
   * Retrieves paginated anomalies with optional filters.
   */
  static async getAnomalies(filters: AnomalyFilters = {}): Promise<AnomalyListResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.anomalyType) params.append('anomalyType', filters.anomalyType);
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.category) params.append('category', filters.category);
    if (filters.merchant) params.append('merchant', filters.merchant);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return api.request<AnomalyListResponse>(`/anomalies${queryStr}`);
  }

  /**
   * Retrieves aggregated summary counts.
   */
  static async getSummary(): Promise<AnomalySummary> {
    const res = await api.request<{ success: boolean; data: AnomalySummary }>(
      '/anomalies/summary',
    );
    return res.data;
  }

  /**
   * Retrieves single anomaly details by ID.
   */
  static async getAnomalyById(id: string): Promise<FinancialAnomaly> {
    const res = await api.request<{ success: boolean; data: FinancialAnomaly }>(
      `/anomalies/${id}`,
    );
    return res.data;
  }

  /**
   * Updates an anomaly review status.
   */
  static async updateStatus(id: string, status: AnomalyStatus): Promise<FinancialAnomaly> {
    const res = await api.request<{ success: boolean; data: FinancialAnomaly }>(
      `/anomalies/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    );
    return res.data;
  }

  /**
   * Submits user feedback on an anomaly.
   */
  static async recordFeedback(
    id: string,
    feedback: AnomalyFeedbackType,
    notes?: string,
  ): Promise<FinancialAnomaly> {
    const res = await api.request<{ success: boolean; data: FinancialAnomaly }>(
      `/anomalies/${id}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify({ feedback, notes }),
      },
    );
    return res.data;
  }
}
