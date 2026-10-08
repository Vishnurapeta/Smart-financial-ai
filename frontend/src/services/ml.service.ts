import { api } from './api.ts';
import {
  CategorizationFeedbackRequest,
  CategorizationRequest,
  CategorizationResult,
} from '../types/ml.ts';

export class MlService {
  /**
   * Parse natural-language transaction text using FastAPI ML Pipeline
   */
  static async categorize(payload: CategorizationRequest): Promise<CategorizationResult> {
    if (!payload || typeof payload.text !== 'string' || !payload.text.trim()) {
      throw new Error('Please enter a transaction description to parse.');
    }

    const response = await api.request<{
      success: boolean;
      data: CategorizationResult;
    }>('/ml/categorize', {
      method: 'POST',
      body: JSON.stringify({
        text: payload.text.trim(),
        dateContext: payload.dateContext,
      }),
    });

    return response.data;
  }

  /**
   * Record user confirmation or correction feedback for model retraining
   */
  static async submitFeedback(feedback: CategorizationFeedbackRequest): Promise<void> {
    try {
      await api.request<{
        success: boolean;
        message: string;
      }>('/ml/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback),
      });
    } catch (err) {
      console.warn('Failed to record ML feedback:', err);
    }
  }
}
