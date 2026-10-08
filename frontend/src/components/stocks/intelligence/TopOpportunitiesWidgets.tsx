import React, { useState } from 'react';
import { StockPredictionIntelligenceItem } from '../../../types/stockPrediction.ts';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';

interface Props {
  allStocks: StockPredictionIntelligenceItem[];
  onSelectStock: (symbol: string) => void;
  horizon: number;
}

export const TopOpportunitiesWidgets: React.FC<Props> = ({
  allStocks,
  onSelectStock,
  horizon,
}) => {
  const [topCount, setTopCount] = useState<number>(5);

  // Compute gainers & decliners dynamically from universe predictions
  const sortedGainers = allStocks
    .filter(
      (stk) =>
        typeof stk.expected_return === 'number' &&
        Number.isFinite(stk.expected_return) &&
        stk.expected_return > 0
    )
    .sort((a, b) => b.expected_return - a.expected_return)
    .slice(0, topCount);

  const sortedDecliners = allStocks
    .filter(
      (stk) =>
        typeof stk.expected_return === 'number' &&
        Number.isFinite(stk.expected_return) &&
        stk.expected_return < 0
    )
    .sort((a, b) => a.expected_return - b.expected_return)
    .slice(0, topCount);

  if (allStocks.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Top Gainers Card */}
      <div className="bg-gray-800/80 border border-gray-700/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  Top AI-Ranked Opportunities
                </h3>
                <p className="text-xs text-gray-400">
                  Highest forecasted upside for {horizon} Day horizon
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg p-0.5 text-xs">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setTopCount(n)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    topCount === n
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-700/40 mt-3">
            {sortedGainers.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No stocks with forecasted upside for this horizon.
              </div>
            ) : (
              sortedGainers.map((stk, idx) => (
                <div
                  key={stk.symbol}
                  onClick={() => onSelectStock(stk.symbol)}
                  className="py-2.5 flex items-center justify-between hover:bg-emerald-500/[0.04] px-2 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-500 w-5 text-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                        {stk.symbol}
                        <span className="text-[10px] text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded font-normal">
                          {stk.sector}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-[170px]">
                        {stk.company_name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-emerald-400 flex items-center justify-end gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                      +{stk.expected_return.toFixed(2)}%
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Target: <span className="font-mono text-gray-200">₹{stk.predicted_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Potential Decliners Card */}
      <div className="bg-gray-800/80 border border-gray-700/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  Potential Decliners
                </h3>
                <p className="text-xs text-gray-400">
                  Model-predicted downside for {horizon} Day horizon
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg p-0.5 text-xs">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setTopCount(n)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    topCount === n
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-700/40 mt-3">
            {sortedDecliners.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No stocks with forecasted downside for this horizon.
              </div>
            ) : (
              sortedDecliners.map((stk, idx) => (
                <div
                  key={stk.symbol}
                  onClick={() => onSelectStock(stk.symbol)}
                  className="py-2.5 flex items-center justify-between hover:bg-rose-500/[0.04] px-2 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-500 w-5 text-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-white text-sm group-hover:text-rose-400 transition-colors flex items-center gap-1.5">
                        {stk.symbol}
                        <span className="text-[10px] text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded font-normal">
                          {stk.sector}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-[170px]">
                        {stk.company_name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-rose-400 flex items-center justify-end gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                      {stk.expected_return.toFixed(2)}%
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Target: <span className="font-mono text-gray-200">₹{stk.predicted_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center gap-1.5 text-[11px] text-gray-400">
          <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>Downside reflects statistical expected return and does not imply guaranteed loss.</span>
        </div>
      </div>
    </div>
  );
};
