import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Layers } from 'lucide-react';
import { SectorAllocation } from '../../types/portfolio.ts';

interface SectorAllocationChartProps {
  sectorAllocations: SectorAllocation[];
  currencySymbol?: string;
}

const SECTOR_COLORS = [
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#e11d48', // rose-600
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: SectorAllocation;
  }>;
}

export const SectorAllocationChart: React.FC<SectorAllocationChartProps> = ({
  sectorAllocations,
  currencySymbol = '$',
}) => {
  if (!sectorAllocations || sectorAllocations.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-[340px]">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300">No Sector Data</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Positions with assigned sectors will automatically populate industry diversification.
        </p>
      </div>
    );
  }

  const customTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as SectorAllocation;
      return (
        <div className="bg-slate-950/95 border border-slate-700 p-3 rounded-xl shadow-xl text-xs backdrop-blur-md">
          <p className="font-bold text-cyan-400">{item.sector}</p>
          <p className="text-slate-300 mt-1">
            Exposure:{' '}
            <span className="font-semibold text-white">
              {currencySymbol}
              {item.value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
          <p className="text-emerald-400 font-semibold mt-0.5">
            Portfolio Share: {item.percentage.toFixed(2)}%
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
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Sector Diversification</h4>
            <p className="text-[11px] text-slate-400">
              Industry breakdown &amp; concentration risk
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-800 rounded-md">
          {sectorAllocations.length} sector{sectorAllocations.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sectorAllocations}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
          >
            <XAxis
              type="number"
              unit="%"
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={{ stroke: '#334155' }}
            />
            <YAxis
              type="category"
              dataKey="sector"
              tick={{ fill: '#cbd5e1', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              width={100}
            />
            <Tooltip content={customTooltip} />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
              {sectorAllocations.map((_, index) => (
                <Cell key={`sector-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
