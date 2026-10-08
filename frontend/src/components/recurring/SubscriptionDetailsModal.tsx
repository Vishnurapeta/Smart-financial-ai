import React, { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  TrendingUp,
  Clock,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  History,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { Subscription, MatchedTransaction } from '../../types/recurring.ts';
import { RecurringService } from '../../services/recurring.service.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface SubscriptionDetailsModalProps {
  subscription: Subscription | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (subscription: Subscription) => void;
}

export const SubscriptionDetailsModal: React.FC<SubscriptionDetailsModalProps> = ({
  subscription,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { format } = useCurrency();
  const [history, setHistory] = useState<MatchedTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (subscription && isOpen) {
      setLoadingHistory(true);
      RecurringService.getSubscriptionHistory(subscription._id)
        .then((res) => {
          setHistory(res.transactions || []);
        })
        .catch((err) => {
          console.error('Failed to load subscription history:', err);
          setHistory([]);
        })
        .finally(() => {
          setLoadingHistory(false);
        });
    } else {
      setHistory([]);
    }
  }, [subscription, isOpen]);

  if (!isOpen || !subscription) return null;

  const cycleLabel =
    subscription.billingCycle === 'ANNUALLY'
      ? 'Year'
      : subscription.billingCycle === 'SEMI_ANNUALLY'
        ? '6 Months'
        : subscription.billingCycle === 'QUARTERLY'
          ? 'Quarter'
          : subscription.billingCycle === 'BIWEEKLY'
            ? '2 Weeks'
            : subscription.billingCycle === 'WEEKLY'
              ? 'Week'
              : 'Month';

  const statusBadge = () => {
    switch (subscription.status) {
      case 'PAID':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'DUE_TODAY':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'DUE_SOON':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
      case 'OVERDUE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'POSSIBLY_INACTIVE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'CANCELLED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'PAUSED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  const confidenceBadge = () => {
    const level = subscription.confidenceLevel || 'HIGH';
    if (level === 'HIGH') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (level === 'MEDIUM') {
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    }
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">{subscription.name}</h2>
              <span
                className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${statusBadge()}`}
              >
                {subscription.status.replace('_', ' ')}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${confidenceBadge()}`}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {subscription.confidenceLevel || 'HIGH'} Confidence
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Merchant: <span className="text-slate-200 font-semibold">{subscription.merchant}</span>
              {subscription.planTier && (
                <> • Tier: <span className="text-slate-200">{subscription.planTier}</span></>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(subscription);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Edit Subscription"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
              <span className="text-[11px] font-medium text-slate-400">Recurring Amount</span>
              <div className="text-lg font-black text-white mt-1">
                {format(subscription.amount, { currency: subscription.currency })}
                <span className="text-[11px] text-slate-400 font-normal"> /{cycleLabel.toLowerCase()}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
              <span className="text-[11px] font-medium text-slate-400">Billing Cycle</span>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>{subscription.billingCycle}</span>
              </div>
              <span className="text-[10px] text-slate-500">
                ~{subscription.averageIntervalDays || 30} days cadence
              </span>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
              <span className="text-[11px] font-medium text-slate-400">Next Expected Due</span>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{new Date(subscription.renewalDate).toLocaleDateString()}</span>
              </div>
              <span className="text-[10px] text-slate-500">Auto-calculated</span>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
              <span className="text-[11px] font-medium text-slate-400">Annualized Cost</span>
              <div className="text-sm font-black text-white mt-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  {format(subscription.estimatedAnnualCost || subscription.amount * 12, {
                    currency: subscription.currency,
                  })}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">12-month run rate</span>
            </div>
          </div>

          {/* Inactivity Warning Alert */}
          {subscription.isPossiblyInactive && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-200">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">Transaction Inactivity Alert</div>
                <p className="text-amber-300/90 leading-relaxed text-[11px]">
                  {subscription.inactivityEvidence ||
                    'Expected payment date elapsed without a matching transaction. The service may be cancelled, paused, or billed through a different channel.'}
                </p>
              </div>
            </div>
          )}

          {/* Price Change Spike Alert */}
          {subscription.priceChangeAlert && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                Recent charge differed from earlier recurring amount. Review price change history below.
              </span>
            </div>
          )}

          {/* Authentic Payment History from Ledger */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Payment History ({history.length} Transactions from Ledger)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Source: Transactions Ledger</span>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Fetching ledger payment history...
              </div>
            ) : history.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-950/50 border border-slate-800 text-xs text-slate-500">
                No matched transactions found in ledger yet.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Description / Note</th>
                      <th className="py-2.5 px-4">Payment Method</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {history.map((tx) => (
                      <tr key={tx._id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-white">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400">
                          {tx.description || tx.merchant || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-medium">
                            {tx.paymentMethod || 'AUTO'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-white">
                          {format(tx.amount, { currency: tx.currency || subscription.currency })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cancellation / Management link */}
          {subscription.cancellationUrl && (
            <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
              <span>Merchant portal:</span>
              <a
                href={subscription.cancellationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <span>Manage or Cancel Subscription</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
