import React, { useState, useEffect } from 'react';
import { X, Target, Bell, AlertCircle } from 'lucide-react';
import { Category } from '../../types/transaction.ts';
import { CreateBudgetDTO } from '../../types/budget.ts';
import { TransactionService } from '../../services/transaction.service.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface CreateBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBudgetDTO) => Promise<void>;
  defaultMonth: string;
  existingCategoryIds: string[];
}

export const CreateBudgetModal: React.FC<CreateBudgetModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultMonth,
  existingCategoryIds,
}) => {
  const { currency: userCurrency, availableCurrencies } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(userCurrency || 'USD');
  const [month, setMonth] = useState(defaultMonth);
  const [notifyAt80, setNotifyAt80] = useState(true);
  const [notifyAt100, setNotifyAt100] = useState(true);
  const [rolloverRemaining, setRolloverRemaining] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMonth(defaultMonth);
      setCurrency(userCurrency || 'USD');
      setError(null);
      // Fetch categories
      TransactionService.getCategories()
        .then((cats) => {
          // Filter to expense categories
          const expenseCats = cats.filter((c) => c.type === 'EXPENSE');
          setCategories(expenseCats);
          // Set first available category that is not already budgeted
          const available = expenseCats.find((c) => !existingCategoryIds.includes(c._id));
          if (available) {
            setCategoryId(available._id);
            setName(`${available.name} Budget`);
          } else if (expenseCats.length > 0) {
            setCategoryId(expenseCats[0]._id);
            setName(`${expenseCats[0].name} Budget`);
          }
        })
        .catch(() => setError('Failed to load categories'));
    }
  }, [isOpen, defaultMonth, existingCategoryIds]);

  const handleCategoryChange = (id: string) => {
    setCategoryId(id);
    const selected = categories.find((c) => c._id === id);
    if (selected) {
      setName(`${selected.name} Budget`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive budget amount');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        categoryId,
        name: name.trim() || undefined,
        amount: parsedAmount,
        month,
        currency,
        notifyAt80,
        notifyAt100,
        rolloverRemaining,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create budget';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Monthly Category Budget</h2>
              <p className="text-xs text-slate-400">
                Set spending limit and automated notifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              required
            >
              {categories.map((cat) => {
                const isAlreadyBudgeted = existingCategoryIds.includes(cat._id);
                return (
                  <option key={cat._id} value={cat._id} disabled={isAlreadyBudgeted}>
                    {cat.name} {isAlreadyBudgeted ? '(Already Budgeted)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Budget Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Budget Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Grocery Limit"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Budget Limit Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="8000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono font-bold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Month Target */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Month (YYYY-MM)</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Notification Thresholds */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Bell className="w-3.5 h-3.5 text-emerald-400" />
              <span>Smart Notification Triggers</span>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAt80}
                onChange={(e) => setNotifyAt80(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4"
              />
              <span>Trigger warning notification when 80% of budget is reached</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAt100}
                onChange={(e) => setNotifyAt100(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4"
              />
              <span>Trigger critical overspending alert when 100% of budget is exceeded</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-400 cursor-pointer pt-1 border-t border-slate-800/80">
              <input
                type="checkbox"
                checked={rolloverRemaining}
                onChange={(e) => setRolloverRemaining(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4"
              />
              <span>Rollover unspent surplus to next month</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
