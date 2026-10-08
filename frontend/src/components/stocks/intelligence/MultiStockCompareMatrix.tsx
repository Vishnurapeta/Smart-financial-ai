import React, { useState } from 'react';
import { CheckSquare, Square, TrendingUp, TrendingDown, Minus, Layers, Award } from 'lucide-react';
import { MarketForecastItem } from '../../../types/stockPrediction.ts';

interface MultiStockCompareMatrixProps {
  forecasts: MarketForecastItem[];
  selectedHorizon: number;
}

export const MultiStockCompareMatrix: React.FC<MultiStockCompareMatrixProps> = ({
  forecasts,
  selectedHorizon,
}) => {
  // Default: select up to 3 supported stocks with valid predictions
  const supportedTickers = forecasts.filter((f) => f.status === 'READY').map((f) => f.symbol);
  const [selectedTickers, setSelectedTickers] = useState<string[]>(() => {
    return supportedTickers.slice(0, 3);
  });

  const toggleTicker = (sym: string) => {
    setSelectedTickers((prev) => {
      if (prev.includes(sym)) {
        // Keep at least 1 selected
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== sym);
      } else {
        return [...prev, sym];
      }
    });
  };

  const comparedForecasts = forecasts.filter((f) => selectedTickers.includes(f.symbol));

  // Find best return among selected
  const highestReturnSymbol = comparedForecasts.reduce((best, cur) => {
    if (!best) return cur.symbol;
    const bestRet = forecasts.find((f) => f.symbol === best)?.predicted_return ?? -999;
    const curRet = cur.predicted_return ?? -999;
    return curRet > bestRet ? cur.symbol : best;
  }, '');

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Title & Selection Checkboxes */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Compare AI Forecasts</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare model-estimated returns and direction across equities side-by-side ({selectedHorizon}D Horizon)
          </p>
        </div>

        {/* Stock Selectors */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-500 font-medium">Select Stocks:</span>
          {forecasts.map((f) => {
            const isChecked = selectedTickers.includes(f.symbol);
            return (
              <button
                key={f.symbol}
                onClick={() => toggleTicker(f.symbol)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer ${
                  isChecked
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>{f.symbol}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-950/40">
              <th className="py-3 px-4">Stock Equity</th>
              <th className="py-3 px-4 text-center">Horizon</th>
              <th className="py-3 px-4 text-right">Current Price</th>
              <th className="py-3 px-4 text-right">Predicted Price</th>
              <th className="py-3 px-4 text-right">Expected Return</th>
              <th className="py-3 px-4 text-center">Direction</th>
              <th className="py-3 px-4">Model Architecture</th>
              <th className="py-3 px-4 text-right">Historical Accuracy</th>
              <th className="py-3 px-4 text-center">Highlight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {comparedForecasts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-500">
                  Select at least one stock above to compare forecasts.
                </td>
              </tr>
            ) : (
              comparedForecasts.map((f) => {
                const isPos = (f.predicted_return ?? 0) >= 0;
                const isHighest = f.symbol === highestReturnSymbol && (f.predicted_return ?? 0) > 0;
                const isBullish = f.direction === 'Bullish';
                const isBearish = f.direction === 'Bearish';

                return (
                  <tr key={f.symbol} className="hover:bg-slate-850/40 transition-colors">
                    {/* Stock */}
                    <td className="py-3.5 px-4 font-sans font-bold text-white text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400">{f.symbol}</span>
                        <span className="text-slate-400 text-xs font-normal">({f.company_name})</span>
                      </div>
                    </td>

                    {/* Horizon */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-teal-300 font-bold">
                        {f.horizon} Days
                      </span>
                    </td>

                    {/* Current Price */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                      {f.current_price !== null && f.current_price !== undefined
                        ? `₹${f.current_price.toFixed(2)}`
                        : '---'}
                    </td>

                    {/* Predicted Price */}
                    <td className="py-3.5 px-4 text-right font-bold text-white">
                      {f.predicted_price !== null && f.predicted_price !== undefined
                        ? `₹${f.predicted_price.toFixed(2)}`
                        : '---'}
                    </td>

                    {/* Expected Return */}
                    <td className="py-3.5 px-4 text-right font-bold">
                      {f.predicted_return !== null && f.predicted_return !== undefined ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                            isPos
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {(f.predicted_return * 100).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>

                    {/* Direction */}
                    <td className="py-3.5 px-4 text-center">
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
                    </td>

                    {/* Model */}
                    <td className="py-3.5 px-4 text-slate-300 font-sans">
                      <span className="font-semibold">{f.model_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-1">v{f.model_version}</span>
                    </td>

                    {/* Accuracy */}
                    <td className="py-3.5 px-4 text-right font-bold">
                      {f.historical_accuracy !== null && f.historical_accuracy !== undefined ? (
                        <span className="text-emerald-400">{f.historical_accuracy.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-500 font-normal">N/A</span>
                      )}
                    </td>

                    {/* Highlight */}
                    <td className="py-3.5 px-4 text-center font-sans">
                      {isHighest && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          <Award className="w-3 h-3 text-emerald-400" />
                          <span>Highest Forecast Return</span>
                        </span>
                      )}
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

export default MultiStockCompareMatrix;
