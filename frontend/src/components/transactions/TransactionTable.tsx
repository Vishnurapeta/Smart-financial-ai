import React from 'react';
import { Link } from 'react-router-dom';
import { Transaction } from '../../types/transaction.ts';
import { FinancialAnomaly } from '../../types/anomaly.ts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  CreditCard,
  Tag,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
  onViewDetails: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  deletingId?: string | null;
  anomaliesMap?: Map<string, FinancialAnomaly>;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  isLoading,
  onViewDetails,
  onEdit,
  onDelete,
  deletingId,
  anomaliesMap,
}) => {
  const { format } = useCurrency();
  const formatCurrency = (amount: number, _currency?: string) => {
    return format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between animate-pulse py-3 border-b border-slate-800/60 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800" />
              <div className="space-y-2">
                <div className="h-4 w-36 bg-slate-800 rounded" />
                <div className="h-3 w-24 bg-slate-800/60 rounded" />
              </div>
            </div>
            <div className="h-5 w-20 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
        <div className="w-12 h-12 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto text-slate-500 border border-slate-700/60">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">No Transactions Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No records match your active search filters or date range. Adjust your criteria or record
          a new transaction above.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold select-none">
            <tr>
              <th className="py-3.5 px-4">Transaction / Merchant</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4 hidden md:table-cell">Date</th>
              <th className="py-3.5 px-4 hidden sm:table-cell">Method</th>
              <th className="py-3.5 px-4 text-right">Amount</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const isExpense = tx.type === 'EXPENSE';

              const anomaly = anomaliesMap?.get(tx._id);

              return (
                <tr
                  key={tx._id}
                  className={`hover:bg-slate-800/40 transition-colors group ${
                    anomaly ? 'bg-amber-950/15 border-l-2 border-l-amber-500' : ''
                  }`}
                >
                  {/* Merchant & Description */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isExpense
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-[220px]">
                            {tx.merchant}
                          </span>
                          {anomaly && (
                            <Link
                              to="/anomalies"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              title={`Unusual Spending (${anomaly.severity} Unusualness): ${anomaly.reason}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Unusual
                            </Link>
                          )}
                          {tx.isRecurring && (
                            <span
                              title="Recurring"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-teal-400 border border-teal-500/30"
                            >
                              <Repeat className="w-2.5 h-2.5" /> Rec
                            </span>
                          )}
                        </div>
                        {tx.description && (
                          <p className="text-xs text-slate-400 truncate max-w-[160px] sm:max-w-[260px]">
                            {tx.description}
                          </p>
                        )}
                        {tx.tags && tx.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tx.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800"
                              >
                                <Tag className="w-2.5 h-2.5 text-slate-500" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{
                        backgroundColor: tx.category?.color
                          ? `${tx.category.color}15`
                          : '#10b98115',
                        color: tx.category?.color || '#10b981',
                        border: `1px solid ${tx.category?.color ? `${tx.category.color}30` : '#10b98130'}`,
                      }}
                    >
                      {tx.category?.name || 'General'}
                    </span>
                    {tx.subcategory && (
                      <span className="text-[11px] text-slate-500 block mt-0.5 font-mono">
                        {tx.subcategory}
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDate(tx.date)}</span>
                    </div>
                  </td>

                  {/* Payment Method */}
                  <td className="py-3.5 px-4 whitespace-nowrap hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-2 py-1 rounded-md bg-slate-950 border border-slate-800/80">
                      <CreditCard className="w-3 h-3 text-slate-500" />
                      {tx.paymentMethod ? tx.paymentMethod.replace(/_/g, ' ') : 'Debit'}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span
                      className={`text-sm sm:text-base font-bold tracking-tight ${
                        isIncome ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {tx.currency || 'USD'}
                    </span>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => onViewDetails(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Transaction"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(tx._id)}
                        disabled={deletingId === tx._id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete Transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
