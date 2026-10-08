import React from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { CashFlowForecastResponse, ExpenseForecastResponse } from '../../types/forecasting.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface ForecastSummaryCardsProps {
  cashFlowData: CashFlowForecastResponse | null;
  expenseData: ExpenseForecastResponse | null;
  currencySymbol?: string;
}

export const ForecastSummaryCards: React.FC<ForecastSummaryCardsProps> = ({
  cashFlowData,
  expenseData,
  currencySymbol: propCurrencySymbol,
}) => {
  const { symbol: userSymbol } = useCurrency();
  const currencySymbol = propCurrencySymbol || userSymbol;
  const firstCf = cashFlowData?.forecast?.[0];
  const firstExp = expenseData?.forecast?.[0];

  const expectedIncome = firstCf ? firstCf.expected_income : 0;
  const expectedExpense = firstCf
    ? firstCf.expected_expenses
    : firstExp
      ? firstExp.predicted_expense
      : 0;
  const plannedContributions = firstCf ? firstCf.planned_contributions : 0;
  const netCashFlow = firstCf
    ? firstCf.projected_net_cash_flow
    : expectedIncome - expectedExpense - plannedContributions;

  const isDeficit = netCashFlow < 0;
  const nextPeriodLabel = firstCf?.period || firstExp?.period || 'Next Month';

  // Savings / buffer rate: net flow / income
  const savingsRate =
    expectedIncome > 0 ? Math.max(0, Math.round((netCashFlow / expectedIncome) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Expected Income */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition" />
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Expected Inflow ({nextPeriodLabel})</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
          {currencySymbol}
          {expectedIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span>Historical baseline &amp; recurring income</span>
        </p>
      </div>

      {/* 2. Expected Expenses */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition" />
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Expected Outflow ({nextPeriodLabel})</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
          {currencySymbol}
          {expectedExpense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-1 border-t border-slate-800/60">
          <span>Fixed: {currencySymbol}{firstExp?.fixed_recurring_expenses?.toLocaleString() ?? 0}</span>
          <span>Variable: {currencySymbol}{firstExp?.variable_expenses?.toLocaleString() ?? 0}</span>
        </div>
      </div>

      {/* 3. Planned Contributions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition" />
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Planned Goal Contributions</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
          {currencySymbol}
          {plannedContributions.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <Wallet className="w-3 h-3 text-cyan-400" />
          <span>Active in-progress savings goals</span>
        </p>
      </div>

      {/* 4. Projected Net Cash Flow */}
      <div
        className={`bg-slate-900/80 border rounded-3xl p-5 shadow-xl relative overflow-hidden group transition ${
          isDeficit
            ? 'border-amber-500/30 hover:border-amber-500/60'
            : 'border-emerald-500/30 hover:border-emerald-500/60'
        }`}
      >
        <div
          className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition ${
            isDeficit ? 'bg-amber-500/10' : 'bg-emerald-500/10'
          }`}
        />
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Projected Net Cash Flow</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isDeficit
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isDeficit ? (
              <>
                <AlertTriangle className="w-3 h-3" />
                Deficit Risk
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Surplus +{savingsRate}%
              </>
            )}
          </span>
        </div>
        <div
          className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
            isDeficit ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          {isDeficit ? '-' : '+'}
          {currencySymbol}
          {Math.abs(netCashFlow).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          {isDeficit
            ? 'Projected outflow exceeds incoming liquidity'
            : 'Projected net surplus available for liquidity buffer'}
        </p>
      </div>
    </div>
  );
};
