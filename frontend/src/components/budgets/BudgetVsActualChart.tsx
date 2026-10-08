import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Budget } from '../../types/budget.ts';
import { BarChart3, AlertCircle } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface BudgetVsActualChartProps {
  budgets: Budget[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  const { format } = useCurrency();

  if (active && payload && payload.length) {
    const budgetVal = payload.find((p) => p.name === 'Budget Limit')?.value || 0;
    const spentVal = payload.find((p) => p.name === 'Actual Spent')?.value || 0;
    const variance = budgetVal - spentVal;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[170px]">
        <div className="font-semibold text-white border-b border-slate-800 pb-1">{label}</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-blue-400">
            <span>Budget Limit:</span>
            <span className="font-bold font-mono">
              {format(budgetVal)}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-200">
            <span>Actual Spent:</span>
            <span
              className={`font-bold font-mono ${
                spentVal > budgetVal ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {format(spentVal)}
            </span>
          </div>
          <div className="pt-1 border-t border-slate-800 flex justify-between items-center text-slate-300">
            <span>Variance:</span>
            <span
              className={`font-bold font-mono ${
                variance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {variance >= 0 ? '+' : ''}
              {format(variance)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const BudgetVsActualChart: React.FC<BudgetVsActualChartProps> = ({ budgets }) => {
  const { symbol } = useCurrency();
  const hasData = budgets && budgets.length > 0;

  const chartData = budgets.map((b) => ({
    name: b.name || b.category?.name || 'Category',
    budget: b.amount,
    spent: b.spent,
    isOverspent: b.isOverspent,
  }));

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Budget Limit vs. Actual Outflow
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Visual comparison of planned limits against transaction spending per category
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {budgets.length} {budgets.length === 1 ? 'Category' : 'Categories'}
        </span>
      </div>

      <div className="h-64 w-full relative">
        {!hasData ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-xl border border-dashed border-slate-800 text-center p-4">
            <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-400">
              No active category budgets for this month
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Create your first monthly category budget above to see performance comparisons
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${symbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
              />
              <Bar
                dataKey="budget"
                name="Budget Limit"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Bar
                dataKey="spent"
                name="Actual Spent"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
