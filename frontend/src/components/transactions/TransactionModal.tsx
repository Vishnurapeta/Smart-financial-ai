import React, { useState, useEffect } from 'react';
import {
  Category,
  CreateTransactionDTO,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../../types/transaction.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import { getCurrencySymbol } from '../../utils/format.ts';
import {
  X,
  PlusCircle,
  Pencil,
  AlertCircle,
  Loader2,
  Calendar,
  Tag,
  FileText,
  CreditCard,
  Building,
} from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTransactionDTO) => Promise<void>;
  categories: Category[];
  initialTransaction?: Transaction | null;
  defaultType?: TransactionType;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  initialTransaction,
  defaultType = 'EXPENSE',
}) => {
  const isEditing = !!initialTransaction;
  const { currency: userCurrency, availableCurrencies } = useCurrency();

  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DEBIT_CARD');
  const [currency, setCurrency] = useState<string>(userCurrency || 'USD');
  const [notes, setNotes] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when editing or opening
  useEffect(() => {
    if (initialTransaction) {
      setType(initialTransaction.type);
      setAmount(initialTransaction.amount.toString());
      setMerchant(initialTransaction.merchant);
      setDescription(initialTransaction.description || '');
      setCategoryId(initialTransaction.category?._id || '');
      setSubcategory(initialTransaction.subcategory || '');
      setDate(
        initialTransaction.date
          ? new Date(initialTransaction.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      );
      setPaymentMethod(initialTransaction.paymentMethod || 'DEBIT_CARD');
      setCurrency(initialTransaction.currency || 'USD');
      setNotes(initialTransaction.notes || '');
      setTagsInput(initialTransaction.tags ? initialTransaction.tags.join(', ') : '');
      setIsRecurring(initialTransaction.isRecurring || false);
    } else {
      setType(defaultType);
      setAmount('');
      setMerchant('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setTagsInput('');
      setIsRecurring(false);
      setCurrency(userCurrency || 'USD');
      // Auto-select first matching category
      const matched = categories.find((c) => c.type === defaultType);
      if (matched) setCategoryId(matched._id);
    }
    setError(null);
  }, [initialTransaction, defaultType, categories, isOpen, userCurrency]);

  // When type changes, adjust selected category if needed
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const matched = categories.find((c) => c.type === newType);
    if (matched) {
      setCategoryId(matched._id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please provide a valid amount greater than zero');
      return;
    }

    if (!merchant.trim()) {
      setError('Merchant or transaction title is required');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);

    setIsSubmitting(true);
    try {
      await onSubmit({
        amount: parsedAmount,
        type,
        merchant: merchant.trim(),
        description: description.trim(),
        category: categoryId,
        subcategory: subcategory.trim() || undefined,
        date: new Date(date).toISOString(),
        paymentMethod,
        currency,
        notes: notes.trim(),
        tags,
        isRecurring,
        recurring: isRecurring,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                type === 'INCOME'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {isEditing ? <Pencil className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing
                  ? 'Edit Transaction Record'
                  : type === 'INCOME'
                    ? 'Record Inflow / Income'
                    : 'Record Outflow / Expense'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? 'Update transaction parameters and financial classifications'
                  : 'Add a new ledger record with strict double-entry validation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Income vs Expense Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('INCOME')}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                type === 'INCOME'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              + Income Record
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('EXPENSE')}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                type === 'EXPENSE'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              - Expense Record
            </button>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Transaction Amount *
              </label>
              <div className="relative">
                <span className="text-sm font-semibold text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none select-none">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Merchant / Payee */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              Merchant / Counterparty *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Amazon, Employer Payroll, Apple Store"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category & Subcategory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Category *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Select Category</option>
                {filteredCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Subcategory (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Software, Groceries, Dining"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer / ACH</option>
                <option value="CASH">Cash</option>
                <option value="CRYPTO">Crypto</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Description & Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Description & Notes
            </label>
            <textarea
              rows={2}
              placeholder="Brief description or additional reconciliation notes..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (!description) setDescription(e.target.value);
              }}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Tags & Recurring */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Tags (Comma-Separated)
              </label>
              <input
                type="text"
                placeholder="tech, travel, dining"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 w-full select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20"
                />
                <span>Recurring Transaction</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl text-slate-950 text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                type === 'INCOME'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-rose-500 to-pink-400 hover:from-rose-400 hover:to-pink-300 shadow-rose-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : type === 'INCOME' ? (
                'Save Income'
              ) : (
                'Save Expense'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
