import React from 'react';
import { Calendar } from 'lucide-react';
import { HorizonCoverageItem } from '../../../types/stockPrediction.ts';

interface HorizonCoverageCardsProps {
  horizonCoverage: HorizonCoverageItem[];
  loading: boolean;
}

export const HorizonCoverageCards: React.FC<HorizonCoverageCardsProps> = ({
  horizonCoverage,
  loading,
}) => {
  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-4">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-400" />
          <span>Prediction Horizon Coverage & Multi-Day Analytics</span>
        </h2>
        <p className="text-xs text-slate-400">
          Independent quantitative forecasting models engineered per session duration (1D, 5D, 20D)
        </p>
      </div>

      {/* Grid of Horizon Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-64 rounded-2xl bg-slate-950/60 border border-slate-800 animate-pulse p-5"
            />
          ))
        ) : (
          horizonCoverage.map((item) => {
            const latest = item.latest_prediction;
            const predReturn = typeof latest?.predicted_return === 'number' ? latest.predicted_return : null;
            const isPos = predReturn !== null ? predReturn >= 0 : true;

            return (
              <div
                key={item.horizon}
                className="rounded-2xl bg-slate-950/70 border border-slate-800/80 p-5 sm:p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition space-y-5"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 block">
                      {item.horizon} Day{item.horizon > 1 ? 's' : ''} Forecast
                    </span>
                    <h3 className="text-base font-extrabold text-white mt-0.5">{item.label}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs border border-emerald-500/20">
                    {item.horizon}D
                  </div>
                </div>

                {/* KPI Metrics List */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Registered Models</span>
                    <span className="text-base font-bold text-white block mt-0.5">
                      {item.models_count}
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Supported Stocks</span>
                    <span className="text-base font-bold text-teal-300 block mt-0.5">
                      {item.stocks_supported} Stocks
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Avg Direction Acc</span>
                    <span className="text-base font-bold text-emerald-400 block mt-0.5">
                      {item.avg_directional_accuracy ? `${item.avg_directional_accuracy.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-sans block">Avg RMSE</span>
                    <span className="text-base font-bold text-cyan-400 block mt-0.5">
                      {item.avg_rmse ? item.avg_rmse.toFixed(4) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Latest Inference Meta */}
                <div className="pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-slate-500">Latest Active Inference:</span>
                    {latest?.symbol ? (
                      <span className="font-bold text-white">
                        {latest.symbol} ({latest.model_name || 'Model'})
                      </span>
                    ) : (
                      <span className="text-slate-500">Ready</span>
                    )}
                  </div>
                  {latest && predReturn !== null && (
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span>Holdout Forecast:</span>
                      <span className={isPos ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {isPos ? '+' : ''}
                        {(predReturn * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HorizonCoverageCards;
