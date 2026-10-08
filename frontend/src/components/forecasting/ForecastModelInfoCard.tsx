import React from 'react';
import { Cpu, CheckCircle2, BarChart2, HelpCircle } from 'lucide-react';
import {
  ModelMetadataItem,
  ForecastMetricsItem,
  CandidateModelComparisonItem,
} from '../../types/forecasting.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface ForecastModelInfoCardProps {
  model?: ModelMetadataItem;
  metrics?: ForecastMetricsItem;
  candidateModels?: CandidateModelComparisonItem[];
  currencySymbol?: string;
}

export const ForecastModelInfoCard: React.FC<ForecastModelInfoCardProps> = ({
  model,
  metrics,
  candidateModels = [],
  currencySymbol: propCurrencySymbol,
}) => {
  const { symbol: userSymbol } = useCurrency();
  const currencySymbol = propCurrencySymbol || userSymbol;
  if (!model) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Model Architecture &amp; Holdout Validation Metrics
          </h3>
          <p className="text-xs text-slate-400">
            Out-of-sample validation ensures complex machine learning models must strictly outperform the Moving Average baseline.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Active: {model.name}</span>
        </span>
      </div>

      {/* Model Spec Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Algorithm Architecture</span>
          <span className="text-sm font-bold text-white font-mono">{model.name}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Training Time Span</span>
          <span className="text-sm font-bold text-slate-300 font-mono">{model.training_period}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Feature Pipeline</span>
          <span className="text-sm font-bold text-slate-300 font-mono">v{model.feature_version} (Leak-Free)</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Model Version</span>
          <span className="text-sm font-bold text-slate-300 font-mono">v{model.version}</span>
        </div>
      </div>

      {/* Selection Reason */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-emerald-300">Model Selection Decision: </span>
          <span>{model.selection_reason}</span>
        </div>
      </div>

      {/* Metrics Row */}
      {metrics && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <BarChart2 className="w-3.5 h-3.5 text-teal-400" />
            Holdout Validation Metrics
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-500 block">MAE (Mean Absolute Error)</span>
              <span className="text-lg font-extrabold text-emerald-400 font-mono">
                {currencySymbol}{metrics.mae.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Average error in currency units</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-500 block">RMSE (Root Mean Square)</span>
              <span className="text-lg font-extrabold text-teal-400 font-mono">
                {currencySymbol}{metrics.rmse.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Penalizes large deviations</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-500 block">MAPE (%)</span>
              <span className="text-lg font-extrabold text-cyan-400 font-mono">
                {metrics.mape !== undefined && metrics.mape !== null ? `${metrics.mape.toFixed(1)}%` : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Mean percentage error</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-500 block">R² Score</span>
              <span className="text-lg font-extrabold text-indigo-400 font-mono">
                {metrics.r2 !== undefined && metrics.r2 !== null ? metrics.r2.toFixed(3) : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Variance explained</span>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Models Benchmarking Table */}
      {candidateModels.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Candidate Models Cross-Validation Benchmarking
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Model Candidate</th>
                  <th className="py-2 px-3 text-right">Holdout MAE</th>
                  <th className="py-2 px-3 text-right">Holdout RMSE</th>
                  <th className="py-2 px-3 text-right">MAPE (%)</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {candidateModels.map((cand) => (
                  <tr
                    key={cand.name}
                    className={cand.is_selected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/30'}
                  >
                    <td className="py-2.5 px-3 font-sans font-medium text-white flex items-center gap-2">
                      {cand.name}
                      {cand.is_selected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 font-bold font-sans">
                          CHAMPION
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {currencySymbol}{cand.mae.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {currencySymbol}{cand.rmse.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {cand.mape !== undefined && cand.mape !== null ? `${cand.mape.toFixed(1)}%` : '---'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cand.is_selected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cand.is_selected ? 'Production' : 'Evaluated'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explanatory note */}
      <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-3 border-t border-slate-800">
        <HelpCircle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
        <span>
          <strong>How this forecast was computed:</strong> The system extracted chronologically lagged features (1, 2, and 3-month expense lags, 3-month rolling mean, trend, and calendar quarters). Models were trained on the earliest historical period and tested on holdout validation data without look-ahead bias.
        </span>
      </div>
    </div>
  );
};
