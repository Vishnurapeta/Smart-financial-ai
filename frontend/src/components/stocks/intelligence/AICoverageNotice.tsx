import React from 'react';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { SupportedStockCoverage, UnsupportedStockInfo } from '../../../types/stockPrediction.ts';

interface AICoverageNoticeProps {
  supportedStocks: SupportedStockCoverage[];
  unsupportedStocks: UnsupportedStockInfo[];
}

export const AICoverageNotice: React.FC<AICoverageNoticeProps> = ({
  supportedStocks,
  unsupportedStocks,
}) => {
  const pendingSymbols = unsupportedStocks.length > 0
    ? unsupportedStocks.map((u) => u.symbol)
    : ['MSFT', 'NVDA', 'GOOGL', 'TSLA', 'AMZN', 'META'];
  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>AI Model Universe & Coverage Transparency</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Dedicated machine learning estimators are trained exclusively on validated equity datasets
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
          <span>AI Coverage: {supportedStocks.length} Equities Trained</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Supported Stocks with Trained Models */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 font-sans">
              <CheckCircle2 className="w-4 h-4" />
              <span>Full AI Prediction Coverage ({supportedStocks.length})</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-300">Models Active</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {supportedStocks.map((s) => (
              <div
                key={s.symbol}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 font-mono"
              >
                <span className="font-bold text-white">{s.symbol}</span>
                <span className="text-[10px] text-emerald-400">✓ Trained</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            These equities have dedicated chronological models trained across 1D, 5D, and 20D horizons with walk-forward validation.
          </p>
        </div>

        {/* Market Data Only (No Dedicated ML Model) */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 flex items-center gap-1.5 font-sans">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span>Market Data Available / AI Model Pending</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Cross-Sectional Only</span>
          </div>

          <div className="flex flex-wrap gap-2 font-mono">
            {pendingSymbols.map((sym) => (
              <div
                key={sym}
                className="px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-400 text-xs"
              >
                <span>{sym}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Live quotes and charts are fully available via the market provider. Live dedicated stock predictions will be enabled upon model training and registration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AICoverageNotice;
