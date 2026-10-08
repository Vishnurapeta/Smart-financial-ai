import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

interface AllocationItem {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
}

interface PortfolioAllocationChartProps {
  allocations: AllocationItem[];
  currencySymbol?: string;
}

const PALETTE = [
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#d946ef', // fuchsia-500
  '#84cc16', // lime-500
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: AllocationItem;
  }>;
}

export const PortfolioAllocationChart: React.FC<PortfolioAllocationChartProps> = ({
  allocations,
  currencySymbol = '$',
}) => {
  if (!allocations || allocations.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-[340px]">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
          <PieChartIcon className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300">No Holdings Yet</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Add positions to your portfolio to view real-time asset weight distribution.
        </p>
      </div>
    );
  }

  const customTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as AllocationItem;
      return (
        <div className="bg-slate-950/95 border border-slate-700 p-3 rounded-xl shadow-xl text-xs backdrop-blur-md">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span className="text-emerald-400">{item.symbol}</span>
            <span className="text-slate-400 font-normal truncate max-w-[120px]">{item.name}</span>
          </p>
          <p className="text-slate-300 mt-1">
            Value:{' '}
            <span className="font-semibold text-white">
              {currencySymbol}
              {item.value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
          <p className="text-emerald-400 font-semibold mt-0.5">
            Weight: {item.percentage.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col h-[340px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <PieChartIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Asset Allocation</h4>
            <p className="text-[11px] text-slate-400">Weight by current market valuation</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-800 rounded-md">
          {allocations.length} asset{allocations.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={allocations}
              dataKey="value"
              nameKey="symbol"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
            >
              {allocations.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PALETTE[index % PALETTE.length]}
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={customTooltip} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-xs text-slate-300 font-medium">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
