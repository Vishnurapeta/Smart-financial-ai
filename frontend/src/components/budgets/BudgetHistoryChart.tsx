import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { BudgetHistoryPoint } from '../../types/budget.ts';
import { History, Calendar } from 'lucide-react';

interface BudgetHistoryChartProps {
  history: BudgetHistoryPoint[];
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
  if (active && payload && payload.length) {
    const budgeted = payload.find((p) => p.name === 'Budget Plan')?.value || 0;
    const spent = payload.find((p) => p.name === 'Actual Outflow')?.value || 0;
    const variance = budgeted - spent;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[160px]">
        <div className="font-semibold text-white border-b border-slate-800 pb-1">{label}</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-blue-400">
            <span>Budget Plan:</span>
            <span className="font-bold font-mono">
              ${budgeted.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex justify-between items-center text-emerald-400">
            <span>Actual Outflow:</span>
            <span className="font-bold font-mono">
              ${spent.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className="pt-1 border-t border-slate-800 flex justify-between items-center text-slate-300">
            <span>Net Saved:</span>
            <span
              className={`font-bold font-mono ${
                variance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {variance >= 0 ? '+' : ''}$
              {variance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const BudgetHistoryChart: React.FC<BudgetHistoryChartProps> = ({ history }) => {
  const hasData = history && history.some((h) => h.budgeted > 0 || h.spent > 0);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <History className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Historical Budget Performance
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            6-month trajectory of aggregate budget targets versus real spending execution
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60">
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          <span>Last 6 Months</span>
        </div>
      </div>

      <div className="h-64 w-full relative">
        {!hasData && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-xl border border-dashed border-slate-800 text-center p-4">
            <History className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-400">
              No historical budget trends recorded yet
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Historical budget versus actual variance will automatically map here
            </p>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="budgetPlanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="budgetSpentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
            />
            <Area
              type="monotone"
              dataKey="budgeted"
              name="Budget Plan"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#budgetPlanGrad)"
            />
            <Area
              type="monotone"
              dataKey="spent"
              name="Actual Outflow"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#budgetSpentGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
