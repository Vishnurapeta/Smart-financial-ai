import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Sparkles,
  Info,
  Briefcase,
  Activity,
} from 'lucide-react';
import { MarketForecastItem } from '../../../types/stockPrediction.ts';
import { HoldingDto } from '../../../types/portfolio.ts';

interface SelectedStockForecastViewProps {
  forecast: MarketForecastItem | null;
  selectedHorizon?: number;
  holding?: HoldingDto | null;
}

export const SelectedStockForecastView: React.FC<SelectedStockForecastViewProps> = ({
  forecast,
  selectedHorizon: _selectedHorizon,
  holding,
}) => {
  const navigate = useNavigate();

  if (!forecast) {
    return (
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-8 text-center text-slate-500 font-mono">
        Select a stock from the forecasts table above to inspect its detailed AI prediction.
      </div>
    );
  }

  const isPos = (forecast.predicted_return ?? 0) >= 0;
  const isBullish = forecast.direction === 'Bullish';
  const isBearish = forecast.direction === 'Bearish';

  // Group signals
  const signals = forecast.signals || [];
  const positiveSignals = signals.filter((s) => s.type === 'positive');
  const neutralSignals = signals.filter((s) => s.type === 'neutral');
  const negativeSignals = signals.filter((s) => s.type === 'negative');

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-7">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 font-mono font-black text-xl text-emerald-400 flex items-center justify-center shadow-inner">
            {forecast.symbol}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {forecast.company_name}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {forecast.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {forecast.market} Market • {forecast.horizon} Trading Days Horizon • Active Model: {forecast.model_name} v{forecast.model_version}
            </p>
          </div>
        </div>

        {/* Primary CTA: Open Stock Analysis */}
        <button
          onClick={() => navigate(`/stocks?symbol=${encodeURIComponent(forecast.symbol)}`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer self-start sm:self-auto"
        >
          <span>Open Stock Analysis</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 font-mono text-xs">
        {/* Current Price */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 font-sans block">Current Price</span>
          <span className="text-lg font-bold text-white block mt-1">
            {forecast.current_price !== null && forecast.current_price !== undefined
              ? `₹${forecast.current_price.toFixed(2)}`
              : '---'}
          </span>
        </div>

        {/* Forecast Horizon */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 font-sans block">Forecast Horizon</span>
          <span className="text-lg font-bold text-teal-300 block mt-1">
            {forecast.horizon} Trading Day{forecast.horizon > 1 ? 's' : ''}
          </span>
        </div>

        {/* Predicted Price */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 font-sans block">Predicted Price</span>
          <span className={`text-lg font-bold block mt-1 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {forecast.predicted_price !== null && forecast.predicted_price !== undefined
              ? `₹${forecast.predicted_price.toFixed(2)}`
              : 'N/A'}
          </span>
        </div>

        {/* Expected Return */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 font-sans block">Expected Return</span>
          <span className={`text-lg font-bold block mt-1 flex items-center gap-1 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPos ? '+' : ''}
            {forecast.predicted_return !== null && forecast.predicted_return !== undefined
              ? `${(forecast.predicted_return * 100).toFixed(2)}%`
              : '---'}
          </span>
        </div>

        {/* Direction */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 font-sans block">Model Direction</span>
          <span
            className={`text-sm font-bold block mt-1.5 flex items-center gap-1.5 ${
              isBullish
                ? 'text-emerald-400'
                : isBearish
                  ? 'text-rose-400'
                  : 'text-slate-300'
            }`}
          >
            {isBullish ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : isBearish ? (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            ) : (
              <Minus className="w-4 h-4 text-slate-400" />
            )}
            <span>{forecast.direction}</span>
          </span>
        </div>

        {/* Historical Accuracy */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 font-sans block">Historical Accuracy</span>
          <span className="text-lg font-bold text-emerald-400 block mt-1">
            {forecast.historical_accuracy !== null && forecast.historical_accuracy !== undefined
              ? `${forecast.historical_accuracy.toFixed(1)}%`
              : 'N/A'}
          </span>
        </div>
      </div>

      {/* Model Confidence & Portfolio Context Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Confidence Note (Requirement 6: Non-fabrication guarantee) */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Info className="w-4 h-4 text-teal-400" />
            <span>Prediction Confidence & Reliability</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono font-bold text-slate-400">
              Confidence unavailable
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              (Pending Bayesian uncertainty estimation)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Confidence represents the model's estimated reliability for this forecast based on the available evaluation methodology. SmartFin does not convert historical accuracy directly into synthetic confidence scores.
          </p>
        </div>

        {/* User Portfolio Holding Context (Requirement 16) */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Briefcase className="w-4 h-4 text-purple-400" />
            <span>Your Portfolio Position</span>
          </div>
          {holding ? (
            <div className="space-y-1 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Shares Held:</span>
                <strong className="text-white">{holding.quantity} Units</strong>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Avg Buy Price:</span>
                <span className="text-slate-200">₹{holding.averageBuyPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Current Market Value:</span>
                <span className="text-emerald-400 font-bold">₹{holding.currentMarketValue.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans pt-1">
              You do not currently hold {forecast.symbol} in your active SmartFin investment portfolio.
            </p>
          )}
        </div>
      </div>

      {/* Forecast Signals Section (Requirement 7: Why the Model Predicts This) */}
      <div className="space-y-3.5 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Why the Model Predicts This (Forecast Signals)
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Zero lookahead feature contributions
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          These technical indicator signals and feature contributions reflect the quantitative state of {forecast.symbol} at inference time. They describe historical patterns and do not guarantee future price movements.
        </p>

        {signals.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-950 text-slate-500 text-xs font-mono text-center">
            No auxiliary feature signals extracted for this model version.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Positive Signals */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-sans">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Positive Signals ({positiveSignals.length})</span>
              </span>
              {positiveSignals.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-mono">No strong positive indicators</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {positiveSignals.map((sig, idx) => (
                    <li key={idx} className="bg-slate-950/80 p-2.5 rounded-xl border border-emerald-500/20 space-y-0.5">
                      <div className="flex items-center justify-between font-mono text-[10px] text-emerald-300 font-bold">
                        <span>{sig.name}</span>
                        {sig.value && <span>{sig.value}</span>}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{sig.label}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Neutral Signals */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-sans">
                <Minus className="w-3.5 h-3.5 text-slate-400" />
                <span>Neutral Signals ({neutralSignals.length})</span>
              </span>
              {neutralSignals.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-mono">No neutral indicators</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {neutralSignals.map((sig, idx) => (
                    <li key={idx} className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-0.5">
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 font-bold">
                        <span>{sig.name}</span>
                        {sig.value && <span>{sig.value}</span>}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{sig.label}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Negative Signals */}
            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2.5">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5 font-sans">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Negative Signals ({negativeSignals.length})</span>
              </span>
              {negativeSignals.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-mono">No strong negative indicators</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {negativeSignals.map((sig, idx) => (
                    <li key={idx} className="bg-slate-950/80 p-2.5 rounded-xl border border-rose-500/20 space-y-0.5">
                      <div className="flex items-center justify-between font-mono text-[10px] text-rose-300 font-bold">
                        <span>{sig.name}</span>
                        {sig.value && <span>{sig.value}</span>}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{sig.label}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Model Performance Overview Grid (Requirement 8) */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Historical Model Evaluation Performance
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Out-of-sample holdout test partition
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">Directional Accuracy</span>
            <span className="text-base font-bold text-emerald-400 block mt-1">
              {forecast.historical_accuracy !== null && forecast.historical_accuracy !== undefined
                ? `${forecast.historical_accuracy.toFixed(1)}%`
                : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">Mean Absolute Error (MAE)</span>
            <span className="text-base font-bold text-slate-200 block mt-1">
              {forecast.mae !== null && forecast.mae !== undefined ? forecast.mae.toFixed(4) : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">RMSE</span>
            <span className="text-base font-bold text-cyan-400 block mt-1">
              {forecast.rmse !== null && forecast.rmse !== undefined ? forecast.rmse.toFixed(4) : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">R² Score</span>
            <span className="text-base font-bold text-teal-300 block mt-1">
              {forecast.r2 !== null && forecast.r2 !== undefined ? forecast.r2.toFixed(3) : 'N/A'}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-normal font-sans">
          These metrics describe historical evaluation performance. They do not guarantee future prediction accuracy.
        </p>
      </div>
    </div>
  );
};

export default SelectedStockForecastView;
