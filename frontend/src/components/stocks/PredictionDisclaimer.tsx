import React from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';

interface PredictionDisclaimerProps {
  compact?: boolean;
}

export const PredictionDisclaimer: React.FC<PredictionDisclaimerProps> = ({
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          Model forecasts are statistical estimates based on historical market data and do not guarantee future performance or financial returns.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-amber-950/20 border border-amber-500/20 p-4 sm:p-5 shadow-lg">
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <span>Regulatory &amp; Quantitative Model Notice</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Non-Guaranteed Forecast
            </span>
          </div>
          <p className="leading-relaxed text-slate-400">
            Stock market predictions and signals displayed in SmartFin AI are generated using statistical machine learning models (XGBoost, Random Forest, Linear Regression, and LSTM) trained strictly on historical End-of-Day (EOD) market data and technical indicators.
          </p>
          <p className="leading-relaxed text-slate-400">
            These outputs are provided strictly for analytical, research, and informational purposes and <strong className="text-slate-200">do not constitute investment advice, financial recommendations, or guaranteed price targets</strong>. Financial markets are inherently stochastic and subject to capital loss. Past statistical performance is no guarantee of future returns.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PredictionDisclaimer;
