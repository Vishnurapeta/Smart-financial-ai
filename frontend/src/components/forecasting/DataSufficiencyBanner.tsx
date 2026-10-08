import React from 'react';
import { AlertCircle, PlusCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DataSufficiencyBannerProps {
  actualMonths: number;
  minMonthsRequired: number;
}

export const DataSufficiencyBanner: React.FC<DataSufficiencyBannerProps> = ({
  actualMonths,
  minMonthsRequired = 3,
}) => {
  const navigate = useNavigate();
  const progressPercent = Math.min(100, Math.round((actualMonths / minMonthsRequired) * 100));

  return (
    <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-5">
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">More Transaction History Needed</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              At least {minMonthsRequired} months of continuous transaction records are required to construct time-series lags and eliminate overfitting.
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xs text-slate-400">Current History:</span>
          <div className="text-xl font-extrabold text-amber-400 font-mono">
            {actualMonths} / {minMonthsRequired} Months
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Data Sufficiency Progress</span>
          <span className="font-mono font-semibold">{progressPercent}% Ready</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Explanation & Action CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span>SmartFin AI refuses to fabricate artificial forecasts from sparse data to protect financial accuracy.</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => navigate('/transactions')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Transactions</span>
          </button>
          <button
            onClick={() => navigate('/transactions')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold transition"
          >
            <span>Import CSV</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
