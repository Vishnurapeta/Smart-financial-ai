import React from 'react';
import { ModelArchitectureBenchmarkItem } from '../../../types/stockPrediction.ts';
import { Cpu } from 'lucide-react';

interface Props {
  models: ModelArchitectureBenchmarkItem[];
  loading: boolean;
  horizon: number;
}

export const ModelArchitecturePerformanceSection: React.FC<Props> = ({ models, loading, horizon }) => {
  if (loading && models.length === 0) {
    return (
      <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5 mb-8 animate-pulse">
        <div className="h-6 w-56 bg-gray-700/50 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-700/40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (models.length === 0) return null;

  return (
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-2xl p-5 mb-8 backdrop-blur-xl shadow-lg">
      <div className="mb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          Candidate Model Benchmarks &amp; Selection ({horizon} Day Horizon)
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Out-of-sample chronological time-series validation metrics across all evaluated equities. The top candidate per stock is promoted to Production.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {models.map((m, idx) => {
          const isTop = idx === 0;

          return (
            <div
              key={m.model_key}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                isTop
                  ? 'border-purple-500/40 bg-purple-500/10 shadow-md shadow-purple-500/5'
                  : 'border-gray-700/70 bg-gray-900/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">{m.model_name}</span>
                  {m.production_models_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      {m.production_models_count} in Prod
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <span className="text-2xl font-bold font-mono text-cyan-300">
                    {m.avg_directional_accuracy.toFixed(1)}%
                  </span>
                  <div className="text-[11px] text-gray-400">Directional Accuracy</div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-700/60 grid grid-cols-3 gap-1 text-[11px] text-gray-300 font-mono">
                <div>
                  <span className="block text-[10px] text-gray-400 font-sans">RMSE</span>
                  {m.avg_rmse.toFixed(3)}
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-sans">MAE</span>
                  {m.avg_mae.toFixed(3)}
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-sans">R²</span>
                  {m.avg_r2.toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
