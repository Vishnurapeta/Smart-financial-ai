import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Bell,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { MarketQuote } from '../../types/stock.ts';
import { ML_TRAINED_TICKERS } from './StockSearch.tsx';

interface StockHeaderProps {
  symbol: string;
  quote: MarketQuote | null;
  loading?: boolean;
  onRefresh?: () => void;
  onOpenAlertModal?: () => void;
  onAddToWatchlist?: () => void;
  onJumpToPrediction?: () => void;
  isPredictionActive?: boolean;
}

export const StockHeader: React.FC<StockHeaderProps> = ({
  symbol,
  quote,
  loading = false,
  onRefresh,
  onOpenAlertModal,
  onAddToWatchlist,
  onJumpToPrediction,
  isPredictionActive = false,
}) => {
  const isMLTrained = ML_TRAINED_TICKERS.some(
    (m) => m.symbol.toUpperCase() === symbol.toUpperCase(),
  );

  const price = quote?.currentPrice ?? 0;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;

  // Currency symbol heuristic
  const isIndianTicker =
    symbol.includes('.NS') ||
    symbol.includes('.BO') ||
    ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'ITC', 'LT', 'SBIN'].includes(
      symbol.toUpperCase(),
    );
  const currencySymbol = isIndianTicker ? '₹' : '$';

  // 52-week position calculation
  const week52Low = quote?.week52Low;
  const week52High = quote?.week52High;
  let week52Percent = 50;
  if (week52Low && week52High && week52High > week52Low && price > 0) {
    week52Percent = Math.min(
      100,
      Math.max(0, ((price - week52Low) / (week52High - week52Low)) * 100),
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Ticker Symbol & Name */}
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {symbol}
            </h1>
            {isMLTrained && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                AI Models Registered
              </span>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
              {quote?.provider || 'Live Market'}
            </span>
          </div>
          <p className="text-sm text-slate-300 font-medium">
            {quote?.name || `${symbol} Equity`}
          </p>
        </div>

        {/* Live Price & Change */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
            {price > 0
              ? `${currencySymbol}${price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : '---'}
          </div>

          {price > 0 && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-bold font-mono ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {isPositive ? '+' : ''}
                {currencySymbol}
                {Math.abs(change).toFixed(2)} ({isPositive ? '+' : ''}
                {changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onJumpToPrediction && (
            <button
              onClick={onJumpToPrediction}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg cursor-pointer ${
                isPredictionActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/20 font-extrabold'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Predictions</span>
            </button>
          )}

          {onOpenAlertModal && (
            <button
              onClick={onOpenAlertModal}
              title="Set Price Alert"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Alert</span>
            </button>
          )}

          {onAddToWatchlist && (
            <button
              onClick={onAddToWatchlist}
              title="Add to Watchlist"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-teal-400" />
              <span>Watchlist</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh Quote"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Market Stats Grid & 52-Week Range */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
          <span className="text-[10px] text-slate-400 block font-sans">Open</span>
          <span className="font-bold text-white text-sm">
            {quote?.open ? `${currencySymbol}${quote.open.toFixed(2)}` : '---'}
          </span>
        </div>

        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
          <span className="text-[10px] text-slate-400 block font-sans">Day Range</span>
          <span className="font-bold text-white text-sm">
            {quote?.low && quote?.high
              ? `${currencySymbol}${quote.low.toFixed(1)} - ${currencySymbol}${quote.high.toFixed(1)}`
              : '---'}
          </span>
        </div>

        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
          <span className="text-[10px] text-slate-400 block font-sans">Volume</span>
          <span className="font-bold text-cyan-400 text-sm">
            {quote?.volume
              ? quote.volume >= 1000000
                ? `${(quote.volume / 1000000).toFixed(2)}M`
                : `${(quote.volume / 1000).toFixed(1)}K`
              : '---'}
          </span>
        </div>

        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50 col-span-2 sm:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans mb-1">
            <span>52W Low: {week52Low ? `${currencySymbol}${week52Low.toFixed(1)}` : '---'}</span>
            <span>52W High: {week52High ? `${currencySymbol}${week52High.toFixed(1)}` : '---'}</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
              style={{ width: `${week52Percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockHeader;
