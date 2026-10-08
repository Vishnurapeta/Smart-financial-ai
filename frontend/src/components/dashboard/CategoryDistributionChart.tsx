import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { CategorySpendingItem } from '../../types/analytics.ts';
import { PieChart as PieIcon, AlertCircle } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface CategoryDistributionChartProps {
  categories: CategorySpendingItem[];
  totalExpenses: number;
}

const DEFAULT_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#f97316', // orange
  '#64748b', // slate
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: CategorySpendingItem;
  }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  const { format } = useCurrency();

  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1 min-w-[140px]">
        <div className="font-semibold text-white flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span>Amount:</span>
          <span className="font-bold text-white font-mono">
            {format(item.amount)}
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Share:</span>
          <span className="font-bold text-emerald-400 font-mono">{item.percentage}%</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Transactions:</span>
          <span className="font-mono">{item.transactionCount}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({
  categories,
  totalExpenses,
}) => {
  const hasData = categories && categories.length > 0 && totalExpenses > 0;

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <PieIcon className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">Category Distribution</h2>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Percentage allocation of overall expense outflow by category
      </p>

      <div className="h-60 w-full relative flex items-center justify-center">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 w-full h-full">
            <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-400">No expense categories to display</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Add categorized expenses to view your distribution breakdown
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Pie
                data={categories}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                stroke="#0f172a"
                strokeWidth={2}
              >
                {categories.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mini legend pills for top categories */}
      {hasData && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
          {categories.slice(0, 4).map((cat, idx) => (
            <div
              key={cat.categoryId || idx}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-[11px]"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: cat.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
                }}
              />
              <span className="text-slate-300 font-medium truncate max-w-[90px]">{cat.name}</span>
              <span className="text-slate-400 font-mono font-semibold">{cat.percentage}%</span>
            </div>
          ))}
          {categories.length > 4 && (
            <span className="text-[10px] text-slate-500 self-center">
              +{categories.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};
