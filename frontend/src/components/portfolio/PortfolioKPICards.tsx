import React from 'react';
import { PortfolioSummary } from '../../types/portfolio.ts';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Briefcase, Percent } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface PortfolioKPICardsProps {
  summary: PortfolioSummary;
}

export const PortfolioKPICards: React.FC<PortfolioKPICardsProps> = ({ summary }) => {
  const isProfitable = summary.totalUnrealizedPnL >= 0;
  const { currency: userCurrency, format } = useCurrency();
  const activeCurrency = summary.baseCurrency || userCurrency;

  const formatCurrency = (val: number) => {
    return format(val, { currency: activeCurrency });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Invested */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <DollarSign className="w-12 h-12 text-slate-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Invested Capital
        </p>
        <h3 className="text-2xl font-bold text-white mt-1">
          {formatCurrency(summary.totalInvested)}
        </h3>
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Across {summary.holdingsCount} active position{summary.holdingsCount === 1 ? '' : 's'}
          </span>
        </p>
      </div>

      {/* Current Market Value */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <TrendingUp className="w-12 h-12 text-cyan-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Market Value
        </p>
        <h3 className="text-2xl font-bold text-cyan-400 mt-1">
          {formatCurrency(summary.currentValue)}
        </h3>
        <p className="text-xs text-slate-500 mt-2">Marked to live market quotes</p>
      </div>

      {/* Total Unrealized P&L */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          {isProfitable ? (
            <TrendingUp className="w-12 h-12 text-emerald-400" />
          ) : (
            <TrendingDown className="w-12 h-12 text-rose-400" />
          )}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Unrealized P&amp;L
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <h3
            className={`text-2xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {isProfitable ? '+' : ''}
            {formatCurrency(summary.totalUnrealizedPnL)}
          </h3>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
              isProfitable
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isProfitable ? '+' : ''}
            {summary.returnPercentage.toFixed(2)}%
          </span>
          <span className="text-[11px] text-slate-400">all-time return</span>
        </div>
      </div>

      {/* Cash Reserves */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Wallet className="w-12 h-12 text-amber-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Cash Reserves
        </p>
        <h3 className="text-2xl font-bold text-amber-300 mt-1">
          {formatCurrency(summary.cashBalance)}
        </h3>
        <p className="text-xs text-slate-500 mt-2">Available liquidity / unallocated</p>
      </div>

      {/* Total Net Value (Portfolio + Cash) */}
      <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all">
        <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
          <Percent className="w-12 h-12 text-emerald-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Total Net Value
        </p>
        <h3 className="text-2xl font-bold text-white mt-1">
          {formatCurrency(summary.totalNetValue)}
        </h3>
        <p className="text-xs text-emerald-300/70 mt-2">
          Holdings ({formatCurrency(summary.currentValue)}) + Cash
        </p>
      </div>
    </div>
  );
};
