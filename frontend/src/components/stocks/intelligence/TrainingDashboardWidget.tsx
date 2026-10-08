import React, { useState } from 'react';
import { TrainingStatusData } from '../../../types/stockPrediction.ts';
import { StockPredictionService } from '../../../services/stockPrediction.service.ts';
import {
  Terminal,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  status: TrainingStatusData | null;
  onRefresh: () => void;
}

export const TrainingDashboardWidget: React.FC<Props> = ({ status, onRefresh }) => {
  const [triggering, setTriggering] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleTriggerTraining = async () => {
    setTriggering(true);
    setMessage(null);
    try {
      const res = await StockPredictionService.triggerUniverseRetraining();
      setMessage(res.message || 'Retraining initiated.');
      onRefresh();
    } catch (err: unknown) {
      setMessage((err as Error).message || 'Failed to trigger training.');
    } finally {
      setTriggering(false);
    }
  };

  if (!status) return null;

  return (
    <div className="bg-gray-850/90 border border-gray-700/80 rounded-2xl p-5 mb-8 backdrop-blur-xl shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              ML Pipeline Architecture &amp; Training Governance
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  status.status === 'TRAINING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {status.status}
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Strict time-series walk-forward cross-validation pipeline status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleTriggerTraining}
            disabled={triggering || status.status === 'TRAINING'}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${triggering || status.status === 'TRAINING' ? 'animate-spin' : ''}`} />
            {status.status === 'TRAINING' ? 'Retraining...' : 'Run Retraining'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300">
          {message}
        </div>
      )}

      {/* Grid KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase font-medium">Discovered Stocks</span>
          <div className="text-lg font-bold text-white mt-1 font-mono">{status.total_discovered}</div>
          <span className="text-[10px] text-gray-400">Total in dataset</span>
        </div>

        <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase font-medium">Completed &amp; Validated</span>
          <div className="text-lg font-bold text-emerald-400 mt-1 font-mono">{status.completed}</div>
          <span className="text-[10px] text-emerald-400/80">Active predictions</span>
        </div>

        <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase font-medium">Insufficient Data</span>
          <div className="text-lg font-bold text-amber-400 mt-1 font-mono">{status.insufficient_data}</div>
          <span className="text-[10px] text-gray-400">&lt;60 historical bars</span>
        </div>

        <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase font-medium">Failed Validation</span>
          <div className="text-lg font-bold text-rose-400 mt-1 font-mono">{status.failed_validation}</div>
          <span className="text-[10px] text-gray-400">Corrupted sanity</span>
        </div>

        <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase font-medium">Registered Models</span>
          <div className="text-lg font-bold text-purple-400 mt-1 font-mono">{status.registered_models}</div>
          <span className="text-[10px] text-gray-400">Candidates &amp; baselines</span>
        </div>

        <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase font-medium">Pipeline Duration</span>
          <div className="text-lg font-bold text-cyan-400 mt-1 font-mono">{status.duration_seconds.toFixed(1)}s</div>
          <span className="text-[10px] text-gray-400">Time-series training</span>
        </div>
      </div>

      {status.rejected_stocks && status.rejected_stocks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Rejected stocks ({status.rejected_stocks.length}):{' '}
            {status.rejected_stocks.map((r) => `${r.symbol} (${r.reason})`).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
};
