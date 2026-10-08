/**
 * TypeScript types for SmartFin AI Stock Intelligence & Prediction.
 * Corresponds to FastAPI ML inference schemas and model registry contracts.
 */

export interface StockPredictionRequest {
  symbol: string;
  horizon?: number;
  target?: string;
  model_version?: string | null;
  allow_candidate?: boolean;
}

export interface HistoricalMetrics {
  mae?: number;
  rmse?: number;
  mape?: number;
  r2?: number;
  directional_accuracy?: number;
  directional_precision?: number;
  directional_recall?: number;
  directional_f1?: number;
  sample_count?: number;
  ticker?: string;
  model_name?: string;
  target?: string;
  period?: string;
  zero_return_treatment?: string;
  [key: string]: unknown;
}

export interface PredictionLatencyMs {
  total_ms: number;
  market_data_ms: number;
  model_load_ms: number;
  feature_gen_ms: number;
  inference_ms: number;
}

export interface ForecastSignal {
  name: string;
  type: 'positive' | 'negative' | 'neutral' | string;
  label: string;
  value?: string | null;
}

export interface StockPredictionResponse {
  symbol: string;
  market_data_timestamp: string;
  prediction_timestamp: string;
  current_price: number;
  predicted_value: number;
  predicted_return: number;
  direction?: 'Bullish' | 'Bearish' | 'Neutral' | string;
  confidence_score?: number | null;
  signals?: ForecastSignal[];
  is_derived_price: boolean;
  is_derived_return: boolean;
  horizon: number;
  target: string;
  model_name: string;
  model_version: string;
  feature_version: string;
  model_status: 'PRODUCTION' | 'CANDIDATE' | 'EXPERIMENTAL' | 'RETIRED' | string;
  historical_metrics: HistoricalMetrics;
  latency_ms: PredictionLatencyMs;
  disclaimer: string;
}

export interface ModelMetadataCard {
  model_id: string;
  symbol: string;
  model_name: string;
  model_version: string;
  ticker?: string;
  target: string;
  horizon: number;
  feature_version: string;
  preprocessing_version: string;
  status: 'PRODUCTION' | 'CANDIDATE' | 'EXPERIMENTAL' | 'RETIRED' | string;
  training_start?: string;
  training_end?: string;
  validation_start?: string;
  validation_end?: string;
  test_start?: string;
  test_end?: string;
  training_timestamp?: string;
  dataset_version?: string;
  metrics: {
    validation?: HistoricalMetrics;
    test?: HistoricalMetrics;
    [key: string]: unknown;
  };
  hyperparameters?: Record<string, unknown>;
}

export interface ModelListResponse {
  total_count: number;
  total_models?: number;
  models: ModelMetadataCard[];
}

export interface ModelMetricsResponse {
  symbol: string;
  models: ModelMetadataCard[];
}

export interface StockPredictionRecord {
  id?: string;
  prediction_id?: string;
  symbol: string;
  prediction_timestamp: string;
  market_data_timestamp: string;
  horizon: number;
  target: string;
  current_price: number;
  predicted_value?: number;
  predicted_return?: number;
  is_derived_price?: boolean;
  is_derived_return?: boolean;
  model_name: string;
  model_version: string;
  feature_version: string;
  model_status: string;
  actual_value?: number | null;
  actual_return?: number | null;
  error?: number | null;
  direction?: 'Correct' | 'Incorrect' | 'Pending' | string;
  status?: 'PENDING' | 'COMPLETED' | 'EVALUATED' | string;
}

export interface PredictionHistoryResponse {
  symbol?: string | null;
  total_count: number;
  limit: number;
  offset: number;
  items: StockPredictionRecord[];
}

export interface TechnicalIndicatorData {
  date: string;
  close: number;
  sma20?: number;
  sma50?: number;
  ema20?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  rsi?: number;
  volume?: number;
}

export interface SupportedStockCoverage {
  symbol: string;
  company_name: string;
  market: string;
  model_status: 'READY' | 'CANDIDATE' | 'MODEL NOT REGISTERED' | string;
  model_type: string;
  supported_horizons: number[];
  target: string;
  model_version: string;
  last_trained: string;
  directional_accuracy?: number | null;
  models_count: number;
  best_model_name?: string | null;
}

export interface UnsupportedStockInfo {
  symbol: string;
  company_name: string;
  market: string;
  model_status: string;
  message: string;
}

export interface HorizonLatestPrediction {
  symbol?: string;
  model_name?: string;
  predicted_return?: number;
  predicted_close_price?: number;
  timestamp?: string;
}

export interface HorizonCoverageItem {
  horizon: number;
  label: string;
  models_count: number;
  stocks_supported: number;
  avg_mae?: number | null;
  avg_rmse?: number | null;
  avg_directional_accuracy?: number | null;
  latest_prediction?: HorizonLatestPrediction | null;
}

export interface StockPerformanceMetric {
  symbol: string;
  directional_accuracy: number;
  rmse: number;
  mae: number;
  r2: number;
  model_name: string;
}

export interface ModelArchitecturePerformance {
  model_name: string;
  count: number;
  avg_rmse: number;
  avg_mae: number;
  avg_directional_accuracy: number;
}

export interface MLOverviewData {
  total_models: number;
  supported_stocks_count: number;
  production_models: number;
  candidate_models: number;
  total_prediction_requests: number;
  average_directional_accuracy?: number | null;
  last_training_timestamp?: string | null;
  latest_inference_timestamp?: string | null;
  status: string;
  supported_stocks: SupportedStockCoverage[];
  unsupported_stocks: UnsupportedStockInfo[];
  horizon_coverage: HorizonCoverageItem[];
  performance_by_stock: StockPerformanceMetric[];
  performance_by_model: ModelArchitecturePerformance[];
}

export interface ModelDetailData {
  model_id: string;
  model_name: string;
  model_version: string;
  ticker: string;
  target: string;
  horizon: number;
  status: string;
  feature_version: string;
  preprocessing_version: string;
  dataset_version: string;
  training_start: string;
  training_end: string;
  validation_start: string;
  validation_end: string;
  test_start: string;
  test_end: string;
  training_timestamp: string;
  hyperparameters: Record<string, unknown>;
  metrics: {
    validation?: HistoricalMetrics;
    test?: HistoricalMetrics;
    [key: string]: unknown;
  };
  status_history: Array<{ status: string; timestamp: string; reason?: string }>;
  features_used: string[];
}

export interface PipelineHealthData {
  market_data_api: {
    status: string;
    provider?: string;
    latency_ms?: number;
    message?: string;
  };
  ml_inference_api: {
    status: string;
    service?: string;
    latency_ms?: number;
    active_cache_entries?: number;
  };
  model_registry: {
    status: string;
    registered_models?: number;
    catalog_status?: string;
  };
  database: {
    status: string;
    engine?: string;
    audit_records_count?: number;
  };
  latest_model_status: string;
  overall_status: string;
  timestamp: string;
}

export interface MarketForecastItem {
  symbol: string;
  company_name: string;
  market: string;
  current_price?: number | null;
  predicted_price?: number | null;
  predicted_return?: number | null;
  direction: 'Bullish' | 'Bearish' | 'Neutral' | string;
  horizon: number;
  model_name: string;
  model_version: string;
  historical_accuracy?: number | null;
  mae?: number | null;
  rmse?: number | null;
  r2?: number | null;
  last_updated?: string | null;
  status: 'READY' | 'UNAVAILABLE' | string;
  message?: string | null;
  signals?: ForecastSignal[] | null;
}

export interface MarketForecastsResponse {
  horizon: number;
  total_supported: number;
  forecasts: MarketForecastItem[];
}

export interface CandidateModelMetric {
  model_name: string;
  model_key: string;
  directional_accuracy: number;
  rmse: number;
  mae: number;
  r2: number;
  is_production: boolean;
}

export interface StockPredictionIntelligenceItem {
  rank: number;
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  market: string;
  market_cap_category: string;
  current_price: number;
  predicted_price: number;
  expected_return: number;
  direction: 'Bullish' | 'Neutral' | 'Bearish';
  horizon: number;
  best_model: string;
  best_model_key: string;
  directional_accuracy: number;
  reliability_level: 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';
  reliability_score: number;
  mae: number;
  rmse: number;
  r2: number;
  latest_market_date: string;
  prediction_timestamp: string;
  total_bars_evaluated?: number;
  candidate_models?: CandidateModelMetric[];
  horizons?: Record<string, {
    horizon: number;
    expected_return: number;
    predicted_price: number;
    direction: 'Bullish' | 'Neutral' | 'Bearish';
    best_model: string;
    best_model_key: string;
    directional_accuracy: number;
    reliability_level: string;
    reliability_score: number;
    mae: number;
    rmse: number;
    r2: number;
    candidate_models?: CandidateModelMetric[];
  }>;
}

export interface UniverseIntelligenceSummary {
  total_supported: number;
  predictions_available: number;
  stocks_without_valid_models: number;
  registered_models: number;
  production_models: number;
  predictions_generated: number;
  avg_directional_accuracy: number;
  last_training_time?: string | null;
  last_prediction_update?: string | null;
}

export interface StockIntelligenceResponse {
  items: StockPredictionIntelligenceItem[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  summary: UniverseIntelligenceSummary;
}

export interface SectorPerformanceItem {
  sector: string;
  avg_expected_return: number;
  stocks_count: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  top_stock_symbol: string;
  top_stock_return: number;
}

export interface SectorsPerformanceResponse {
  sectors: SectorPerformanceItem[];
  timestamp: string;
}

export interface ModelArchitectureBenchmarkItem {
  model_name: string;
  model_key: string;
  stocks_evaluated: number;
  avg_directional_accuracy: number;
  avg_mae: number;
  avg_rmse: number;
  avg_r2: number;
  production_models_count: number;
}

export interface ModelArchitectureBenchmarkResponse {
  models: ModelArchitectureBenchmarkItem[];
  timestamp: string;
}

export interface StockModelComparisonResponse {
  symbol: string;
  company_name: string;
  sector: string;
  current_price: number;
  horizons: Record<string, any>;
}

export interface TrainingStatusData {
  total_discovered: number;
  completed: number;
  insufficient_data: number;
  failed_validation: number;
  registered_models: number;
  production_models: number;
  rejected_stocks: Array<{ symbol: string; reason: string; available_bars?: number }>;
  status: 'IDLE' | 'TRAINING' | 'COMPLETED' | string;
  duration_seconds: number;
  last_training_timestamp?: string | null;
}

