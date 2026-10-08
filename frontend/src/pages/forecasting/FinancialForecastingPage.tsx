import React from 'react';
import { Header } from '../../components/Header.tsx';
import { ForecastSummaryCards } from '../../components/forecasting/ForecastSummaryCards.tsx';
import { ExpenseForecastChart } from '../../components/forecasting/ExpenseForecastChart.tsx';
import { CashFlowForecastChart } from '../../components/forecasting/CashFlowForecastChart.tsx';
import { CategoryForecastBreakdown } from '../../components/forecasting/CategoryForecastBreakdown.tsx';
import { RecurringCommitmentsSection } from '../../components/forecasting/RecurringCommitmentsSection.tsx';
import { ForecastModelInfoCard } from '../../components/forecasting/ForecastModelInfoCard.tsx';
import { DataSufficiencyBanner } from '../../components/forecasting/DataSufficiencyBanner.tsx';
import { ForecastDisclaimer } from '../../components/forecasting/ForecastDisclaimer.tsx';
import { useFinancialForecast } from '../../hooks/useFinancialForecast.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import {
  TrendingUp,
  Wallet,
  Sparkles,
  RotateCw,
} from 'lucide-react';

const HORIZON_OPTIONS = [
  { label: '1 Month', value: 1 },
  { label: '3 Months (Quarter)', value: 3 },
  { label: '6 Months (Half-Year)', value: 6 },
];

export const FinancialForecastingPage: React.FC = () => {
  const {
    horizon,
    setHorizon,
    activeTab,
    setActiveTab,
    category,
    setCategory,
    preferredModel,
    setPreferredModel,
    expenseData,
    cashFlowData,
    loading,
    isInsufficient,
    refresh,
  } = useFinancialForecast();

  // Distinct category list from historical series
  const categoriesList = React.useMemo(() => {
    const cats = new Set<string>();
    expenseData?.historical_series?.forEach((h) => {
      Object.keys(h.category_expenses || {}).forEach((k) => cats.add(k));
    });
    return Array.from(cats);
  }, [expenseData]);

  const { symbol: currencySymbol } = useCurrency();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SmartFin AI Predictive Financial Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Expense &amp; Cash-Flow Forecasting
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Probabilistic estimates of future monthly outflows, expected inflows, and liquidity trajectories based on historical user data.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Horizon Selector */}
            <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
              {HORIZON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHorizon(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    horizon === opt.value
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Model Preference Selector */}
            <div className="relative">
              <select
                value={preferredModel}
                onChange={(e) => setPreferredModel(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="auto">Champion (Lowest Holdout MAE)</option>
                <option value="3-Month Moving Average">3-Month Moving Average</option>
                <option value="Linear Regression">Linear Regression</option>
                <option value="Random Forest">Random Forest</option>
                <option value="XGBoost">XGBoost</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Forecast"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('cash_flow')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'cash_flow'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Cash-Flow &amp; Liquidity Forecast</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'expenses'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Expense Forecast</span>
          </button>

          {/* Category filter if on Expense tab */}
          {activeTab === 'expenses' && categoriesList.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">Category:</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Insufficient Data State */}
        {isInsufficient ? (
          <DataSufficiencyBanner
            actualMonths={expenseData?.actual_history_months ?? cashFlowData?.actual_history_months ?? 0}
            minMonthsRequired={expenseData?.min_history_required ?? cashFlowData?.min_history_required ?? 3}
          />
        ) : (
          <>
            {/* 1. Metric Summary Cards */}
            <ForecastSummaryCards
              cashFlowData={cashFlowData}
              expenseData={expenseData}
              currencySymbol={currencySymbol}
            />

            {/* 2. Main Visualizations by Tab */}
            {activeTab === 'cash_flow' ? (
              <div className="space-y-6">
                <CashFlowForecastChart
                  cashFlowData={cashFlowData}
                  currencySymbol={currencySymbol}
                  loading={loading}
                />

                <RecurringCommitmentsSection
                  recurringTotalMonthly={cashFlowData?.recurring_commitments_monthly ?? 0}
                  fixedForecastExpense={cashFlowData?.forecast?.[0]?.fixed_recurring_expenses ?? 0}
                  variableForecastExpense={cashFlowData?.forecast?.[0]?.variable_expenses ?? 0}
                  currencySymbol={currencySymbol}
                />
              </div>
            ) : (
              <div className="space-y-6">
                <ExpenseForecastChart
                  expenseData={expenseData}
                  currencySymbol={currencySymbol}
                  loading={loading}
                />

                <CategoryForecastBreakdown
                  categoryForecasts={expenseData?.category_forecasts || []}
                  currencySymbol={currencySymbol}
                  totalPredictedExpense={expenseData?.forecast?.[0]?.predicted_expense || 0}
                />

                <RecurringCommitmentsSection
                  recurringTotalMonthly={
                    expenseData?.historical_series?.[0] ? cashFlowData?.recurring_commitments_monthly ?? 0 : 0
                  }
                  fixedForecastExpense={expenseData?.forecast?.[0]?.fixed_recurring_expenses ?? 0}
                  variableForecastExpense={expenseData?.forecast?.[0]?.variable_expenses ?? 0}
                  currencySymbol={currencySymbol}
                />
              </div>
            )}

            {/* 3. Model Architecture, Rationale & Holdout Validation Metrics */}
            <ForecastModelInfoCard
              model={activeTab === 'cash_flow' ? cashFlowData?.model : expenseData?.model}
              metrics={activeTab === 'cash_flow' ? cashFlowData?.metrics : expenseData?.metrics}
              candidateModels={
                activeTab === 'cash_flow'
                  ? cashFlowData?.candidate_models
                  : expenseData?.candidate_models
              }
              currencySymbol={currencySymbol}
            />

            {/* 4. Regulatory Disclaimer */}
            <ForecastDisclaimer compact={false} />
          </>
        )}
      </main>
    </div>
  );
};

export default FinancialForecastingPage;
