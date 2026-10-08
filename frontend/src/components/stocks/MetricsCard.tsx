import React from 'react';
import { BarChart3, ShieldCheck } from 'lucide-react';
import { HistoricalMetrics } from '../../types/stockPrediction.ts';

interface MetricsCardProps {
  metrics: HistoricalMetrics | null;
  modelName: string;
  target: string;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  metrics,
  modelName,
  target,
}) => {
  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-center text-xs text-slate-400">
        No detailed historical metrics available for this model configuration.
      </div>
    );
  }

  const isReturnTarget = target === 'target_next_return';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            Historical Evaluation Metrics ({modelName})
          </h3>
          <p className="text-xs text-slate-400">
            Computed on chronological holdout validation data with zero future lookahead
          </p>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-slate-800 text-teal-300 border border-slate-700">
          Period: {metrics.period || 'Validation'} ({metrics.sample_count || '---'} bars)
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        {/* MAE */}
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-sans">
            <span>Mean Absolute Error</span>
            <span className="text-slate-500 font-mono">MAE</span>
          </div>
          <div className="text-xl font-bold text-white">
            {metrics.mae !== undefined ? metrics.mae.toFixed(4) : '---'}
          </div>
          <span className="text-[10px] text-slate-500 font-sans block">
            Avg absolute forecast deviation
          </span>
        </div>

        {/* RMSE */}
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-sans">
            <span>Root Mean Squared Error</span>
            <span className="text-slate-500 font-mono">RMSE</span>
          </div>
          <div className="text-xl font-bold text-emerald-400">
            {metrics.rmse !== undefined ? metrics.rmse.toFixed(4) : '---'}
          </div>
          <span className="text-[10px] text-slate-500 font-sans block">
            Penalizes large error outliers
          </span>
        </div>

        {/* R² */}
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-sans">
            <span>Coefficient of Determ.</span>
            <span className="text-slate-500 font-mono">R²</span>
          </div>
          <div
            className={`text-xl font-bold ${
              (metrics.r2 ?? 0) >= 0 ? 'text-teal-300' : 'text-slate-400'
            }`}
          >
            {metrics.r2 !== undefined ? metrics.r2.toFixed(4) : '---'}
          </div>
          <span className="text-[10px] text-slate-500 font-sans block">
            Variance explained by model
          </span>
        </div>

        {/* Directional Accuracy */}
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-sans">
            <span>Directional Accuracy</span>
            <span className="text-slate-500 font-mono">DA %</span>
          </div>
          <div
            className={`text-xl font-bold ${
              (metrics.directional_accuracy ?? 0) >= 50
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {metrics.directional_accuracy !== undefined
              ? `${metrics.directional_accuracy.toFixed(1)}%`
              : '---'}
          </div>
          <span className="text-[10px] text-slate-500 font-sans block">
            Correct sign/trend prediction
          </span>
        </div>
      </div>

      {/* Additional Return Metrics (if return target) */}
      {isReturnTarget && (
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/60 text-xs font-mono">
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50 flex justify-between items-center">
            <span className="text-slate-400 text-[11px] font-sans">Precision:</span>
            <span className="font-bold text-white">
              {metrics.directional_precision !== undefined
                ? `${(metrics.directional_precision * 100).toFixed(1)}%`
                : '---'}
            </span>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50 flex justify-between items-center">
            <span className="text-slate-400 text-[11px] font-sans">Recall:</span>
            <span className="font-bold text-white">
              {metrics.directional_recall !== undefined
                ? `${(metrics.directional_recall * 100).toFixed(1)}%`
                : '---'}
            </span>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50 flex justify-between items-center">
            <span className="text-slate-400 text-[11px] font-sans">F1 Score:</span>
            <span className="font-bold text-teal-400">
              {metrics.directional_f1 !== undefined
                ? metrics.directional_f1.toFixed(3)
                : '---'}
            </span>
          </div>
        </div>
      )}

      {/* Compliance Note */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Metrics represent objective historical holdout test evaluations and are not a guarantee of future prediction accuracy or trading profitability.
        </span>
      </div>
    </div>
  );
};

export default MetricsCard;
