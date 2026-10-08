import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  ArrowUpDown,
  Star,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import { MarketForecastItem } from '../../../types/stockPrediction.ts';
import { HoldingDto } from '../../../types/portfolio.ts';

interface AIMarketForecastsTableProps {
  forecasts: MarketForecastItem[];
  selectedHorizon: number;
  loading: boolean;
  selectedSymbol: string;
  onSelectStock: (symbol: string) => void;
  watchlistSymbols: Set<string>;
  onToggleWatchlist: (symbol: string) => void;
  portfolioHoldingsMap: Record<string, HoldingDto>;
}

export const AIMarketForecastsTable: React.FC<AIMarketForecastsTableProps> = ({
  forecasts,
  selectedHorizon,
  loading,
  selectedSymbol,
  onSelectStock,
  watchlistSymbols,
  onToggleWatchlist,
  portfolioHoldingsMap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'Bullish' | 'Bearish' | 'Neutral'>('ALL');
  const [modelFilter, setModelFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'return_desc' | 'return_asc' | 'accuracy_desc' | 'price_desc' | 'symbol_asc'
  >('return_desc');

  // Available models in dataset for filter
  const availableModels = useMemo(() => {
    const set = new Set<string>();
    forecasts.forEach((f) => {
      if (f.model_name && f.model_name !== 'N/A') set.add(f.model_name);
    });
    return Array.from(set);
  }, [forecasts]);

  // Filtered & Sorted list
  const processedForecasts = useMemo(() => {
    return forecasts
      .filter((f) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSym = f.symbol.toLowerCase().includes(q);
          const matchName = f.company_name.toLowerCase().includes(q);
          if (!matchSym && !matchName) return false;
        }

        // Direction
        if (directionFilter !== 'ALL' && f.direction !== directionFilter) return false;

        // Model
        if (modelFilter !== 'ALL' && f.model_name !== modelFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'return_desc') {
          return (b.predicted_return ?? -999) - (a.predicted_return ?? -999);
        }
        if (sortBy === 'return_asc') {
          return (a.predicted_return ?? 999) - (b.predicted_return ?? 999);
        }
        if (sortBy === 'accuracy_desc') {
          return (b.historical_accuracy ?? 0) - (a.historical_accuracy ?? 0);
        }
        if (sortBy === 'price_desc') {
          return (b.current_price ?? 0) - (a.current_price ?? 0);
        }
        if (sortBy === 'symbol_asc') {
          return a.symbol.localeCompare(b.symbol);
        }
        return 0;
      });
  }, [forecasts, searchQuery, directionFilter, modelFilter, sortBy]);

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">AI Market Forecasts</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/20">
              {selectedHorizon}D Horizon
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real machine-learning forecasts and holdout directional accuracy across supported stocks
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Search box */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              placeholder="Search stock or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-medium text-[11px]">Direction:</span>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All</option>
              <option value="Bullish" className="bg-slate-950 text-emerald-400">Bullish</option>
              <option value="Bearish" className="bg-slate-950 text-rose-400">Bearish</option>
              <option value="Neutral" className="bg-slate-950 text-slate-300">Neutral</option>
            </select>
          </div>

          {/* Model Filter */}
          {availableModels.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-500 font-medium text-[11px]">Model:</span>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-950 text-white">All Models</option>
                {availableModels.map((m) => (
                  <option key={m} value={m} className="bg-slate-950 text-white">{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort By */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
            >
              <option value="return_desc" className="bg-slate-950 text-white">Highest Expected Return</option>
              <option value="return_asc" className="bg-slate-950 text-white">Lowest Expected Return</option>
              <option value="accuracy_desc" className="bg-slate-950 text-white">Highest Direction Accuracy</option>
              <option value="price_desc" className="bg-slate-950 text-white">Current Price</option>
              <option value="symbol_asc" className="bg-slate-950 text-white">Symbol (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-500 bg-slate-950/40">
              <th className="py-3 px-3">Watch</th>
              <th className="py-3 px-4">Stock</th>
              <th className="py-3 px-4 text-right">Current Price</th>
              <th className="py-3 px-4 text-center">Forecast Horizon</th>
              <th className="py-3 px-4 text-right">Predicted Price</th>
              <th className="py-3 px-4 text-right">Expected Return</th>
              <th className="py-3 px-4 text-center">Direction</th>
              <th className="py-3 px-4">Model</th>
              <th className="py-3 px-4 text-right">Historical Accuracy</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td colSpan={10} className="py-4 px-4">
                    <div className="h-6 bg-slate-800/60 rounded" />
                  </td>
                </tr>
              ))
            ) : processedForecasts.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-500 font-mono">
                  No stock forecasts found matching criteria.
                </td>
              </tr>
            ) : (
              processedForecasts.map((f) => {
                const isSelected = selectedSymbol === f.symbol;
                const inWatchlist = watchlistSymbols.has(f.symbol);
                const holding = portfolioHoldingsMap[f.symbol];
                const isReady = f.status === 'READY';
                const isBullish = f.direction === 'Bullish';
                const isBearish = f.direction === 'Bearish';
                const isPosReturn = (f.predicted_return ?? 0) >= 0;

                return (
                  <tr
                    key={f.symbol}
                    onClick={() => onSelectStock(f.symbol)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-2 border-emerald-400'
                        : 'hover:bg-slate-850/50'
                    }`}
                  >
                    {/* Watchlist toggle */}
                    <td
                      className="py-3.5 px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(f.symbol);
                      }}
                    >
                      <button
                        title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        className={`p-1.5 rounded-lg transition ${
                          inWatchlist
                            ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
                            : 'text-slate-600 hover:text-amber-400 hover:bg-slate-800'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-amber-400' : ''}`} />
                      </button>
                    </td>

                    {/* Stock Column */}
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 font-mono font-bold flex items-center justify-center text-xs text-white">
                          {f.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white font-mono text-sm">{f.symbol}</span>
                            {holding && (
                              <span
                                title={`Portfolio holding: ${holding.quantity} shares`}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30"
                              >
                                <Briefcase className="w-2.5 h-2.5" />
                                <span>Holding</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block truncate max-w-[140px]">
                            {f.company_name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Current Price */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                      {f.current_price !== null && f.current_price !== undefined
                        ? `₹${f.current_price.toFixed(2)}`
                        : '---'}
                    </td>

                    {/* Forecast Horizon */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] text-teal-300 font-bold border border-slate-700/60">
                        {f.horizon} Days
                      </span>
                    </td>

                    {/* Predicted Price */}
                    <td className="py-3.5 px-4 text-right font-bold">
                      {f.predicted_price !== null && f.predicted_price !== undefined ? (
                        <span className={isPosReturn ? 'text-emerald-400' : 'text-rose-400'}>
                          ₹{f.predicted_price.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">N/A</span>
                      )}
                    </td>

                    {/* Expected Return */}
                    <td className="py-3.5 px-4 text-right font-bold">
                      {f.predicted_return !== null && f.predicted_return !== undefined ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
                            isPosReturn
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isPosReturn ? '+' : ''}
                          {(f.predicted_return * 100).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">N/A</span>
                      )}
                    </td>

                    {/* Direction */}
                    <td className="py-3.5 px-4 text-center">
                      {isReady ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isBullish
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isBearish
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isBullish ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : isBearish ? (
                            <TrendingDown className="w-3 h-3 text-rose-400" />
                          ) : (
                            <Minus className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{f.direction}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Unavailable</span>
                      )}
                    </td>

                    {/* Model Architecture */}
                    <td className="py-3.5 px-4 font-sans text-slate-300">
                      <span className="font-semibold text-xs block">{f.model_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">v{f.model_version}</span>
                    </td>

                    {/* Historical Accuracy */}
                    <td className="py-3.5 px-4 text-right">
                      {f.historical_accuracy !== null && f.historical_accuracy !== undefined ? (
                        <span className="font-bold text-emerald-400">
                          {f.historical_accuracy.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-500 font-normal">N/A</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStock(f.symbol);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                        }`}
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AIMarketForecastsTable;
