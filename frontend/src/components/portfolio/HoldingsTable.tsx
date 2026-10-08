import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HoldingDto } from '../../types/portfolio.ts';
import {
  Edit2,
  Trash2,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
} from 'lucide-react';

interface HoldingsTableProps {
  holdings: HoldingDto[];
  currencySymbol?: string;
  onEditHolding: (holding: HoldingDto) => void;
  onDeleteHolding: (holding: HoldingDto) => void;
  onAddLot: (holding: HoldingDto) => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  currencySymbol = '$',
  onEditHolding,
  onDeleteHolding,
  onAddLot,
}) => {
  const navigate = useNavigate();

  if (!holdings || holdings.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-white">No Holdings Found</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
          Start by adding stocks, ETFs, or mutual funds to track your positions, live valuations,
          and marked-to-market performance.
        </p>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return `${currencySymbol}${val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg overflow-hidden backdrop-blur-sm">
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Holdings &amp; Positions</h3>
          <p className="text-xs text-slate-400">
            Real-time marked-to-market valuations and lot allocations
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg">
          {holdings.length} Position{holdings.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Symbol / Asset</th>
              <th className="py-3 px-3 text-right">Qty &amp; Lots</th>
              <th className="py-3 px-3 text-right">Avg Buy Price</th>
              <th className="py-3 px-3 text-right">Live Price</th>
              <th className="py-3 px-3 text-right">Invested</th>
              <th className="py-3 px-3 text-right">Market Value</th>
              <th className="py-3 px-3 text-right">Unrealized P&amp;L</th>
              <th className="py-3 px-3 text-right">Weight</th>
              <th className="py-3 px-4 text-center">AI Forecast</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {holdings.map((h) => {
              const isProfit = h.unrealizedPnL >= 0;
              const isDailyUp = h.dailyChange >= 0;

              return (
                <tr key={h.id} className="hover:bg-slate-800/40 transition-colors group">
                  {/* Symbol & Name */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs">
                        {h.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">{h.symbol}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                            {h.assetType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-[140px]">
                          <span>{h.name}</span>
                          {h.sector && <span className="text-slate-500">• {h.sector}</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Quantity & Lots */}
                  <td className="py-3.5 px-3 text-right">
                    <div className="font-semibold text-slate-200 text-sm">{h.quantity}</div>
                    {h.lotsCount > 1 ? (
                      <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 font-medium">
                        {h.lotsCount} lots
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">1 lot</span>
                    )}
                  </td>

                  {/* Average Buy Price */}
                  <td className="py-3.5 px-3 text-right font-medium text-slate-300">
                    {formatCurrency(h.averageBuyPrice)}
                  </td>

                  {/* Live Price & Daily Change */}
                  <td className="py-3.5 px-3 text-right">
                    <div className="font-semibold text-white">{formatCurrency(h.currentPrice)}</div>
                    {h.dailyChangePercent !== undefined && (
                      <div
                        className={`text-[11px] font-medium flex items-center justify-end gap-0.5 ${
                          isDailyUp ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isDailyUp ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        <span>
                          {isDailyUp ? '+' : ''}
                          {h.dailyChangePercent.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Invested Value */}
                  <td className="py-3.5 px-3 text-right font-medium text-slate-300">
                    {formatCurrency(h.investedValue)}
                  </td>

                  {/* Current Market Value */}
                  <td className="py-3.5 px-3 text-right font-bold text-white">
                    {formatCurrency(h.currentMarketValue)}
                  </td>

                  {/* Unrealized P&L */}
                  <td className="py-3.5 px-3 text-right">
                    <div
                      className={`font-bold text-sm ${
                        isProfit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isProfit ? '+' : ''}
                      {formatCurrency(h.unrealizedPnL)}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        isProfit ? 'text-emerald-400/90' : 'text-rose-400/90'
                      }`}
                    >
                      {isProfit ? '+' : ''}
                      {h.returnPercentage.toFixed(2)}%
                    </div>
                  </td>

                  {/* Weight / Allocation */}
                  <td className="py-3.5 px-3 text-right">
                    <div className="font-semibold text-slate-200">
                      {h.allocationPercentage.toFixed(1)}%
                    </div>
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full ml-auto mt-1 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, h.allocationPercentage))}%`,
                        }}
                      />
                    </div>
                  </td>

                  {/* Future Stock Prediction Forecast Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => navigate(`/stocks/${h.symbol}/prediction`)}
                      title={`Analyze AI Predictions for ${h.symbol}`}
                      className="inline-flex flex-col items-center p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300">
                        <Sparkles className="w-3 h-3" />
                        <span>AI Forecast</span>
                      </div>
                      <span className="text-[9px] text-slate-400">View Models</span>
                    </button>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => navigate(`/stocks/${h.symbol}/prediction`)}
                        title="Open AI Prediction Analysis"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onAddLot(h)}
                        title="Add buy lot (recalculates weighted average price)"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onEditHolding(h)}
                        title="Edit holding details"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteHolding(h)}
                        title="Remove holding from portfolio"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
