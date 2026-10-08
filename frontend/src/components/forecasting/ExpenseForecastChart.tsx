import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Sparkles, Calendar, Layers } from 'lucide-react';
import { ExpenseForecastResponse } from '../../types/forecasting.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface ExpenseForecastChartProps {
  expenseData: ExpenseForecastResponse | null;
  currencySymbol?: string;
  loading?: boolean;
}

export const ExpenseForecastChart: React.FC<ExpenseForecastChartProps> = ({
  expenseData,
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
          <span>Computing chronological expense trajectory...</span>
        </div>
      </div>
    );
  }

  const historical = expenseData?.historical_series || [];
  const forecast = expenseData?.forecast || [];

  if (historical.length === 0 && forecast.length === 0) {
    return (
      <div className="h-80 w-full bg-slate-900/60 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-500 text-sm">
        No expense data available for charting.
      </div>
    );
  }

  // Combine historical and forecast into a unified chronological array for Recharts
  // Historical data has `historicalExpense`
  // Forecast data has `forecastExpense`, `lowerBound`, `upperBound`
  // At transition point (last historical), both meet to ensure continuous line visualization
  const lastHist = historical[historical.length - 1];

  const chartData: any[] = [];

  historical.forEach((h, idx) => {
    chartData.push({
      period: h.period,
      historicalExpense: h.total_expense,
      forecastExpense: idx === historical.length - 1 ? h.total_expense : null,
      isForecast: false,
    });
  });

  forecast.forEach((f) => {
    chartData.push({
      period: f.period,
      historicalExpense: null,
      forecastExpense: f.predicted_expense,
      fixedPart: f.fixed_recurring_expenses,
      variablePart: f.variable_expenses,
      lowerBound: f.lower_bound,
      upperBound: f.upper_bound,
      isForecast: true,
    });
  });

  const transitionPeriod = lastHist ? lastHist.period : '';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Historical Actuals vs. Forward Expense Forecast
          </h3>
          <p className="text-xs text-slate-400">
            Solid line shows actual past spending. Dashed line denotes model-projected trajectory with confidence bounds.
          </p>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-400 rounded-full" />
            <span className="text-slate-300">Historical Actuals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-teal-300" />
            <span className="text-teal-300 font-medium">Model Forecast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-teal-500/20 border border-teal-500/40 rounded-sm" />
            <span className="text-slate-400 text-[11px]">80% Interval</span>
          </div>
        </div>
      </div>

      {/* Recharts Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="boundGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
              </linearGradient>
            </defs>

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

            {/* Boundary reference line */}
            {transitionPeriod && (
              <ReferenceLine
                x={transitionPeriod}
                stroke="#0ea5e9"
                strokeDasharray="4 4"
                label={{
                  value: 'Forecast Begins →',
                  fill: '#38bdf8',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            )}

            <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />

            {/* Historical Area & Line */}
            <Area
              type="monotone"
              dataKey="historicalExpense"
              fill="url(#histGradient)"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10b981' }}
              activeDot={{ r: 5, fill: '#34d399' }}
              name="Historical Actual"
            />

            {/* Forecast dashed line */}
            <Line
              type="monotone"
              dataKey="forecastExpense"
              stroke="#2dd4bf"
              strokeWidth={2.5}
              strokeDasharray="6 6"
              dot={{ r: 4, fill: '#2dd4bf' }}
              activeDot={{ r: 6, fill: '#5eead4' }}
              name="Projected Forecast"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/80">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Timeline: {historical[0]?.period ?? '---'} to {forecast[forecast.length - 1]?.period ?? '---'}</span>
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <Layers className="w-3.5 h-3.5 text-teal-400" />
          <span>Model: {expenseData?.model?.name ?? 'Moving Average'}</span>
        </span>
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

const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label, currencySymbol }) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  const isForecast = dataPoint?.isForecast;

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[200px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className="font-bold text-white font-mono">{label}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isForecast
              ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
              : 'bg-emerald-500/15 text-emerald-300'
          }`}
        >
          {isForecast ? 'Forecast Estimate' : 'Historical Actual'}
        </span>
      </div>

      {dataPoint.historicalExpense !== null && dataPoint.historicalExpense !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Actual Outflow:</span>
          <span className="font-bold text-emerald-400 font-mono">
            {currencySymbol}{dataPoint.historicalExpense.toLocaleString()}
          </span>
        </div>
      )}

      {isForecast && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Predicted Outflow:</span>
            <span className="font-bold text-teal-300 font-mono">
              {currencySymbol}{dataPoint.forecastExpense.toLocaleString()}
            </span>
          </div>

          {dataPoint.fixedPart !== undefined && (
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 space-y-1">
              <div className="flex justify-between">
                <span>Fixed Commitments:</span>
                <span className="text-slate-300 font-mono">{currencySymbol}{dataPoint.fixedPart.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Variable Discretionary:</span>
                <span className="text-slate-300 font-mono">{currencySymbol}{dataPoint.variablePart.toLocaleString()}</span>
              </div>
            </div>
          )}

          {dataPoint.lowerBound !== undefined && (
            <div className="text-[10px] text-slate-500 pt-1">
              <span>80% Range: {currencySymbol}{dataPoint.lowerBound.toLocaleString()} – {currencySymbol}{dataPoint.upperBound.toLocaleString()}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
