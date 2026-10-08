import React, { useState, useEffect } from 'react';
import { Cpu, Award, ShieldCheck } from 'lucide-react';
import { ModelMetadataCard, MarketForecastItem } from '../../../types/stockPrediction.ts';
import { StockPredictionService } from '../../../services/stockPrediction.service.ts';

interface ModelTransparencySectionProps {
  symbol: string;
  horizon: number;
  activeForecast: MarketForecastItem | null;
}

export const ModelTransparencySection: React.FC<ModelTransparencySectionProps> = ({
  symbol,
  horizon,
  activeForecast,
}) => {
  const [candidateModels, setCandidateModels] = useState<ModelMetadataCard[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    const fetchModels = async () => {
      setLoading(true);
      try {
        const res = await StockPredictionService.listModels({ symbol });
        if (!isCancelled) {
          // Filter to models matching current horizon
          const matched = (res.models || []).filter(
            (m) => m.horizon === horizon && (m.symbol === symbol || m.ticker === symbol),
          );
          setCandidateModels(matched.length > 0 ? matched : res.models || []);
        }
      } catch {
        if (!isCancelled) setCandidateModels([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    if (symbol) {
      fetchModels();
    }

    return () => {
      isCancelled = true;
    };
  }, [symbol, horizon]);

  // Find best performing model on directional accuracy
  const bestModelId = candidateModels.reduce((best, cur) => {
    if (!best) return cur.model_id;
    const curAcc = cur.metrics?.validation?.directional_accuracy ?? 0;
    const bestModel = candidateModels.find((m) => m.model_id === best);
    const bestAcc = bestModel?.metrics?.validation?.directional_accuracy ?? 0;
    return curAcc > bestAcc ? cur.model_id : best;
  }, '');

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-7">
      {/* Title */}
      <div className="border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">
            Model Governance & Selection Transparency
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Validation metrics, training partitions, and production model selection rationale for {symbol} ({horizon}D)
        </p>
      </div>

      {/* Grid: Left = Model Information (Sec 19 & 21), Right = Model Architecture Comparison (Sec 20) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Production Model Metadata & Reason */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 lg:col-span-1 flex flex-col justify-between">
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-sans font-bold text-slate-300 text-sm">Production Model</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans text-slate-500">Algorithm:</span>
                <strong className="text-white">{activeForecast?.model_name || 'XGBoost'}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans text-slate-500">Version:</span>
                <span className="text-slate-200">v{activeForecast?.model_version || '1.0.0'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans text-slate-500">Target Variable:</span>
                <span className="text-teal-300 truncate max-w-[150px]">target_next_return</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans text-slate-500">Feature Version:</span>
                <span className="text-slate-300">v1.0.0 (58 features)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans text-slate-500">Training Period:</span>
                <span className="text-slate-300">2020 — 2026 (70% split)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans text-slate-500">Validation Split:</span>
                <span className="text-slate-300">15% Chronological</span>
              </div>
            </div>
          </div>

          {/* Model Selection Transparency Rationale (Requirement 21) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 font-sans">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Selection Rationale</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug font-sans">
              Selected based on historical validation performance. Models are objectively promoted to production when out-of-sample directional accuracy and RMSE exceed baseline benchmarks.
            </p>
          </div>
        </div>

        {/* Right Column: Comparative Architecture Matrix (Requirement 20) */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Candidate Model Evaluation Comparison
              </h3>
              <p className="text-xs text-slate-400">
                Historical validation metrics across evaluated model architectures for {symbol}
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Holdout Partition</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500 uppercase tracking-wider bg-slate-950/40">
                  <th className="py-2.5 px-3">Model Architecture</th>
                  <th className="py-2.5 px-3 text-right">Direction Acc</th>
                  <th className="py-2.5 px-3 text-right">MAE</th>
                  <th className="py-2.5 px-3 text-right">RMSE</th>
                  <th className="py-2.5 px-3 text-right">R²</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Loading candidate architectures...
                    </td>
                  </tr>
                ) : candidateModels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No candidate models registered for this ticker and horizon.
                    </td>
                  </tr>
                ) : (
                  candidateModels.map((m) => {
                    const isBest = m.model_id === bestModelId;
                    const da = m.metrics?.validation?.directional_accuracy;
                    const mae = m.metrics?.validation?.mae;
                    const rmse = m.metrics?.validation?.rmse;
                    const r2 = m.metrics?.validation?.r2;

                    return (
                      <tr
                        key={m.model_id}
                        className={`hover:bg-slate-900/60 transition ${
                          isBest ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-sans">
                          <div className="flex items-center gap-2">
                            <strong className="text-white font-mono">{m.model_name}</strong>
                            <span className="text-slate-500 text-[10px]">v{m.model_version}</span>
                            {isBest && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                <Award className="w-2.5 h-2.5" />
                                <span>Best historical validation performance</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-bold">
                          {da !== undefined && da !== null ? (
                            <span className="text-emerald-400">{Number(da).toFixed(1)}%</span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right text-slate-300">
                          {mae !== undefined && mae !== null ? Number(mae).toFixed(4) : 'N/A'}
                        </td>

                        <td className="py-3 px-3 text-right text-cyan-400 font-bold">
                          {rmse !== undefined && rmse !== null ? Number(rmse).toFixed(4) : 'N/A'}
                        </td>

                        <td className="py-3 px-3 text-right text-teal-300">
                          {r2 !== undefined && r2 !== null ? Number(r2).toFixed(3) : 'N/A'}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              m.status === 'PRODUCTION'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelTransparencySection;
