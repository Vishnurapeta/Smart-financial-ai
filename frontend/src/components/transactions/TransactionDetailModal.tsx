import React from 'react';
import { Transaction } from '../../types/transaction.ts';
import {
  X,
  Calendar,
  CreditCard,
  Building,
  Tag,
  Repeat,
  Shield,
  Clock,
  Pencil,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { format } = useCurrency();
  if (!isOpen || !transaction) return null;

  const isIncome = transaction.type === 'INCOME';

  const formatCurrency = (amount: number, _currency?: string) => {
    return format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isIncome
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {isIncome ? (
                <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Transaction Details</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {transaction._id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount & Merchant Hero */}
        <div className="text-center p-6 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            {isIncome ? 'Total Inflow' : 'Total Outflow'}
          </span>
          <p
            className={`text-3xl sm:text-4xl font-black tracking-tight ${
              isIncome ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isIncome ? '+' : '-'}
            {formatCurrency(transaction.amount, transaction.currency)}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-sm font-semibold text-white">{transaction.merchant}</span>
            <span
              className="text-xs px-2 py-0.5 rounded font-semibold"
              style={{
                backgroundColor: transaction.category?.color
                  ? `${transaction.category.color}20`
                  : '#10b98120',
                color: transaction.category?.color || '#10b981',
              }}
            >
              {transaction.category?.name || 'Uncategorized'}
            </span>
          </div>
        </div>

        {/* Key Attributes Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date
            </span>
            <p className="font-semibold text-slate-200">
              {new Date(transaction.date).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Method
            </span>
            <p className="font-semibold text-slate-200">
              {transaction.paymentMethod?.replace(/_/g, ' ') || 'Debit Card'}
            </p>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" /> Source
            </span>
            <p className="font-semibold text-slate-200">{transaction.source || 'MANUAL'}</p>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5 text-slate-400" /> Recurring
            </span>
            <p className="font-semibold text-slate-200">
              {transaction.isRecurring ? 'Yes (Subscription / Scheduled)' : 'No (One-Time)'}
            </p>
          </div>
        </div>

        {/* Description & Notes */}
        {(transaction.description || transaction.notes) && (
          <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-2 text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Description & Notes
            </span>
            {transaction.description && <p className="text-slate-300">{transaction.description}</p>}
            {transaction.notes && transaction.notes !== transaction.description && (
              <p className="text-slate-400 italic">{transaction.notes}</p>
            )}
          </div>
        )}

        {/* Tags */}
        {transaction.tags && transaction.tags.length > 0 && (
          <div className="space-y-1.5 text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" /> Tags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {transaction.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata & Audit Footprint */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 space-y-1 font-mono">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" /> Ownership Verified
            </span>
            <span>User ID: {transaction.userId?.slice(-6) || 'Owner'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" /> Created
            </span>
            <span>{new Date(transaction.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => {
              onClose();
              onEdit(transaction);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Transaction
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
