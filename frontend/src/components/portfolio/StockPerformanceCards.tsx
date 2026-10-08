import React from 'react';
import { HoldingDto } from '../../types/portfolio.ts';
import { TrendingUp, TrendingDown, Award, AlertCircle } from 'lucide-react';

interface StockPerformanceCardsProps {
  bestPerformer: HoldingDto | null;
  worstPerformer: HoldingDto | null;
  currencySymbol?: string;
}

export const StockPerformanceCards: React.FC<StockPerformanceCardsProps> = ({
  bestPerformer,
  worstPerformer,
  currencySymbol = '$',
}) => {
  if (!bestPerformer && !worstPerformer) {
    return null;
  }

  const renderCard = (holding: HoldingDto | null, type: 'best' | 'worst') => {
    if (!holding) {
      return (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-center text-slate-500 text-xs">
          No comparison available
        </div>
      );
    }

    const isBest = type === 'best';
    const isGain = holding.returnPercentage >= 0;

    return (
      <div
        className={`bg-slate-900/80 border ${
          isBest ? 'border-emerald-500/30' : 'border-rose-500/30'
        } rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden backdrop-blur-sm`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isBest ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {isBest ? <Award className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <div>
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isBest ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isBest ? 'Top Performer' : 'Lagging Position'}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
              isGain
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isGain ? '+' : ''}
            {holding.returnPercentage.toFixed(2)}%
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <h4 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {holding.symbol}
              <span className="text-xs font-normal text-slate-400 truncate max-w-[120px]">
                {holding.name}
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Price:{' '}
              <span className="text-slate-200 font-semibold">
                {currencySymbol}
                {holding.currentPrice.toFixed(2)}
              </span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-400">Unrealized P&amp;L</p>
            <p className={`text-base font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isGain ? '+' : ''}
              {currencySymbol}
              {holding.unrealizedPnL.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Qty: <strong className="text-slate-200">{holding.quantity}</strong> @ avg{' '}
            <strong className="text-slate-200">
              {currencySymbol}
              {holding.averageBuyPrice.toFixed(2)}
            </strong>
          </span>
          <span>
            Weight:{' '}
            <strong className="text-slate-200">{holding.allocationPercentage.toFixed(1)}%</strong>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderCard(bestPerformer, 'best')}
      {renderCard(worstPerformer, 'worst')}
    </div>
  );
};
