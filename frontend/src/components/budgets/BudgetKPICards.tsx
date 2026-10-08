import React from 'react';
import { Target, TrendingDown, PiggyBank, AlertTriangle, CheckCircle } from 'lucide-react';
import { MonthlyBudgetSummary } from '../../types/budget.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface BudgetKPICardsProps {
  summary: MonthlyBudgetSummary;
  currency?: string;
}

export const BudgetKPICards: React.FC<BudgetKPICardsProps> = ({ summary, currency: propCurrency }) => {
  const { currency: userCurrency, format } = useCurrency();
  const activeCurrency = propCurrency || userCurrency;

  const formatCurrency = (val: number) => {
    return format(val, { currency: activeCurrency });
  };

  const usagePercent = Math.min(100, Math.max(0, summary.overallPercentageUsed));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Budgeted */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Monthly Budget</span>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-white">
            {formatCurrency(summary.totalBudgeted)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="font-mono text-slate-300 font-semibold">
              {summary.totalBudgetsCount}
            </span>
            <span>categories budgeted</span>
          </div>
        </div>
      </div>

      {/* 2. Total Spent in Budgeted */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Actual Spent</span>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              summary.isOverallOverspent
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div
            className={`text-2xl font-bold tracking-tight ${
              summary.isOverallOverspent ? 'text-rose-400' : 'text-white'
            }`}
          >
            {formatCurrency(summary.totalSpentInBudgeted)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Overall Usage</span>
            <span
              className={`font-mono font-bold ${
                summary.isOverallOverspent
                  ? 'text-rose-400'
                  : summary.overallPercentageUsed >= 80
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {summary.overallPercentageUsed.toFixed(1)}%
            </span>
          </div>
          {/* Progress Bar */}
          <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                summary.isOverallOverspent
                  ? 'bg-rose-500'
                  : summary.overallPercentageUsed >= 80
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Remaining Budget */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Remaining Budget</span>
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div
            className={`text-2xl font-bold tracking-tight ${
              summary.totalRemaining > 0 ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {formatCurrency(summary.totalRemaining)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {summary.totalBudgeted > 0 ? (
              <span>
                {Math.max(0, 100 - summary.overallPercentageUsed).toFixed(1)}% available capital
              </span>
            ) : (
              <span>No budgets set</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Health & Overspending Status */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Budget Health Status</span>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              summary.overspentCount > 0
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : summary.warningCount > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            {summary.overspentCount > 0 ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xl font-bold ${
                summary.overspentCount > 0
                  ? 'text-rose-400'
                  : summary.warningCount > 0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {summary.overspentCount > 0
                ? `${summary.overspentCount} Overspent`
                : summary.warningCount > 0
                  ? `${summary.warningCount} Warning`
                  : 'All On Track'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {summary.onTrackCount} on track
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {summary.warningCount} warning
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
