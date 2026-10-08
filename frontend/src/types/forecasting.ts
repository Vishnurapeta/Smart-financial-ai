export interface MonthlyDataPoint {
  period: string; // YYYY-MM
  total_expense: number;
  total_income: number;
  category_expenses: Record<string, number>;
  transaction_count: number;
}

export interface ForecastPeriodItem {
  period: string;
  predicted_expense: number;
  fixed_recurring_expenses: number;
  variable_expenses: number;
  lower_bound?: number;
  upper_bound?: number;
  timestamp: string;
}

export interface CashFlowForecastPeriodItem {
  period: string;
  expected_income: number;
  expected_expenses: number;
  fixed_recurring_expenses: number;
  variable_expenses: number;
  planned_contributions: number;
  projected_net_cash_flow: number;
  is_deficit: boolean;
  timestamp: string;
}

export interface CategoryForecastItem {
  category: string;
  predicted_expense: number;
  historical_avg: number;
  history_months: number;
  status: 'eligible' | 'insufficient_data';
}

export interface ModelMetadataItem {
  name: string;
  version: string;
  feature_version: string;
  model_type: string;
  training_period: string;
  selection_reason: string;
}

export interface ForecastMetricsItem {
  mae: number;
  rmse: number;
  mape?: number;
  r2?: number;
}

export interface CandidateModelComparisonItem {
  name: string;
  mae: number;
  rmse: number;
  mape?: number;
  is_selected: boolean;
}

export interface ExpenseForecastResponse {
  status: 'success' | 'insufficient_data';
  message?: string;
  min_history_required: number;
  actual_history_months: number;
  user_id: string;
  forecast_type: 'expense';
  frequency: string;
  category?: string | null;
  historical_series: MonthlyDataPoint[];
  forecast: ForecastPeriodItem[];
  category_forecasts: CategoryForecastItem[];
  model?: ModelMetadataItem;
  metrics?: ForecastMetricsItem;
  candidate_models?: CandidateModelComparisonItem[];
  disclaimer: string;
}

export interface CashFlowForecastResponse {
  status: 'success' | 'insufficient_data';
  message?: string;
  min_history_required: number;
  actual_history_months: number;
  user_id: string;
  forecast_type: 'cash_flow';
  frequency: string;
  historical_series: MonthlyDataPoint[];
  forecast: CashFlowForecastPeriodItem[];
  recurring_commitments_monthly: number;
  planned_contributions_monthly: number;
  model?: ModelMetadataItem;
  metrics?: ForecastMetricsItem;
  candidate_models?: CandidateModelComparisonItem[];
  disclaimer: string;
}

export interface ForecastHistoryRecord {
  _id: string;
  userId: string;
  forecastType: 'expense' | 'cash_flow';
  frequency: string;
  horizon: number;
  status: string;
  actualHistoryMonths: number;
  forecast: Array<{
    period: string;
    predictedExpense?: number;
    expectedIncome?: number;
    expectedExpenses?: number;
    projectedNetCashFlow?: number;
  }>;
  modelMetadata?: {
    name: string;
    version: string;
    modelType: string;
    selectionReason: string;
  };
  metrics?: {
    mae: number;
    rmse: number;
    mape?: number;
  };
  generatedAt: string;
}
