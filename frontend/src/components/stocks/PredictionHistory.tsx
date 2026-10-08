import React, { useState } from 'react';
import { History, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { StockPredictionRecord } from '../../types/stockPrediction.ts';

interface PredictionHistoryProps {
  symbol: string;
  items: StockPredictionRecord[];
  totalCount: number;
  loading?: boolean;
  onPageChange?: (offset: number) => void;
  currencySymbol?: string;
}

export const PredictionHistory: React.FC<PredictionHistoryProps> = ({
  symbol,
  items,
  totalCount,
  loading = false,
  onPageChange: _onPageChange,
  currencySymbol = '$',
}) => {
  const [activeFilterHorizon, setActiveFilterHorizon] = useState<number | null>(null);

  const filteredItems = activeFilterHorizon
    ? items.filter((it) => it.horizon === activeFilterHorizon)
    : items;

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            Prediction Audit Trail &amp; History ({symbol})
            {totalCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                {totalCount} total
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400">
            Immutable log of all model inference requests persisted in server audit store
          </p>
        </div>

        {/* Filter by Horizon */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[11px]">Filter:</span>
          <button
            onClick={() => setActiveFilterHorizon(null)}
            className={`px-2 py-0.5 rounded-lg font-mono text-[11px] transition cursor-pointer ${
              activeFilterHorizon === null
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All ({items.length})
          </button>
          {[1, 5, 20].map((h) => (
            <button
              key={h}
              onClick={() => setActiveFilterHorizon(h)}
              className={`px-2 py-0.5 rounded-lg font-mono text-[11px] transition cursor-pointer ${
                activeFilterHorizon === h
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              h={h}d
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading audit history...</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No prediction audit logs recorded yet for {symbol}. Generate a prediction above to record an audit entry.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Prediction Time</th>
                <th className="py-2.5 px-2">Horizon</th>
                <th className="py-2.5 px-2">Model</th>
                <th className="py-2.5 px-3 text-right">Price at Pred</th>
                <th className="py-2.5 px-3 text-right">Forecast Return</th>
                <th className="py-2.5 px-3 text-right">Forecast Price</th>
                <th className="py-2.5 px-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredItems.map((rec) => {
                const isPos = (rec.predicted_return ?? 0) >= 0;

                return (
                  <tr key={rec.prediction_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatDateTime(rec.prediction_timestamp)}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-2 text-slate-400 font-sans">
                      {rec.horizon}d ({rec.target === 'target_next_return' ? 'Return' : 'Price'})
                    </td>

                    <td className="py-2.5 px-2">
                      <span className="font-bold text-white text-xs">{rec.model_name}</span>
                      <span className="text-[10px] text-slate-500 ml-1">v{rec.model_version}</span>
                    </td>

                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {currencySymbol}
                      {rec.current_price?.toFixed(2) ?? '---'}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          isPos ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isPos ? '+' : ''}
                        {(((rec.predicted_return ?? 0)) * 100).toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right text-emerald-300 font-bold">
                      {currencySymbol}
                      {rec.predicted_value?.toFixed(2) ?? '---'}
                    </td>

                    <td className="py-2.5 px-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          rec.model_status === 'PRODUCTION'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-teal-500/15 text-teal-300'
                        }`}
                      >
                        {rec.model_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PredictionHistory;
