import React, { useState, useEffect } from 'react';
import { History, ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { StockPredictionRecord } from '../../../types/stockPrediction.ts';
import { StockPredictionService } from '../../../services/stockPrediction.service.ts';

interface PredictionHistoryTableProps {
  availableStocks: string[];
}

export const PredictionHistoryTable: React.FC<PredictionHistoryTableProps> = ({
  availableStocks,
}) => {
  const [records, setRecords] = useState<StockPredictionRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters state
  const [stockFilter, setStockFilter] = useState<string>('ALL');
  const [horizonFilter, setHorizonFilter] = useState<string>('ALL');
  const [modelFilter, setModelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pagination state
  const [page, setPage] = useState<number>(0);
  const pageSize = 10;

  // Load history from API
  useEffect(() => {
    let isCancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await StockPredictionService.getGlobalPredictionHistory({
          symbol: stockFilter !== 'ALL' ? stockFilter : undefined,
          horizon: horizonFilter !== 'ALL' ? Number(horizonFilter) : undefined,
          model: modelFilter !== 'ALL' ? modelFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          limit: pageSize,
          offset: page * pageSize,
        });

        if (!isCancelled) {
          setRecords(res.items || []);
          setTotalCount(res.total_count || 0);
        }
      } catch (err) {
        if (!isCancelled) {
          setRecords([]);
          setTotalCount(0);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isCancelled = true;
    };
  }, [stockFilter, horizonFilter, modelFilter, statusFilter, page]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatTimestamp = (iso?: string) => {
    if (!iso) return '---';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <span>Recent Prediction History & Real-Time Audit Log</span>
          </h2>
          <p className="text-xs text-slate-400">
            Immutable log of all model inferences with forward-looking holdout status and accuracy verification
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Stock filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-sans text-[11px]">Stock:</span>
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-emerald-400 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Stocks</option>
              {availableStocks.map((s) => (
                <option key={s} value={s} className="bg-slate-950 text-white">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Horizon filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-sans text-[11px]">Horizon:</span>
            <select
              value={horizonFilter}
              onChange={(e) => {
                setHorizonFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-teal-300 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Horizons</option>
              <option value="1" className="bg-slate-950 text-white">1 Day</option>
              <option value="5" className="bg-slate-950 text-white">5 Days</option>
              <option value="20" className="bg-slate-950 text-white">20 Days</option>
            </select>
          </div>

          {/* Model filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-sans text-[11px]">Model:</span>
            <select
              value={modelFilter}
              onChange={(e) => {
                setModelFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-purple-300 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Models</option>
              <option value="XGBoost" className="bg-slate-950 text-white">XGBoost</option>
              <option value="RandomForest" className="bg-slate-950 text-white">Random Forest</option>
              <option value="LinearRegression" className="bg-slate-950 text-white">Linear Regression</option>
              <option value="Naive" className="bg-slate-950 text-white">Naive Baseline</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-sans text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-amber-300 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Statuses</option>
              <option value="PENDING" className="bg-slate-950 text-white">Pending</option>
              <option value="COMPLETED" className="bg-slate-950 text-white">Evaluated</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 font-mono">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Symbol</th>
              <th className="py-3 px-4">Horizon</th>
              <th className="py-3 px-4">Target</th>
              <th className="py-3 px-4">Model Architecture</th>
              <th className="py-3 px-4">Forecast Target</th>
              <th className="py-3 px-4">Actual Price/Ret</th>
              <th className="py-3 px-4">Error</th>
              <th className="py-3 px-4">Direction</th>
              <th className="py-3 px-4 text-right">Model Version</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td colSpan={10} className="py-4 px-4">
                    <div className="h-5 bg-slate-800/60 rounded" />
                  </td>
                </tr>
              ))
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500 font-mono">
                  No prediction history matches the active criteria.
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const isReturnTarget = r.target.includes('return');
                const isPos = (r.predicted_return ?? 0) >= 0;
                const isPending = !r.actual_value && (!r.status || r.status === 'PENDING');

                return (
                  <tr key={r.id || r.prediction_id} className="hover:bg-slate-850/50 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {formatTimestamp(r.prediction_timestamp)}
                    </td>

                    {/* Symbol */}
                    <td className="py-3.5 px-4 font-bold text-white font-mono text-sm">
                      <span className="text-emerald-400">{r.symbol}</span>
                    </td>

                    {/* Horizon */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-teal-300 border border-slate-700 font-bold">
                        {r.horizon}D
                      </span>
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] font-sans">
                      {isReturnTarget ? 'Next Return' : 'Next Close'}
                    </td>

                    {/* Model */}
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {r.model_name}
                    </td>

                    {/* Forecast Target */}
                    <td className="py-3.5 px-4 font-bold">
                      {isReturnTarget && r.predicted_return !== undefined ? (
                        <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPos ? '+' : ''}{(r.predicted_return * 100).toFixed(2)}%
                        </span>
                      ) : r.predicted_value !== undefined ? (
                        <span className="text-emerald-300">${r.predicted_value.toFixed(2)}</span>
                      ) : (
                        '---'
                      )}
                    </td>

                    {/* Actual */}
                    <td className="py-3.5 px-4">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          PENDING
                        </span>
                      ) : (
                        <span className="text-white font-bold">
                          {r.actual_return !== null && r.actual_return !== undefined
                            ? `${(r.actual_return * 100).toFixed(2)}%`
                            : r.actual_value !== null && r.actual_value !== undefined
                              ? `$${r.actual_value.toFixed(2)}`
                              : '---'}
                        </span>
                      )}
                    </td>

                    {/* Error */}
                    <td className="py-3.5 px-4 text-slate-400">
                      {r.error !== null && r.error !== undefined ? r.error.toFixed(4) : '---'}
                    </td>

                    {/* Direction */}
                    <td className="py-3.5 px-4">
                      {isPending ? (
                        <span className="text-slate-500 text-[11px]">Holdout</span>
                      ) : r.direction === 'Correct' ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Correct
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Incorrect
                        </span>
                      )}
                    </td>

                    {/* Version */}
                    <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                      v{r.model_version}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 font-mono">
        <div>
          Showing {records.length > 0 ? page * pageSize + 1 : 0} to{' '}
          {Math.min((page + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()} total entries
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
          <span className="px-2 py-1 text-slate-500">
            Page {page + 1} of {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PredictionHistoryTable;
