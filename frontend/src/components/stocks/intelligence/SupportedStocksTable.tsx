import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SupportedStockCoverage, UnsupportedStockInfo } from '../../../types/stockPrediction.ts';

interface SupportedStocksTableProps {
  supportedStocks: SupportedStockCoverage[];
  unsupportedStocks: UnsupportedStockInfo[];
  loading: boolean;
  onSelectStock?: (symbol: string) => void;
}

export const SupportedStocksTable: React.FC<SupportedStocksTableProps> = ({
  supportedStocks,
  unsupportedStocks,
  loading,
  onSelectStock,
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'ready' | 'unregistered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Combined and filtered stocks
  const combinedList = useMemo(() => {
    const list: Array<{
      symbol: string;
      company_name: string;
      market: string;
      isSupported: boolean;
      model_status: string;
      model_type?: string;
      supported_horizons?: number[];
      target?: string;
      model_version?: string;
      last_trained?: string;
      directional_accuracy?: number | null;
      models_count?: number;
      message?: string;
    }> = [];

    supportedStocks.forEach((s) => {
      list.push({
        ...s,
        isSupported: true,
      });
    });

    unsupportedStocks.forEach((u) => {
      list.push({
        symbol: u.symbol,
        company_name: u.company_name,
        market: u.market,
        isSupported: false,
        model_status: u.model_status,
        message: u.message,
      });
    });

    return list.filter((item) => {
      // Tab filter
      if (filter === 'ready' && !item.isSupported) return false;
      if (filter === 'unregistered' && item.isSupported) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.symbol.toLowerCase().includes(q) ||
          item.company_name.toLowerCase().includes(q) ||
          item.market.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [supportedStocks, unsupportedStocks, filter, searchQuery]);

  const handleAction = (symbol: string) => {
    if (onSelectStock) {
      onSelectStock(symbol);
    }
    navigate(`/stocks?symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Supported Stocks & Model Coverage</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time status of trained ML forecasting models across equity universe
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <input
            type="text"
            placeholder="Filter stocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-36 sm:w-44"
          />

          {/* Filter Pills */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({supportedStocks.length + unsupportedStocks.length})
            </button>
            <button
              onClick={() => setFilter('ready')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                filter === 'ready'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ready ({supportedStocks.length})
            </button>
            <button
              onClick={() => setFilter('unregistered')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                filter === 'unregistered'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Not Registered ({unsupportedStocks.length})
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 font-mono">
            <tr>
              <th className="py-3 px-4">Symbol</th>
              <th className="py-3 px-4">Company Name</th>
              <th className="py-3 px-4">Market</th>
              <th className="py-3 px-4">Model Status</th>
              <th className="py-3 px-4">Model Architecture</th>
              <th className="py-3 px-4">Horizons</th>
              <th className="py-3 px-4">Target Variable</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">Direction Acc</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td colSpan={10} className="py-4 px-4">
                    <div className="h-5 bg-slate-800/60 rounded" />
                  </td>
                </tr>
              ))
            ) : combinedList.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500 font-mono">
                  No stocks match the filter &ldquo;{searchQuery}&rdquo;.
                </td>
              </tr>
            ) : (
              combinedList.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="hover:bg-slate-850/50 transition-colors group cursor-default"
                >
                  {/* Symbol */}
                  <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">{stock.symbol}</span>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="py-3.5 px-4 font-medium text-slate-200 truncate max-w-[160px]">
                    {stock.company_name}
                  </td>

                  {/* Market */}
                  <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                    {stock.market}
                  </td>

                  {/* Model Status */}
                  <td className="py-3.5 px-4">
                    {stock.isSupported ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        READY
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        NOT REGISTERED
                      </span>
                    )}
                  </td>

                  {/* Model Architecture */}
                  <td className="py-3.5 px-4 font-mono">
                    {stock.isSupported ? (
                      <span className="text-slate-200 font-semibold">{stock.model_type}</span>
                    ) : (
                      <span className="text-slate-500 italic">None</span>
                    )}
                  </td>

                  {/* Horizons */}
                  <td className="py-3.5 px-4 font-mono">
                    {stock.isSupported && stock.supported_horizons ? (
                      <div className="flex items-center gap-1">
                        {stock.supported_horizons.map((h) => (
                          <span
                            key={h}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-teal-300 border border-slate-700 font-bold"
                          >
                            {h}D
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">---</span>
                    )}
                  </td>

                  {/* Target Variable */}
                  <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                    {stock.isSupported ? stock.target : <span className="text-slate-500">---</span>}
                  </td>

                  {/* Model Version */}
                  <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                    {stock.isSupported ? stock.model_version : '---'}
                  </td>

                  {/* Direction Accuracy */}
                  <td className="py-3.5 px-4 font-mono font-bold">
                    {stock.isSupported && stock.directional_accuracy !== null && stock.directional_accuracy !== undefined ? (
                      <span className="text-emerald-400">{stock.directional_accuracy.toFixed(1)}%</span>
                    ) : (
                      <span className="text-slate-500 font-normal">N/A</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-right">
                    {stock.isSupported ? (
                      <button
                        onClick={() => handleAction(stock.symbol)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        <span>View Prediction</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic block">
                        Model not available
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupportedStocksTable;
