import React from 'react';
import { Transaction } from '../../types/transaction.ts';
import { History, ArrowRight, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface RecentTransactionsCardProps {
  transactions: Transaction[];
}

export const RecentTransactionsCard: React.FC<RecentTransactionsCardProps> = ({ transactions }) => {
  const { format: formatCurrency } = useCurrency();

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <History className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Recent Transactions</h2>
          </div>
          <Link
            to="/transactions"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            <span>Ledger</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-xs text-slate-400 mb-4">Latest ledger activity records</p>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
            No recent transactions
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn) => {
              const isIncome = txn.type === 'INCOME';
              return (
                <div
                  key={txn._id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownRight className="w-3.5 h-3.5 rotate-180" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[160px]">
                        {txn.merchant || txn.description}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{formatDate(txn.date)}</span>
                        <span>•</span>
                        <span className="truncate max-w-[90px]">
                          {typeof txn.category === 'object' && txn.category !== null
                            ? txn.category.name
                            : 'General'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-bold font-mono ${
                        isIncome ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(txn.amount)}
                    </div>
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                      {txn.paymentMethod || 'OTHER'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
