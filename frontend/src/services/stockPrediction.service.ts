/**
 * Stock Prediction API Service.
 * Interfaces with the FastAPI ML service (or Node backend proxy).
 */

import {
  StockPredictionRequest,
  StockPredictionResponse,
  PredictionHistoryResponse,
  ModelListResponse,
  ModelMetricsResponse,
  MLOverviewData,
  ModelDetailData,
  PipelineHealthData,
  MarketForecastsResponse,
  StockIntelligenceResponse,
  StockPredictionIntelligenceItem,
  SectorsPerformanceResponse,
  ModelArchitectureBenchmarkResponse,
  StockModelComparisonResponse,
  TrainingStatusData,
} from '../types/stockPrediction.ts';

// Direct FastAPI ML service endpoint or proxied URL
const ML_API_BASE =
  import.meta.env.VITE_ML_API_URL || 'http://localhost:8000/api/v1';
const BACKEND_API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

class StockPredictionService {
  /**
   * Helper to perform fetch with JSON handling and structured error propagation
   */
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const directUrl = `${ML_API_BASE}${endpoint}`;

    try {
      const response = await fetch(directUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string>),
        },
      });

      let data;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorDetail =
          data?.detail ||
          data?.message ||
          data?.error?.message ||
          `Prediction API error (Status ${response.status})`;
        const error = new Error(errorDetail);
        (error as unknown as { status: number }).status = response.status;
        (error as unknown as { detail: string }).detail = errorDetail;
        throw error;
      }

      return data as T;
    } catch (err: unknown) {
      // If direct ML service connection refused, try backend proxy fallback
      if (
        err instanceof TypeError &&
        err.message.toLowerCase().includes('failed to fetch')
      ) {
        return this.requestViaBackendProxy<T>(endpoint, options);
      }
      throw err;
    }
  }

  /**
   * Fallback via Node backend proxy
   */
  private static async requestViaBackendProxy<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = localStorage.getItem('smartfin_access_token');
    const proxyUrl = `${BACKEND_API_BASE}/stocks/predictions/proxy?path=${encodeURIComponent(endpoint)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(proxyUrl, {
      ...options,
      headers,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const msg = data?.detail || data?.message || 'Proxy request failed';
      throw new Error(msg);
    }

    return (data.data || data) as T;
  }

  /**
   * Generate real-time stock prediction from registered ML models
   * POST /api/v1/predictions/stock
   */
  static async predict(
    payload: StockPredictionRequest,
  ): Promise<StockPredictionResponse> {
    return this.request<StockPredictionResponse>('/predictions/stock', {
      method: 'POST',
      body: JSON.stringify({
        symbol: payload.symbol.trim().toUpperCase(),
        horizon: payload.horizon ?? 1,
        target: payload.target ?? 'target_next_return',
        model_version: payload.model_version || null,
        allow_candidate: payload.allow_candidate ?? true,
      }),
    });
  }

  /**
   * Retrieve paginated prediction history for a ticker
   * GET /api/v1/predictions/stock/{symbol}/history
   */
  static async getPredictionHistory(
    symbol: string,
    options: {
      limit?: number;
      offset?: number;
      horizon?: number;
      model_name?: string;
    } = {},
  ): Promise<PredictionHistoryResponse> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.append('limit', String(options.limit));
    if (options.offset !== undefined) params.append('offset', String(options.offset));
    if (options.horizon !== undefined) params.append('horizon', String(options.horizon));
    if (options.model_name) params.append('model_name', options.model_name);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());

    return this.request<PredictionHistoryResponse>(
      `/predictions/stock/${cleanSym}/history${qs}`,
    );
  }

  /**
   * List all registered stock models with public metadata
   * GET /api/v1/models/stock
   */
  static async listModels(
    options: {
      symbol?: string;
      status?: string;
      target?: string;
    } = {},
  ): Promise<ModelListResponse> {
    const params = new URLSearchParams();
    if (options.symbol) params.append('symbol', options.symbol.trim().toUpperCase());
    if (options.status) params.append('status', options.status);
    if (options.target) params.append('target', options.target);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<ModelListResponse>(`/models/stock${qs}`);
  }

  /**
   * Get historical evaluation metrics for all registered models for a symbol
   * GET /api/v1/models/stock/{symbol}/metrics
   */
  static async getModelMetrics(symbol: string): Promise<ModelMetricsResponse> {
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
    return this.request<ModelMetricsResponse>(`/models/stock/${cleanSym}/metrics`);
  }

  /**
   * Inspect cache diagnostics
   * GET /api/v1/models/stock/cache/stats
   */
  static async getCacheStats(): Promise<{
    cache_size: number;
    capacity: number;
    cached_model_ids: string[];
  }> {
    return this.request('/models/stock/cache/stats');
  }

  /**
   * Clear in-memory model cache
   * POST /api/v1/models/stock/cache/clear
   */
  static async clearCache(): Promise<{ message: string }> {
    return this.request('/models/stock/cache/clear', { method: 'POST' });
  }

  /**
   * Promote or demote model status
   * POST /api/v1/models/stock/{model_id}/promote
   */
  static async promoteModel(
    modelId: string,
    newStatus: string,
    reason = 'Promoted via dashboard',
  ): Promise<unknown> {
    return this.request(`/models/stock/${modelId}/promote`, {
      method: 'POST',
      body: JSON.stringify({ new_status: newStatus, reason }),
    });
  }

  /**
   * Retrieve centralized ML prediction overview, KPIs, and stock coverage
   * GET /api/v1/models/stock/overview
   */
  static async getModelOverview(): Promise<MLOverviewData> {
    return this.request<MLOverviewData>('/models/stock/overview');
  }

  /**
   * Retrieve deep metadata, hyperparameters, and feature list for a model
   * GET /api/v1/models/stock/{model_id}/details
   */
  static async getModelDetails(modelId: string): Promise<ModelDetailData> {
    const cleanId = encodeURIComponent(modelId.trim());
    return this.request<ModelDetailData>(`/models/stock/${cleanId}/details`);
  }

  /**
   * Retrieve global prediction history across all stocks with filters
   * GET /api/v1/predictions/stock/history
   */
  static async getGlobalPredictionHistory(
    options: {
      symbol?: string;
      horizon?: number;
      model?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<PredictionHistoryResponse> {
    const params = new URLSearchParams();
    if (options.symbol && options.symbol.toUpperCase() !== 'ALL') {
      params.append('symbol', options.symbol.trim().toUpperCase());
    }
    if (options.horizon) params.append('horizon', String(options.horizon));
    if (options.model && options.model.toUpperCase() !== 'ALL') {
      params.append('model', options.model.trim());
    }
    if (options.status && options.status.toUpperCase() !== 'ALL') {
      params.append('status', options.status.trim());
    }
    if (options.limit !== undefined) params.append('limit', String(options.limit));
    if (options.offset !== undefined) params.append('offset', String(options.offset));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<PredictionHistoryResponse>(`/predictions/stock/history${qs}`);
  }

  /**
   * Retrieve real-time multi-stock market forecasts for an active horizon
   * GET /api/v1/predictions/stock/market-forecasts?horizon={horizon}
   */
  static async getMarketForecasts(horizon: number = 1): Promise<MarketForecastsResponse> {
    return this.request<MarketForecastsResponse>(
      `/predictions/stock/market-forecasts?horizon=${horizon}`,
    );
  }

  /**
   * Retrieve real-time health diagnostics of ML pipeline subsystems
   * GET /api/v1/models/stock/health
   */
  static async getPipelineHealth(): Promise<PipelineHealthData> {
    return this.request<PipelineHealthData>('/models/stock/health');
  }

  /**
   * Production-grade AI Stock Screener
   * GET /api/v1/predictions/stocks
   */
  static async getScreenerPredictions(
    options: {
      search?: string;
      sector?: string;
      industry?: string;
      market?: string;
      horizon?: number;
      direction?: string;
      min_return?: number;
      max_return?: number;
      return_range?: string;
      model?: string;
      min_accuracy?: number;
      sort?: string;
      preset?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<StockIntelligenceResponse> {
    const params = new URLSearchParams();
    if (options.search) params.append('search', options.search.trim());
    if (options.sector && options.sector.toLowerCase() !== 'all') params.append('sector', options.sector.trim());
    if (options.industry && options.industry.toLowerCase() !== 'all') params.append('industry', options.industry.trim());
    if (options.market && options.market.toLowerCase() !== 'all') params.append('market', options.market.trim());
    if (options.horizon) params.append('horizon', String(options.horizon));
    if (options.direction && options.direction.toLowerCase() !== 'all') params.append('direction', options.direction.trim());
    if (options.min_return !== undefined && options.min_return !== null) params.append('min_return', String(options.min_return));
    if (options.max_return !== undefined && options.max_return !== null) params.append('max_return', String(options.max_return));
    if (options.return_range) params.append('return_range', options.return_range);
    if (options.model && options.model.toLowerCase() !== 'all') params.append('model', options.model.trim());
    if (options.min_accuracy !== undefined && options.min_accuracy !== null) params.append('min_accuracy', String(options.min_accuracy));
    if (options.sort) params.append('sort', options.sort);
    if (options.preset) params.append('preset', options.preset);
    if (options.page) params.append('page', String(options.page));
    if (options.limit) params.append('limit', String(options.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<StockIntelligenceResponse>(`/predictions/stocks${qs}`);
  }

  /**
   * Retrieve stock detail with multi-horizon predictions
   * GET /api/v1/predictions/stocks/{symbol}
   */
  static async getStockDetail(symbol: string): Promise<StockPredictionIntelligenceItem> {
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
    return this.request<StockPredictionIntelligenceItem>(`/predictions/stocks/${cleanSym}`);
  }

  /**
   * Retrieve model comparison for a stock across horizons
   * GET /api/v1/predictions/stocks/{symbol}/models
   */
  static async getStockModelComparison(symbol: string): Promise<StockModelComparisonResponse> {
    const cleanSym = encodeURIComponent(symbol.trim().toUpperCase());
    return this.request<StockModelComparisonResponse>(`/predictions/stocks/${cleanSym}/models`);
  }

  /**
   * Sector-level AI Predicted Performance Rankings
   * GET /api/v1/predictions/sectors?horizon={horizon}
   */
  static async getSectorPerformance(horizon: number = 1): Promise<SectorsPerformanceResponse> {
    return this.request<SectorsPerformanceResponse>(`/predictions/sectors?horizon=${horizon}`);
  }

  /**
   * Model Architecture Performance Benchmarks
   * GET /api/v1/predictions/model-performance?horizon={horizon}
   */
  static async getModelArchitecturePerformance(horizon: number = 1): Promise<ModelArchitectureBenchmarkResponse> {
    return this.request<ModelArchitectureBenchmarkResponse>(`/predictions/model-performance?horizon=${horizon}`);
  }

  /**
   * Retrieve real ML Universe Training Pipeline Status
   * GET /api/v1/training/status
   */
  static async getTrainingStatus(): Promise<TrainingStatusData> {
    return this.request<TrainingStatusData>('/training/status');
  }

  /**
   * Trigger asynchronous universe retraining job
   * POST /api/v1/training/stocks
   */
  static async triggerUniverseRetraining(): Promise<{ message: string; status: string }> {
    return this.request('/training/stocks', { method: 'POST' });
  }
}

export { StockPredictionService };
export default StockPredictionService;

