import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import {
  SupportedStockCoverage,
  UnsupportedStockInfo,
  StockPredictionResponse,
} from '../../../types/stockPrediction.ts';
import { StockService } from '../../../services/stock.service.ts';
import { StockPredictionService } from '../../../services/stockPrediction.service.ts';
import { MarketQuote } from '../../../types/stock.ts';

interface StockIntelligenceSearchProps {
  supportedStocks: SupportedStockCoverage[];
  unsupportedStocks: UnsupportedStockInfo[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const StockIntelligenceSearch: React.FC<StockIntelligenceSearchProps> = ({
  supportedStocks,
  unsupportedStocks,
  selectedSymbol,
  onSelectSymbol,
}) => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [prediction, setPrediction] = useState<StockPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const activeSupported = supportedStocks.find((s) => s.symbol === selectedSymbol);
  const activeUnsupported = unsupportedStocks.find((u) => u.symbol === selectedSymbol);

  // Popular stock shortcut pills
  const POPULAR_PILLS = ['TCS', 'RELIANCE', 'INFY', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA'];

  // Load quote and quick prediction for active selection
  useEffect(() => {
    let isCancelled = false;
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const q = await StockService.getQuote(selectedSymbol).catch(() => null);
        if (!isCancelled) setQuote(q);

        if (activeSupported) {
          const p = await StockPredictionService.predict({
            symbol: selectedSymbol,
            horizon: 1,
            target: 'target_next_return',
            allow_candidate: true,
          }).catch(() => null);
          if (!isCancelled) setPrediction(p);
        } else {
          if (!isCancelled) setPrediction(null);
        }
      } catch {
        // Handled gracefully
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchInfo();
    return () => {
      isCancelled = true;
    };
  }, [selectedSymbol, activeSupported]);

  const handleSelect = (sym: string) => {
    const clean = sym.trim().toUpperCase();
    onSelectSymbol(clean);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      handleSelect(searchInput);
      setSearchInput('');
    }
  };

  const isPositive = (prediction?.predicted_return ?? 0) >= 0;

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Title & Search bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-400" />
            <span>Stock Prediction Intelligence Lookup</span>
          </h2>
          <p className="text-xs text-slate-400">
            Query individual stock ML readiness, best estimators, and live forecast targets
          </p>
        </div>

        {/* Search Input Form */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search stock, ticker or company..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
        </form>
      </div>

      {/* Popular Shortcuts */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-slate-500 font-medium">Quick Select:</span>
        {POPULAR_PILLS.map((sym) => {
          const isSelected = selectedSymbol === sym;
          const isReady = supportedStocks.some((s) => s.symbol === sym);
          return (
            <button
              key={sym}
              onClick={() => handleSelect(sym)}
              className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : isReady
                    ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60'
                    : 'bg-slate-950/60 hover:bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              <span>{sym}</span>
              {isReady && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* Detailed Stock AI Intelligence Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center font-black text-lg text-emerald-400 font-mono shadow-inner">
              {selectedSymbol}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {activeSupported?.company_name || activeUnsupported?.company_name || `${selectedSymbol} Equity`}
                </h3>
                {activeSupported ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    MODEL READY
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    MODEL NOT REGISTERED
                  </span>
                )}
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {activeSupported?.market || activeUnsupported?.market || 'Global Market'} •{' '}
                {quote?.currentPrice ? `Live: $${quote.currentPrice.toFixed(2)}` : 'Market data connected'}
              </p>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => navigate(`/stocks?symbol=${encodeURIComponent(selectedSymbol)}`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all cursor-pointer shrink-0"
          >
            <span>View Prediction on Stocks Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeSupported ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
            {/* Best Model */}
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Best Model</span>
              <span className="font-bold text-white text-sm block mt-0.5">
                {activeSupported.best_model_name || activeSupported.model_type}
              </span>
            </div>

            {/* Model Version */}
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Model Version</span>
              <span className="font-bold text-slate-200 text-sm block mt-0.5">
                {activeSupported.model_version}
              </span>
            </div>

            {/* Supported Horizons */}
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Supported Horizons</span>
              <span className="font-bold text-teal-300 text-sm block mt-0.5">
                {activeSupported.supported_horizons.map((h) => `${h}D`).join(' / ')}
              </span>
            </div>

            {/* Target Variable */}
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Target Variable</span>
              <span className="font-bold text-slate-200 text-xs block mt-1 truncate" title={activeSupported.target}>
                {activeSupported.target}
              </span>
            </div>

            {/* Direction Accuracy */}
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Direction Accuracy</span>
              <span className="font-bold text-emerald-400 text-sm block mt-0.5">
                {activeSupported.directional_accuracy ? `${activeSupported.directional_accuracy.toFixed(1)}%` : 'N/A'}
              </span>
            </div>

            {/* Latest 1D Prediction */}
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Latest 1D Forecast</span>
              {prediction ? (
                <div className={`font-bold text-sm flex items-center gap-1 mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{isPositive ? '+' : ''}{(prediction.predicted_return * 100).toFixed(2)}%</span>
                </div>
              ) : (
                <span className="text-slate-500 text-xs mt-1 block">Pending Run</span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-200">No Production Model Registered for {selectedSymbol}</span>
              <p className="text-slate-300 leading-relaxed">
                Dedicated stock estimators are currently trained for TCS, RELIANCE, INFY, and AAPL.
                For {selectedSymbol}, the prediction pipeline uses generic cross-sectional models as fallback.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockIntelligenceSearch;
