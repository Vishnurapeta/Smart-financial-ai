import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Clock,
  Cpu,
  Database,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { StockPredictionResponse } from '../../types/stockPrediction.ts';

interface PredictionCardProps {
  symbol: string;
  prediction: StockPredictionResponse | null;
  loading: boolean;
  error: string | null;
  errorStatus: number | null;
  activeHorizon: number;
  onHorizonChange: (h: number) => void;
  activeTarget: string;
  onTargetChange: (target: string) => void;
  onRefresh: () => void;
  currencySymbol?: string;
}

const HORIZON_OPTIONS = [
  { label: '1 Day (Next Close)', value: 1 },
  { label: '5 Days (1 Week)', value: 5 },
  { label: '20 Days (1 Month)', value: 20 },
];

const TARGET_OPTIONS = [
  { label: 'Next Return (%)', value: 'target_next_return' },
  { label: 'Next Close Price', value: 'target_next_close' },
];

export const PredictionCard: React.FC<PredictionCardProps> = ({
  symbol,
  prediction,
  loading,
  error,
  errorStatus,
  activeHorizon,
  onHorizonChange,
  activeTarget,
  onTargetChange,
  onRefresh,
  currencySymbol = '$',
}) => {
  const isReturnPositive = (prediction?.predicted_return ?? 0) >= 0;

  // Format timestamps nicely
  const formatTimestamp = (iso?: string) => {
    if (!iso) return '---';
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/30 p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-md">
      {/* Background glow effect */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Title and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                AI Stock Prediction Intelligence
              </h2>
              {prediction?.model_status && (
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                    prediction.model_status === 'PRODUCTION'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                  }`}
                >
                  {prediction.model_status} Model
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Quantitative forecasting powered by Leakage-Free ML pipeline
            </p>
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Generate Forecast</span>
          </button>
        </div>
      </div>

      {/* Target & Horizon Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
        {/* Horizon selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Horizon:</span>
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onHorizonChange(opt.value)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  activeHorizon === opt.value
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Target:</span>
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            {TARGET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onTargetChange(opt.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTarget === opt.value
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-200">
              {errorStatus === 503
                ? 'Market Data Unavailable'
                : errorStatus === 404
                  ? 'No Eligible Registered Model'
                  : errorStatus === 409
                    ? 'Incompatible Model Horizon'
                    : 'Prediction Engine Notice'}
            </span>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse">
            <Cpu className="w-6 h-6 animate-spin" />
          </div>
          <div className="text-sm font-semibold text-white">
            Loading... Generating forecast for {symbol}...
          </div>
          <p className="text-xs text-slate-400 max-w-sm text-center">
            Fetching market data, computing 58 technical features with zero lookahead, and running model inference.
          </p>
        </div>
      )}

      {/* Prediction Output Results */}
      {prediction && !loading && (
        <div className="space-y-6">
          {/* Hero Forecast Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Current Price */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1 font-mono">
              <span className="text-[11px] text-slate-400 font-sans block">Current Price (Pt)</span>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {currencySymbol}
                {prediction.current_price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-[10px] text-slate-500 font-sans block">
                At market timestamp
              </span>
            </div>

            {/* 2. Predicted Return */}
            <div
              className={`p-4 rounded-2xl border space-y-1 font-mono ${
                isReturnPositive
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-rose-500/10 border-rose-500/30'
              }`}
            >
              <div className="flex items-center justify-between font-sans">
                <span className="text-[11px] text-slate-300">Forecasted Return (R̂)</span>
                {prediction.is_derived_return && (
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    Derived
                  </span>
                )}
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black flex items-center gap-1.5 ${
                  isReturnPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isReturnPositive ? (
                  <TrendingUp className="w-6 h-6" />
                ) : (
                  <TrendingDown className="w-6 h-6" />
                )}
                <span>
                  {isReturnPositive ? '+' : ''}
                  {(prediction.predicted_return * 100).toFixed(2)}%
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans block">
                Over {prediction.horizon} trading session{prediction.horizon > 1 ? 's' : ''}
              </span>
            </div>

            {/* 3. Predicted Target Price */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1 font-mono">
              <div className="flex items-center justify-between font-sans">
                <span className="text-[11px] text-slate-400">Forecasted Value (P̂)</span>
                {prediction.is_derived_price && (
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    Derived
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                {currencySymbol}
                {prediction.predicted_value.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-[10px] text-slate-500 font-sans block">
                Estimated price target
              </span>
            </div>
          </div>

          {/* Model Metadata & Lineage Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 font-mono">
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Stock Symbol</span>
              <span className="font-bold text-emerald-400 text-sm">{prediction.symbol || symbol}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Forecast Horizon</span>
              <span className="font-bold text-white text-sm">{prediction.horizon} Day{prediction.horizon > 1 ? 's' : ''}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Target Variable</span>
              <span className="font-bold text-teal-300 text-xs truncate block" title={prediction.target}>
                {prediction.target.includes('return') ? 'Next Return (%)' : 'Next Close Price'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Model Architecture</span>
              <span className="font-bold text-white text-sm">{prediction.model_name}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Model Version</span>
              <span className="font-bold text-slate-200">v{prediction.model_version}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Inference Duration</span>
              <span className="font-bold text-cyan-400">{prediction.latency_ms?.total_ms ?? 0} ms</span>
            </div>
          </div>

          {/* Historical Evaluation Metrics */}
          {prediction.historical_metrics && Object.keys(prediction.historical_metrics).length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/70 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Historical Evaluation Metrics ({prediction.model_name})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {String(prediction.historical_metrics.period || 'Validation')} Holdout
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                {prediction.historical_metrics.mae !== undefined && (
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">MAE</span>
                    <span className="text-sm font-bold text-white">
                      {Number(prediction.historical_metrics.mae).toFixed(4)}
                    </span>
                  </div>
                )}
                {prediction.historical_metrics.rmse !== undefined && (
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">RMSE</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {Number(prediction.historical_metrics.rmse).toFixed(4)}
                    </span>
                  </div>
                )}
                {prediction.historical_metrics.mape !== undefined && (
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">MAPE</span>
                    <span className="text-sm font-bold text-teal-300">
                      {Number(prediction.historical_metrics.mape).toFixed(2)}%
                    </span>
                  </div>
                )}
                {prediction.historical_metrics.r2 !== undefined && (
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">R² Score</span>
                    <span className="text-sm font-bold text-teal-300">
                      {Number(prediction.historical_metrics.r2).toFixed(4)}
                    </span>
                  </div>
                )}
                {prediction.historical_metrics.directional_accuracy !== undefined && (
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">Directional Acc</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {Number(prediction.historical_metrics.directional_accuracy).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps & Audit Transparency */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-400 px-2">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Market Data Bar:{' '}
                <strong className="text-slate-200 font-mono">
                  {formatTimestamp(prediction.market_data_timestamp)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Predicted At:{' '}
                <strong className="text-slate-200 font-mono">
                  {formatTimestamp(prediction.prediction_timestamp)}
                </strong>
              </span>
            </div>
          </div>

          {/* Latency Pipeline Diagnostics */}
          {prediction.latency_ms && (
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-semibold block mb-2">
                Pipeline Latency Diagnostics:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Market Data:</span>
                  <span className="text-white font-bold">{prediction.latency_ms.market_data_ms}ms</span>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Model Load:</span>
                  <span className="text-emerald-400 font-bold">
                    {prediction.latency_ms.model_load_ms}ms (Cache)
                  </span>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Feature Gen:</span>
                  <span className="text-white font-bold">{prediction.latency_ms.feature_gen_ms}ms</span>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Estimator:</span>
                  <span className="text-teal-400 font-bold">{prediction.latency_ms.inference_ms}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PredictionCard;
