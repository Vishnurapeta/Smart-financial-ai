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
import { MonthlyFlowPoint } from '../../types/analytics.ts';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface IncomeExpenseChartProps {
  data: MonthlyFlowPoint[];
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
    const income = payload.find((p) => p.name === 'Income')?.value || 0;
    const expense = payload.find((p) => p.name === 'Expense')?.value || 0;
    const net = income - expense;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[170px]">
        <div className="font-semibold text-white border-b border-slate-800 pb-1.5">{label}</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-emerald-400">
            <span>Income:</span>
            <span className="font-bold font-mono">{format(income)}</span>
          </div>
          <div className="flex justify-between items-center text-rose-400">
            <span>Expense:</span>
            <span className="font-bold font-mono">{format(expense)}</span>
          </div>
          <div className="pt-1 border-t border-slate-800 flex justify-between items-center text-slate-300">
            <span>Net Flow:</span>
            <span
              className={`font-bold font-mono ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {net >= 0 ? '+' : ''}
              {format(net)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const IncomeExpenseChart: React.FC<IncomeExpenseChartProps> = ({ data }) => {
  const { symbol } = useCurrency();
  const hasData = data && data.some((point) => point.income > 0 || point.expense > 0);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Cash Flow: Income vs. Expenses
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Continuous monthly comparison of inflows and outflows across the last 6 months
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Last 6 Months</span>
        </div>
      </div>

      <div className="h-72 w-full relative">
        {!hasData && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-xl border border-dashed border-slate-800 text-center p-4">
            <BarChart2 className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-400">
              No historical income or expense data found for this period
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Add transactions to see your monthly financial cash flow trend
            </p>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
            <XAxis
              dataKey="label"
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
              dataKey="income"
              name="Income"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="expense"
              name="Expense"
              fill="#f43f5e"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
