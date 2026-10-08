import React, { useState, useEffect } from 'react';
import { X, Cpu, Sparkles, Activity } from 'lucide-react';
import { ModelDetailData } from '../../../types/stockPrediction.ts';
import { StockPredictionService } from '../../../services/stockPrediction.service.ts';

interface ModelDetailsModalProps {
  modelId: string | null;
  onClose: () => void;
}

export const ModelDetailsModal: React.FC<ModelDetailsModalProps> = ({ modelId, onClose }) => {
  const [details, setDetails] = useState<ModelDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'features' | 'hyperparams'>('overview');

  useEffect(() => {
    if (!modelId) {
      setDetails(null);
      return;
    }

    let isCancelled = false;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await StockPredictionService.getModelDetails(modelId);
        if (!isCancelled) setDetails(res);
      } catch {
        if (!isCancelled) setDetails(null);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isCancelled = true;
    };
  }, [modelId]);

  if (!modelId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {details?.model_name || 'Loading Model...'}
                </h3>
                {details?.status && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      details.status === 'PRODUCTION'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                    }`}
                  >
                    {details.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Model ID: <span className="text-slate-300 font-bold">{modelId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Nav Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 text-xs font-medium bg-slate-950/20">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Model Architecture
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition cursor-pointer ${
              activeTab === 'metrics'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Evaluation Metrics
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition cursor-pointer ${
              activeTab === 'features'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Features ({details?.features_used?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('hyperparams')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition cursor-pointer ${
              activeTab === 'hyperparams'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Hyperparameters
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Cpu className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="text-slate-400 font-mono">Loading model metadata...</span>
            </div>
          ) : !details ? (
            <div className="text-center py-8 text-slate-500 font-mono">
              Could not load metadata for model {modelId}.
            </div>
          ) : (
            <>
              {/* Tab 1: Architecture Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-sans block">Stock Ticker</span>
                      <strong className="text-emerald-400 text-sm">{details.ticker}</strong>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-sans block">Forecast Horizon</span>
                      <strong className="text-teal-300 text-sm">{details.horizon} Trading Session{details.horizon > 1 ? 's' : ''}</strong>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-sans block">Target Column</span>
                      <strong className="text-white text-xs block truncate" title={details.target}>
                        {details.target}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-sans block">Model Version</span>
                      <strong className="text-slate-200 text-sm">v{details.model_version}</strong>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-sans block">Feature Version</span>
                      <strong className="text-slate-200 text-sm">{details.feature_version}</strong>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-sans block">Dataset Version</span>
                      <strong className="text-purple-300 text-sm">{details.dataset_version}</strong>
                    </div>
                  </div>

                  {/* Time Periods */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 font-mono">
                    <span className="text-[11px] text-slate-400 font-sans font-semibold block">
                      Chronological Training, Validation & Holdout Partitions:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Training Split (70%)</span>
                        <span className="text-slate-200">{details.training_start?.split(' ')[0]} to {details.training_end?.split(' ')[0]}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Validation Split (15%)</span>
                        <span className="text-emerald-400">{details.validation_start?.split(' ')[0]} to {details.validation_end?.split(' ')[0]}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Test Split (15%)</span>
                        <span className="text-cyan-400">{details.test_start?.split(' ')[0]} to {details.test_end?.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Registration History */}
                  {details.status_history && details.status_history.length > 0 && (
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                      <span className="text-[11px] text-slate-400 font-semibold block">
                        Audit Lifecycle History:
                      </span>
                      <div className="space-y-1.5 font-mono text-[11px]">
                        {details.status_history.map((sh, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-400 border-b border-slate-800/40 pb-1">
                            <span className="text-emerald-400 font-bold">{sh.status}</span>
                            <span>{sh.reason || 'Status update'}</span>
                            <span className="text-slate-500">{new Date(sh.timestamp).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Detailed Metrics */}
              {activeTab === 'metrics' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Holdout Validation Set Metrics
                      </h4>
                      <span className="text-[10px] font-mono text-slate-500">
                        Sample Size: {details.metrics?.validation?.sample_count || '---'} bars
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans block">MAE</span>
                        <span className="text-sm font-bold text-white">
                          {details.metrics?.validation?.mae !== undefined ? Number(details.metrics.validation.mae).toFixed(4) : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans block">RMSE</span>
                        <span className="text-sm font-bold text-cyan-400">
                          {details.metrics?.validation?.rmse !== undefined ? Number(details.metrics.validation.rmse).toFixed(4) : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans block">R² Score</span>
                        <span className="text-sm font-bold text-teal-300">
                          {details.metrics?.validation?.r2 !== undefined ? Number(details.metrics.validation.r2).toFixed(3) : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans block">Directional Accuracy</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {details.metrics?.validation?.directional_accuracy !== undefined
                            ? `${Number(details.metrics.validation.directional_accuracy).toFixed(1)}%`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {details.metrics?.test && Object.keys(details.metrics.test).length > 0 && (
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        Out-of-Time Test Set Metrics
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 font-sans block">Test MAE</span>
                          <span className="text-sm font-bold text-white">
                            {details.metrics.test.mae !== undefined ? Number(details.metrics.test.mae).toFixed(4) : 'N/A'}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 font-sans block">Test RMSE</span>
                          <span className="text-sm font-bold text-cyan-400">
                            {details.metrics.test.rmse !== undefined ? Number(details.metrics.test.rmse).toFixed(4) : 'N/A'}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 font-sans block">Test R²</span>
                          <span className="text-sm font-bold text-teal-300">
                            {details.metrics.test.r2 !== undefined ? Number(details.metrics.test.r2).toFixed(3) : 'N/A'}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 font-sans block">Test Dir Acc</span>
                          <span className="text-sm font-bold text-emerald-400">
                            {details.metrics.test.directional_accuracy !== undefined
                              ? `${Number(details.metrics.test.directional_accuracy).toFixed(1)}%`
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Features Used */}
              {activeTab === 'features' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <span className="text-xs font-semibold text-slate-300 block">
                      58 Quantitative Engineered Features (Zero Lookahead):
                    </span>
                    <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                      {details.features_used.map((feat) => (
                        <span
                          key={feat}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:border-emerald-500/30 transition cursor-default"
                        >
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Hyperparameters */}
              {activeTab === 'hyperparams' && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs overflow-x-auto">
                  <pre className="text-emerald-400 leading-relaxed">
                    {JSON.stringify(details.hyperparameters || {}, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelDetailsModal;
