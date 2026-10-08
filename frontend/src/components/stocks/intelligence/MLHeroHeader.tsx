import React from 'react';
import { Activity, Database, RefreshCw, Cpu } from 'lucide-react';
import { MLOverviewData, PipelineHealthData } from '../../../types/stockPrediction.ts';

interface MLHeroHeaderProps {
  overview: MLOverviewData | null;
  health: PipelineHealthData | null;
  loading: boolean;
  onRefresh: () => void;
}

export const MLHeroHeader: React.FC<MLHeroHeaderProps> = ({
  overview,
  health,
  loading,
  onRefresh,
}) => {
  const isHealthy = health?.overall_status === 'OPERATIONAL' || overview?.status === 'ML SYSTEM OPERATIONAL';

  // Format timestamp helper
  const formatTime = (iso?: string | null) => {
    if (!iso) return '---';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono uppercase tracking-wider font-bold">
              {isHealthy ? 'ML SYSTEM OPERATIONAL' : 'SYSTEM DEGRADED'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 text-[11px]">FastAPI Inference & Model Registry</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <span>AI Stock Prediction Intelligence</span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Centralized machine-learning intelligence, model performance, and forecast analytics across
            supported stocks. Audited with walk-forward time-series validation and zero future lookahead leakage.
          </p>
        </div>

        {/* Live Meta Info & Action */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh ML Metrics</span>
          </button>

          {/* Quick info pills */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-1.5 text-[11px] text-slate-400 font-mono">
            <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1 rounded-lg border border-slate-800">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Catalog Updated:</span>
              <strong className="text-slate-200 font-bold">
                {overview?.last_training_timestamp ? formatTime(overview.last_training_timestamp) : 'N/A'}
              </strong>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1 rounded-lg border border-slate-800">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>Latest Inference:</span>
              <strong className="text-slate-200 font-bold">
                {overview?.latest_inference_timestamp ? formatTime(overview.latest_inference_timestamp) : 'N/A'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLHeroHeader;
