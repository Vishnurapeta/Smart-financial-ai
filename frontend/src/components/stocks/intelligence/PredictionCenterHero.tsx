import React from 'react';
import { Sparkles, Clock, Layers, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface PredictionCenterHeroProps {
  selectedHorizon: number;
  onSelectHorizon: (h: number) => void;
  lastUpdated?: string | null;
  supportedStocksCount: number;
  modelsCount: number;
  loading: boolean;
}

export const PredictionCenterHero: React.FC<PredictionCenterHeroProps> = ({
  selectedHorizon,
  onSelectHorizon,
  lastUpdated,
  supportedStocksCount,
  modelsCount,
  loading,
}) => {
  const formatTime = (iso?: string | null) => {
    if (!iso) return 'Today (Live)';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Today (Live)';
    }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
      {/* Background glow subtle */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Stock Prediction Center</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            AI Stock Predictions
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            AI-powered market forecasts based on historical market data and machine-learning models.
            Discover model-estimated returns, compare predictions across equities, and explore forecast signals.
          </p>
        </div>

        {/* Live System Stats */}
        <div className="grid grid-cols-3 gap-3 text-xs font-mono shrink-0">
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-sans block flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> Last Updated
            </span>
            <span className="text-xs font-bold text-white mt-1 block">
              {formatTime(lastUpdated)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-sans block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Supported
            </span>
            <span className="text-xs font-bold text-emerald-400 mt-1 block">
              {supportedStocksCount} Stocks
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-sans block flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-400" /> Models
            </span>
            <span className="text-xs font-bold text-purple-300 mt-1 block">
              {modelsCount} Active
            </span>
          </div>
        </div>
      </div>

      {/* Horizon Selector Bar & Statutory Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Forecast Horizon:</span>
          <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-1">
            {[
              { days: 1, label: '1 Day', sub: 'Next Close' },
              { days: 5, label: '5 Days', sub: '1 Week' },
              { days: 20, label: '20 Days', sub: '1 Month' },
            ].map((h) => {
              const isActive = selectedHorizon === h.days;
              return (
                <button
                  key={h.days}
                  onClick={() => onSelectHorizon(h.days)}
                  disabled={loading}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span>{h.label}</span>
                  <span className={`text-[10px] opacity-75 font-normal ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                    ({h.sub})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Regulatory disclaimer notice */}
        <p className="text-[11px] text-slate-400 leading-snug max-w-xl flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>Forecasts are statistical model estimates and are not guaranteed future outcomes or investment advice.</span>
        </p>
      </div>
    </div>
  );
};

export default PredictionCenterHero;
