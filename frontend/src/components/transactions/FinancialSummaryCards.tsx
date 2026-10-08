import { FinancialSummary } from '../../types/transaction.ts';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface FinancialSummaryCardsProps {
  summary: FinancialSummary | null;
  currency?: string;
  isLoading?: boolean;
}

export const FinancialSummaryCards: React.FC<FinancialSummaryCardsProps> = ({
  summary,
  currency: propCurrency,
  isLoading = false,
}) => {
  const { currency: userCurrency, format } = useCurrency();
  const activeCurrency = propCurrency || userCurrency;

  const formatCurrency = (val?: number) => {
    return format(val ?? 0, { currency: activeCurrency });
  };

  const isNetPositive = (summary?.netCashFlow ?? 0) >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total Income */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Income
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {isLoading ? (
            <div className="h-7 w-28 bg-slate-800 animate-pulse rounded" />
          ) : (
            <p className="text-2xl font-black text-emerald-400 tracking-tight">
              {formatCurrency(summary?.totalIncome)}
            </p>
          )}
          <span className="text-[11px] text-slate-500 mt-1 block">
            Calculated by backend financial engine
          </span>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Expenses
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {isLoading ? (
            <div className="h-7 w-28 bg-slate-800 animate-pulse rounded" />
          ) : (
            <p className="text-2xl font-black text-rose-400 tracking-tight">
              {formatCurrency(summary?.totalExpense)}
            </p>
          )}
          <span className="text-[11px] text-slate-500 mt-1 block">
            Outflow across active filtered set
          </span>
        </div>
      </div>

      {/* Net Cash Flow */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-teal-500/30 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Net Cash Flow
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {summary?.transactionCount ?? 0} txns
            </span>
          </div>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isNetPositive
                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {isNetPositive ? <DollarSign className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          </div>
        </div>
        <div className="mt-3">
          {isLoading ? (
            <div className="h-7 w-28 bg-slate-800 animate-pulse rounded" />
          ) : (
            <p
              className={`text-2xl font-black tracking-tight ${
                isNetPositive ? 'text-teal-300' : 'text-amber-400'
              }`}
            >
              {formatCurrency(summary?.netCashFlow)}
            </p>
          )}
          <span className="text-[11px] text-slate-500 mt-1 block">
            {isNetPositive ? 'Surplus retained in period' : 'Net deficit in period'}
          </span>
        </div>
      </div>
    </div>
  );
};
