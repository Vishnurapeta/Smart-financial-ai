import React from 'react';
import { PieChart, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CategoryForecastItem } from '../../types/forecasting.ts';

interface CategoryForecastBreakdownProps {
  categoryForecasts: CategoryForecastItem[];
  currencySymbol?: string;
  totalPredictedExpense?: number;
}

export const CategoryForecastBreakdown: React.FC<CategoryForecastBreakdownProps> = ({
  categoryForecasts,
  currencySymbol = '$',
  totalPredictedExpense = 0,
}) => {
  if (!categoryForecasts || categoryForecasts.length === 0) {
    return null;
  }

  const eligibleItems = categoryForecasts.filter((c) => c.status === 'eligible');
  const sumEligible = eligibleItems.reduce((acc, c) => acc + c.predicted_expense, 0);
  const totalBase = totalPredictedExpense > 0 ? totalPredictedExpense : sumEligible;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-400" />
            Category-Level Outflow Forecasts
          </h3>
          <p className="text-xs text-slate-400">
            Individual category spending forecasts generated when at least 3 months of category activity exist.
          </p>
        </div>

        <span className="text-xs text-slate-400">
          {eligibleItems.length} of {categoryForecasts.length} categories eligible
        </span>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryForecasts.map((cat) => {
          const isEligible = cat.status === 'eligible';
          const share =
            isEligible && totalBase > 0
              ? Math.min(100, Math.round((cat.predicted_expense / totalBase) * 100))
              : 0;

          return (
            <div
              key={cat.category}
              className={`p-4 rounded-2xl border transition ${
                isEligible
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-900/40 border-slate-850 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm flex items-center gap-1.5 truncate">
                  <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{cat.category}</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isEligible
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isEligible ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Eligible ({cat.history_months}M)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      &lt;3M History
                    </>
                  )}
                </span>
              </div>

              {isEligible ? (
                <>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {currencySymbol}
                      {cat.predicted_expense.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{share}% share</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${share}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 mt-2">
                    Historical Monthly Avg: {currencySymbol}
                    {cat.historical_avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </>
              ) : (
                <div className="mt-2 text-xs text-slate-500 italic">
                  Forecast unavailable: category was active in only {cat.history_months}{' '}
                  {cat.history_months === 1 ? 'month' : 'months'}. 3 months required.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
