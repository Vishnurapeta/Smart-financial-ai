import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DailySpendingPoint } from '../../types/analytics.ts';
import { Activity, Calendar } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface DailySpendingChartProps {
  data: DailySpendingPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: DailySpendingPoint;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  const { format } = useCurrency();

  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[150px]">
        <div className="font-semibold text-white border-b border-slate-800 pb-1">{label}</div>
        <div className="flex justify-between items-center text-slate-300">
          <span>Spent:</span>
          <span className="font-bold text-rose-400 font-mono">
            {format(item.amount)}
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Transactions:</span>
          <span className="font-mono text-slate-300">{item.count}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const DailySpendingChart: React.FC<DailySpendingChartProps> = ({ data }) => {
  const { symbol } = useCurrency();
  const hasData = data && data.length > 0 && data.some((d) => d.amount > 0);

  // Format short date label: "Sep 25"
  const formattedData = data.map((d) => {
    try {
      const parts = d.date.split('-');
      if (parts.length === 3) {
        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return {
          ...d,
          displayDate: `${monthNames[monthIdx] || ''} ${day}`,
        };
      }
    } catch {
      // fallback
    }
    return { ...d, displayDate: d.date };
  });

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Daily Spending Trend</h2>
          </div>
          <p className="text-xs text-slate-400">
            Outflow velocity and transaction frequency over the past 30 days
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60">
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          <span>Last 30 Days</span>
        </div>
      </div>

      <div className="h-64 w-full relative">
        {!hasData && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-xl border border-dashed border-slate-800 text-center p-4">
            <Activity className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-400">
              No daily expenses recorded in the last 30 days
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Any expense transactions made within 30 days will show up here
            </p>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="spendingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
            <XAxis
              dataKey="displayDate"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${symbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="amount"
              name="Daily Expense"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#spendingGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
