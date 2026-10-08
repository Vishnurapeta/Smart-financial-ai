import React, { useState, useEffect, useMemo } from 'react';
import { Database, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { ModelMetadataCard } from '../../../types/stockPrediction.ts';
import { StockPredictionService } from '../../../services/stockPrediction.service.ts';

interface ModelRegistryTableProps {
  availableStocks: string[];
  onSelectModel: (modelId: string) => void;
}

export const ModelRegistryTable: React.FC<ModelRegistryTableProps> = ({
  availableStocks,
  onSelectModel,
}) => {
  const [allModels, setAllModels] = useState<ModelMetadataCard[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [horizonFilter, setHorizonFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [page, setPage] = useState<number>(0);
  const pageSize = 10;

  // Fetch all models
  useEffect(() => {
    let isCancelled = false;
    const loadRegistry = async () => {
      setLoading(true);
      try {
        const res = await StockPredictionService.listModels();
        if (!isCancelled) {
          setAllModels(res.models || []);
        }
      } catch {
        if (!isCancelled) setAllModels([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadRegistry();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Filtered models
  const filteredModels = useMemo(() => {
    return allModels.filter((m) => {
      const sym = m.symbol || m.ticker || '';
      if (symbolFilter !== 'ALL' && sym !== symbolFilter) return false;
      if (horizonFilter !== 'ALL' && m.horizon !== Number(horizonFilter)) return false;
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSym = sym ? sym.toLowerCase().includes(q) : false;
        const matchesName = m.model_name.toLowerCase().includes(q);
        const matchesId = m.model_id.toLowerCase().includes(q);
        const matchesTarget = m.target.toLowerCase().includes(q);
        if (!matchesSym && !matchesName && !matchesId && !matchesTarget) return false;
      }

      return true;
    });
  }, [allModels, symbolFilter, horizonFilter, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredModels.length / pageSize);
  const paginatedModels = filteredModels.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <span>Enterprise Model Registry & Metadata Catalog</span>
          </h2>
          <p className="text-xs text-slate-400">
            Audit-grade registry of all versioned estimators, preprocessing artifacts, and training lineages
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search box */}
          <input
            type="text"
            placeholder="Search registry..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-36 sm:w-44"
          />

          {/* Stock filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-sans text-[11px]">Stock:</span>
            <select
              value={symbolFilter}
              onChange={(e) => {
                setSymbolFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-emerald-400 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All</option>
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
              <option value="ALL" className="bg-slate-950 text-white">All</option>
              <option value="1" className="bg-slate-950 text-white">1D</option>
              <option value="5" className="bg-slate-950 text-white">5D</option>
              <option value="20" className="bg-slate-950 text-white">20D</option>
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
              className="bg-transparent text-purple-300 font-mono font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Statuses</option>
              <option value="PRODUCTION" className="bg-slate-950 text-white">PRODUCTION</option>
              <option value="CANDIDATE" className="bg-slate-950 text-white">CANDIDATE</option>
              <option value="EXPERIMENTAL" className="bg-slate-950 text-white">EXPERIMENTAL</option>
              <option value="RETIRED" className="bg-slate-950 text-white">RETIRED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Model Registry Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 font-mono">
            <tr>
              <th className="py-3 px-4">Model ID</th>
              <th className="py-3 px-4">Symbol</th>
              <th className="py-3 px-4">Algorithm</th>
              <th className="py-3 px-4">Target Variable</th>
              <th className="py-3 px-4">Horizon</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Dataset</th>
              <th className="py-3 px-4">Holdout Direction Acc</th>
              <th className="py-3 px-4 text-right">Action</th>
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
            ) : paginatedModels.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500 font-mono">
                  No registered models found matching filter criteria.
                </td>
              </tr>
            ) : (
              paginatedModels.map((m) => {
                const sym = m.symbol || m.ticker;
                const da = m.metrics?.validation?.directional_accuracy;

                return (
                  <tr key={m.model_id} className="hover:bg-slate-850/50 transition-colors">
                    {/* Model ID */}
                    <td className="py-3.5 px-4 font-bold text-slate-300 text-[11px]">
                      {m.model_id}
                    </td>

                    {/* Symbol */}
                    <td className="py-3.5 px-4 font-bold text-white text-sm font-mono">
                      <span className="text-emerald-400">{sym}</span>
                    </td>

                    {/* Algorithm */}
                    <td className="py-3.5 px-4 font-semibold text-slate-200 font-sans">
                      {m.model_name}
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] truncate max-w-[130px]" title={m.target}>
                      {m.target}
                    </td>

                    {/* Horizon */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-teal-300 border border-slate-700 font-bold">
                        {m.horizon}D
                      </span>
                    </td>

                    {/* Version */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      v{m.model_version}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          m.status === 'PRODUCTION'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>

                    {/* Dataset */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {m.dataset_version || 'v1.0.0'}
                    </td>

                    {/* Direction Acc */}
                    <td className="py-3.5 px-4 font-bold">
                      {da !== undefined && da !== null ? (
                        <span className="text-emerald-400">{Number(da).toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-500 font-normal">N/A</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectModel(m.model_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-400" />
                        <span>Inspect</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 font-mono">
        <div>
          Showing {filteredModels.length > 0 ? page * pageSize + 1 : 0} to{' '}
          {Math.min((page + 1) * pageSize, filteredModels.length)} of {filteredModels.length} registered models
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

export default ModelRegistryTable;
