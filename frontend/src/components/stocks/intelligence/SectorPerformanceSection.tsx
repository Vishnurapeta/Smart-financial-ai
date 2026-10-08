import React from 'react';
import { SectorPerformanceItem } from '../../../types/stockPrediction.ts';
import { PieChart, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  sectors: SectorPerformanceItem[];
  selectedSector: string;
  onSelectSector: (sector: string) => void;
  loading: boolean;
  horizon: number;
}

export const SectorPerformanceSection: React.FC<Props> = ({
  sectors,
  selectedSector,
  onSelectSector,
  loading,
  horizon,
}) => {
  if (loading && sectors.length === 0) {
    return (
      <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5 mb-8 animate-pulse">
        <div className="h-6 w-48 bg-gray-700/50 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-700/40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (sectors.length === 0) return null;

  return (
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-2xl p-5 mb-8 backdrop-blur-xl shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-cyan-400" />
            AI Predicted Sector Performance ({horizon} Day Horizon)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Aggregated mean returns across verified stock predictions. Click any sector to filter the table.
          </p>
        </div>

        {selectedSector && selectedSector !== 'All Sectors' && (
          <button
            onClick={() => onSelectSector('All Sectors')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-lg"
          >
            Clear Sector Filter: <span className="font-bold">{selectedSector}</span> ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {sectors.map((sec) => {
          const isSelected = selectedSector.toLowerCase() === sec.sector.toLowerCase();
          const isPositive = sec.avg_expected_return > 0;
          const isNegative = sec.avg_expected_return < 0;

          return (
            <div
              key={sec.sector}
              onClick={() => onSelectSector(isSelected ? 'All Sectors' : sec.sector)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-500/15 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400'
                  : 'border-gray-700/70 bg-gray-900/60 hover:border-gray-500 hover:bg-gray-850'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold text-gray-300 truncate max-w-[100px]">{sec.sector}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-gray-800 rounded font-mono text-gray-400">
                    {sec.stocks_count} stocks
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                    className={`text-lg font-bold font-mono ${
                      isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-gray-300'
                    }`}
                  >
                    {isPositive ? '+' : ''}{sec.avg_expected_return.toFixed(2)}%
                  </span>
                  {isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : isNegative ? (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : null}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-gray-700/50 flex items-center justify-between text-[11px] text-gray-400">
                <span className="truncate">
                  Top: <strong className="text-gray-200">{sec.top_stock_symbol}</strong>
                </span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {sec.top_stock_return > 0 ? '+' : ''}{sec.top_stock_return.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
