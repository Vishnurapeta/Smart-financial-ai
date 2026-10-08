import React, { useState, useEffect } from 'react';
import { X, Calendar, Tag, ExternalLink } from 'lucide-react';
import {
  CreateSubscriptionDTO,
  Subscription,
  SubscriptionBillingCycle,
  SubscriptionStatus,
} from '../../types/recurring.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import { getCurrencySymbol } from '../../utils/format.ts';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateSubscriptionDTO) => Promise<void>;
  initialSubscription?: Subscription | null;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialSubscription,
}) => {
  const { currency: userCurrency, availableCurrencies } = useCurrency();
  const [name, setName] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(userCurrency || 'USD');
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>('MONTHLY');
  const [status, setStatus] = useState<SubscriptionStatus>('ACTIVE');
  const [renewalDate, setRenewalDate] = useState(new Date().toISOString().split('T')[0]);
  const [planTier, setPlanTier] = useState('');
  const [cancellationUrl, setCancellationUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSubscription) {
      setName(initialSubscription.name);
      setMerchant(initialSubscription.merchant);
      setAmount(String(initialSubscription.amount));
      setCurrency(initialSubscription.currency || userCurrency || 'USD');
      setBillingCycle(initialSubscription.billingCycle);
      setStatus(initialSubscription.status);
      setRenewalDate(
        initialSubscription.renewalDate
          ? new Date(initialSubscription.renewalDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      );
      setPlanTier(initialSubscription.planTier || '');
      setCancellationUrl(initialSubscription.cancellationUrl || '');
    } else {
      setName('');
      setMerchant('');
      setAmount('');
      setCurrency(userCurrency || 'USD');
      setBillingCycle('MONTHLY');
      setStatus('ACTIVE');
      setRenewalDate(new Date().toISOString().split('T')[0]);
      setPlanTier('');
      setCancellationUrl('');
    }
    setError(null);
  }, [initialSubscription, isOpen, userCurrency]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!name.trim()) {
      setError('Subscription name is required');
      return;
    }
    if (!merchant.trim()) {
      setError('Merchant is required');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        merchant: merchant.trim(),
        amount: numAmount,
        currency,
        billingCycle,
        status,
        renewalDate: new Date(renewalDate).toISOString(),
        planTier: planTier.trim() || undefined,
        cancellationUrl: cancellationUrl.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save subscription';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">
              {initialSubscription ? 'Edit Subscription' : 'Add Subscription'}
            </h3>
            <p className="text-xs text-slate-400">
              Track renewals, price increases, and billing cycles.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Subscription Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Netflix, Spotify"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Merchant / Provider *
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Netflix Inc"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Amount *</label>
              <div className="relative">
                <span className="text-xs font-semibold text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none select-none">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none cursor-pointer"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Billing Cycle
              </label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as SubscriptionBillingCycle)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none cursor-pointer"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Bi-weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="SEMI_ANNUALLY">Semi-annually (6 Mos)</option>
                <option value="ANNUALLY">Annually (Yearly)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Next Renewal Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none cursor-pointer"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none cursor-pointer"
              >
                <option value="ACTIVE">Active</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="DUE_SOON">Due Soon</option>
                <option value="DUE_TODAY">Due Today</option>
                <option value="OVERDUE">Overdue</option>
                <option value="PAID">Paid</option>
                <option value="PAUSED">Paused</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="POSSIBLY_INACTIVE">Possibly Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Plan Tier (Optional)
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={planTier}
                  onChange={(e) => setPlanTier(e.target.value)}
                  placeholder="e.g. Premium 4K, Duo, Pro"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cancellation Link (Optional)
              </label>
              <div className="relative">
                <ExternalLink className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={cancellationUrl}
                  onChange={(e) => setCancellationUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting
                ? 'Saving...'
                : initialSubscription
                  ? 'Save Changes'
                  : 'Create Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
