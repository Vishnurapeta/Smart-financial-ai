import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Wallet, TrendingUp, AlertTriangle } from 'lucide-react';
import { CashFlowForecastResponse } from '../../types/forecasting.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface CashFlowForecastChartProps {
  cashFlowData: CashFlowForecastResponse | null;
  currencySymbol?: string;
  loading?: boolean;
}

export const CashFlowForecastChart: React.FC<CashFlowForecastChartProps> = ({
  cashFlowData,
  currencySymbol: propCurrencySymbol,
  loading = false,
}) => {
  const { symbol: userSymbol } = useCurrency();
  const currencySymbol = propCurrencySymbol || userSymbol;
  if (loading) {
    return (
      <div className="h-80 w-full bg-slate-900/60 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-400 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span>Synthesizing cash-flow trajectory...</span>
        </div>
      </div>
    );
  }

  const forecast = cashFlowData?.forecast || [];

  if (forecast.length === 0) {
    return (
      <div className="h-80 w-full bg-slate-900/60 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-500 text-sm">
        No cash-flow forecast data available.
      </div>
    );
  }

  const chartData = forecast.map((f) => ({
    period: f.period,
    expectedIncome: f.expected_income,
    expectedExpenses: f.expected_expenses,
    plannedContributions: f.planned_contributions,
    netCashFlow: f.projected_net_cash_flow,
    isDeficit: f.is_deficit,
  }));

  const hasDeficit = forecast.some((f) => f.is_deficit);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            Projected Cash Inflow vs. Outflow vs. Net Liquidity
          </h3>
          <p className="text-xs text-slate-400">
            Compares expected monthly revenues against predicted outflows and savings goal contributions.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" />
            <span className="text-slate-300">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-rose-400 rounded-sm" />
            <span className="text-slate-300">Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm" />
            <span className="text-slate-300">Goals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
            <span className="text-amber-400 font-medium">Net Flow</span>
          </div>
        </div>
      </div>

      {/* Recharts Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="period"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={{ stroke: '#334155' }}
            />

            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={{ stroke: '#334155' }}
              tickFormatter={(v) => `${currencySymbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />

            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />

            <Tooltip content={<CustomCashFlowTooltip currencySymbol={currencySymbol} />} />

            <Bar dataKey="expectedIncome" fill="#10b981" radius={[4, 4, 0, 0]} name="Expected Income" />
            <Bar dataKey="expectedExpenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expected Expenses" />
            <Bar dataKey="plannedContributions" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Planned Contributions" />

            <Line
              type="monotone"
              dataKey="netCashFlow"
              stroke="#fbbf24"
              strokeWidth={3}
              dot={{ r: 4, fill: '#fbbf24' }}
              activeDot={{ r: 6, fill: '#fef08a' }}
              name="Net Cash Flow"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Alert if Deficit */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-2 border-t border-slate-800/80 gap-2">
        <div className="flex items-center gap-1.5 text-slate-400">
          <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
          <span>Synthesis Model: {cashFlowData?.model?.name ?? 'Hybrid Cash-Flow Model'}</span>
        </div>

        {hasDeficit && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Deficit projected in one or more forward periods</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  currencySymbol: string;
}

const CustomCashFlowTooltip: React.FC<TooltipProps> = ({
  active,
  payload,
  label,
  currencySymbol,
}) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  const isDeficit = dataPoint.netCashFlow < 0;

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[210px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className="font-bold text-white font-mono">{label}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isDeficit
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {isDeficit ? 'Deficit' : 'Surplus'}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Expected Income:</span>
          <span className="font-bold text-emerald-400 font-mono">
            {currencySymbol}{dataPoint.expectedIncome.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Expected Expenses:</span>
          <span className="font-bold text-rose-400 font-mono">
            {currencySymbol}{dataPoint.expectedExpenses.toLocaleString()}
          </span>
        </div>

        {dataPoint.plannedContributions > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Goal Savings:</span>
            <span className="font-bold text-cyan-400 font-mono">
              {currencySymbol}{dataPoint.plannedContributions.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span className="text-white font-semibold">Net Cash Flow:</span>
          <span
            className={`font-mono font-bold ${
              isDeficit ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {isDeficit ? '-' : '+'}
            {currencySymbol}{Math.abs(dataPoint.netCashFlow).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
