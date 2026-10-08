import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

interface ForecastDisclaimerProps {
  compact?: boolean;
}

export const ForecastDisclaimer: React.FC<ForecastDisclaimerProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2.5">
        <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span>
          <strong className="text-slate-300 font-medium">Model-Generated Estimates:</strong>{' '}
          Forecasts represent statistical projections based on historical transactions and recurring obligations. Actual future cash flow may vary.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 text-xs text-slate-300 space-y-2">
      <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>Financial Forecasting Transparency &amp; Methodology Disclaimer</span>
      </div>
      <p className="text-slate-400 leading-relaxed">
        SmartFin AI forecasting algorithms synthesize past transactions, recurring commitments, and planned savings goals to compute probabilistic future projections. All forecasts are{' '}
        <strong className="text-slate-200">model-generated estimates</strong> and{' '}
        <strong className="text-slate-200">do not guarantee future financial outcomes or constitute investment/tax advice</strong>. Actual expenses and cash flow may differ materially due to unforeseen life events, discretionary spending variations, or market shifts.
      </p>
    </div>
  );
};
