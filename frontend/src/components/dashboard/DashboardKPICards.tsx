import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Flame,
  Calendar,
  Percent,
} from 'lucide-react';
import { DashboardKPIMetrics } from '../../types/analytics.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface DashboardKPICardsProps {
  kpis: DashboardKPIMetrics;
}

export const DashboardKPICards: React.FC<DashboardKPICardsProps> = ({ kpis }) => {
  const { format: formatCurrency } = useCurrency();

  const formatPercent = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Primary KPI Row: Balance, Income, Expenses, Savings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Balance */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Net Balance</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold tracking-tight ${
                kpis.totalBalance >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrency(kpis.totalBalance)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                  kpis.monthOverMonth.savingsChangePercent >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {kpis.monthOverMonth.savingsChangePercent >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {formatPercent(kpis.monthOverMonth.savingsChangePercent)}
              </span>
              <span className="text-slate-500">vs prev month savings</span>
            </div>
          </div>
        </div>

        {/* Total Income */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Inflow / Income</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
              <ArrowDownRight className="w-4 h-4 text-emerald-400 rotate-180" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white">
              {formatCurrency(kpis.totalIncome)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                  kpis.monthOverMonth.incomeChangePercent >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {kpis.monthOverMonth.incomeChangePercent >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {formatPercent(kpis.monthOverMonth.incomeChangePercent)}
              </span>
              <span className="text-slate-500">vs prev month</span>
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Outflow / Expenses</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white">
              {formatCurrency(kpis.totalExpenses)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                  kpis.monthOverMonth.expenseChangePercent <= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {kpis.monthOverMonth.expenseChangePercent > 0 ? '+' : ''}
                {kpis.monthOverMonth.expenseChangePercent.toFixed(1)}%
              </span>
              <span className="text-slate-500">MoM spend change</span>
            </div>
          </div>
        </div>

        {/* Net Savings & Rate */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Savings & Rate</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">
                {formatCurrency(kpis.savings)}
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {kpis.savingsRate.toFixed(1)}% rate
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, kpis.savingsRate))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPI Strip: Monthly Burn Rate, YTD Spending, Savings Rate Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Monthly Burn Rate */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Monthly Burn Rate
            </span>
            <span className="text-[11px] font-mono text-slate-500">Current Month Outflow</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-xl font-bold text-white">
              {formatCurrency(kpis.monthlyBurnRate)}
            </div>
            <div className="text-[11px] text-slate-400">
              ~{formatCurrency(kpis.monthlyBurnRate / 30)} / day
            </div>
          </div>
        </div>

        {/* Year-to-Date (YTD) Spending */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Year-to-Date (YTD) Spending
            </span>
            <span className="text-[11px] font-mono text-slate-500">Jan 1 - Present</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-xl font-bold text-white">
              {formatCurrency(kpis.yearToDateSpending)}
            </div>
            <div className="text-[11px] text-slate-400">
              {kpis.totalExpenses > 0
                ? `${((kpis.yearToDateSpending / kpis.totalExpenses) * 100).toFixed(0)}% of all-time`
                : '0%'}
            </div>
          </div>
        </div>

        {/* Financial Retention Index */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              Net Retention Ratio
            </span>
            <span
              className={`text-[11px] font-semibold ${
                kpis.savingsRate >= 20
                  ? 'text-emerald-400'
                  : kpis.savingsRate >= 10
                    ? 'text-amber-400'
                    : 'text-slate-400'
              }`}
            >
              {kpis.savingsRate >= 20
                ? 'Strong Capital Accumulation'
                : kpis.savingsRate >= 10
                  ? 'Moderate Buffer'
                  : 'High Burn Caution'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-xl font-bold text-emerald-400">{kpis.savingsRate.toFixed(1)}%</div>
            <div className="text-[11px] text-slate-400">
              {kpis.totalIncome > 0
                ? `${formatCurrency(kpis.savings)} retained`
                : 'No income logged'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
