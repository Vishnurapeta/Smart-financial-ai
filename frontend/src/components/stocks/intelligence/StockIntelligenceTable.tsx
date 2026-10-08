import React from 'react';
import {
  StockPredictionIntelligenceItem,
} from '../../../types/stockPrediction.ts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Info,
  ExternalLink,
} from 'lucide-react';

interface Props {
  stocks: StockPredictionIntelligenceItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  onSelectStock: (symbol: string) => void;
  currencyPrefix?: string;
}

export const StockIntelligenceTable: React.FC<Props> = ({
  stocks,
  totalCount,
  currentPage,
  pageSize,
  totalPages,
  loading,
  onPageChange,
  onPageSizeChange,
  onSelectStock,
}) => {
  const getDirectionBadge = (dir: string, expectedRet: number) => {
    if (dir === 'Bullish' || expectedRet > 2.0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          Bullish
        </span>
      );
    }
    if (dir === 'Bearish' || expectedRet < -2.0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <TrendingDown className="w-3 h-3 text-rose-400" />
          Bearish
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-300 border border-gray-500/30">
        <Minus className="w-3 h-3 text-gray-400" />
        Neutral
      </span>
    );
  };

  const getReliabilityBadge = (level: string, score: number) => {
    if (level === 'HIGH') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
          title={`High mathematical reliability (Confidence score: ${(score * 100).toFixed(0)}%)`}
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          High ({(score * 100).toFixed(0)}%)
        </span>
      );
    }
    if (level === 'MODERATE') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
          title={`Moderate reliability (Confidence score: ${(score * 100).toFixed(0)}%)`}
        >
          <ShieldCheck className="w-3 h-3 text-amber-400" />
          Moderate ({(score * 100).toFixed(0)}%)
        </span>
      );
    }
    if (level === 'LOW') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-600/20 text-gray-400 border border-gray-600/30"
          title="Lower historical directional predictability"
        >
          <ShieldAlert className="w-3 h-3 text-gray-400" />
          Low ({(score * 100).toFixed(0)}%)
        </span>
      );
    }
    return (
      <span className="text-[11px] text-gray-400">
        N/A
      </span>
    );
  };

  const getModelBadge = (modelName: string) => {
    let colorClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    if (modelName.toLowerCase().includes('xgboost')) {
      colorClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    } else if (modelName.toLowerCase().includes('random')) {
      colorClass = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    } else if (modelName.toLowerCase().includes('lstm')) {
      colorClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    } else if (modelName.toLowerCase().includes('linear')) {
      colorClass = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }

    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
        {modelName}
      </span>
    );
  };

  const formatPrice = (val: number | null | undefined, market: string) => {
    if (val === null || val === undefined) return '—';
    const prefix = market.includes('US') || market.includes('NASDAQ') ? '$' : '₹';
    return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl mb-8">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-gray-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-850/50">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            AI Market Predictions &amp; Opportunity Screen
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Showing statistical model forecasts generated without lookahead bias across validated equities.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-gray-400">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700/80 bg-gray-900/60 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="py-3 px-3 text-center w-12">Rank</th>
              <th className="py-3 px-4">Stock &amp; Company</th>
              <th className="py-3 px-3">Sector</th>
              <th className="py-3 px-3 text-right">Current Price</th>
              <th className="py-3 px-3 text-right">Predicted Price</th>
              <th className="py-3 px-3 text-right">Expected Return</th>
              <th className="py-3 px-3 text-center">Direction</th>
              <th className="py-3 px-3">Best Model</th>
              <th className="py-3 px-3 text-right">Historical Acc.</th>
              <th className="py-3 px-3 text-center">Reliability</th>
              <th className="py-3 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40 text-sm">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={11} className="py-4 px-4">
                    <div className="h-5 bg-gray-700/40 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : stocks.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-gray-400">
                  <Info className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-300">No stocks match your filter criteria.</p>
                  <p className="text-xs text-gray-400 mt-1">Try resetting or broadening your search and return range filters.</p>
                </td>
              </tr>
            ) : (
              stocks.map((stock) => {
                const isPositive = stock.expected_return > 0;
                const isNegative = stock.expected_return < 0;

                return (
                  <tr
                    key={stock.symbol}
                    onClick={() => onSelectStock(stock.symbol)}
                    className="hover:bg-cyan-500/[0.04] transition-colors cursor-pointer group"
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-3 text-center font-bold text-gray-400 text-xs">
                      #{stock.rank}
                    </td>

                    {/* Stock Symbol & Company */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-700/50 border border-gray-600/40 flex items-center justify-center font-bold text-xs text-cyan-300 shrink-0">
                          {stock.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                            {stock.symbol}
                            <span className="text-[10px] px-1.5 py-0.2 text-gray-400 bg-gray-800 rounded font-normal">
                              {stock.market_cap_category}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 truncate max-w-[160px] sm:max-w-[200px]">
                            {stock.company_name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sector */}
                    <td className="py-3.5 px-3">
                      <div className="text-xs text-gray-200 font-medium">{stock.sector}</div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[130px]">{stock.industry}</div>
                    </td>

                    {/* Current Price */}
                    <td className="py-3.5 px-3 text-right font-semibold text-gray-200 text-sm">
                      {formatPrice(stock.current_price, stock.market)}
                    </td>

                    {/* Predicted Price */}
                    <td className="py-3.5 px-3 text-right font-bold text-cyan-300 text-sm">
                      {formatPrice(stock.predicted_price, stock.market)}
                    </td>

                    {/* Expected Return % */}
                    <td className="py-3.5 px-3 text-right font-bold">
                      <span
                        className={`inline-block text-sm px-2 py-0.5 rounded font-mono font-bold ${
                          isPositive
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : isNegative
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-gray-300 bg-gray-700/30'
                        }`}
                      >
                        {isPositive ? '+' : ''}{stock.expected_return.toFixed(2)}%
                      </span>
                    </td>

                    {/* Direction */}
                    <td className="py-3.5 px-3 text-center">
                      {getDirectionBadge(stock.direction, stock.expected_return)}
                    </td>

                    {/* Best Model */}
                    <td className="py-3.5 px-3">
                      {getModelBadge(stock.best_model)}
                    </td>

                    {/* Historical Directional Accuracy */}
                    <td className="py-3.5 px-3 text-right font-mono font-medium text-xs text-gray-200">
                      {stock.directional_accuracy ? `${stock.directional_accuracy.toFixed(1)}%` : '—'}
                    </td>

                    {/* Reliability */}
                    <td className="py-3.5 px-3 text-center">
                      {getReliabilityBadge(stock.reliability_level, stock.reliability_score)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStock(stock.symbol);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-gray-700/60 hover:bg-cyan-600 text-gray-200 hover:text-white rounded-lg border border-gray-600/50 transition-all flex items-center gap-1 mx-auto"
                      >
                        Analyze
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-gray-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-850/50">
        <div className="text-xs text-gray-400">
          Showing <span className="text-white font-semibold">{startRecord}</span> to{' '}
          <span className="text-white font-semibold">{endRecord}</span> of{' '}
          <span className="text-white font-semibold">{totalCount}</span> supported stocks
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 text-xs font-medium text-gray-300 bg-gray-900 border border-gray-700 rounded-lg">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="p-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
