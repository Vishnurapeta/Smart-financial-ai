import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  ChevronDown,
  Check,
} from 'lucide-react';
import { MlService } from '../../services/ml.service.ts';
import { TransactionService } from '../../services/transaction.service.ts';
import { CategorizationResult } from '../../types/ml.ts';
import { Category, PaymentMethod, Transaction } from '../../types/transaction.ts';

interface NaturalLanguageTransactionBarProps {
  categories: Category[];
  onTransactionCreated: (transaction?: Transaction) => void;
}

const EXAMPLE_PROMPTS = [
  'Spent ₹750 at Swiggy',
  'I spent 800 on dinner at Zomato yesterday',
  'Uber ride to airport $42.50',
  'Monthly Netflix subscription ₹649',
  'Received freelance payment of $1200 today',
];

export const NaturalLanguageTransactionBar: React.FC<NaturalLanguageTransactionBarProps> = ({
  categories,
  onTransactionCreated,
}) => {
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<CategorizationResult | null>(null);

  // Editable parsed fields
  const [editAmount, setEditAmount] = useState<string>('');
  const [editCurrency, setEditCurrency] = useState<string>('INR');
  const [editMerchant, setEditMerchant] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editType, setEditType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('DEBIT_CARD');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Keep editCategoryId synchronized whenever categories load or change
  useEffect(() => {
    if (!categories || categories.length === 0) return;

    // If editCategoryId is already valid in categories, keep it
    if (editCategoryId && categories.some((c) => c._id === editCategoryId)) return;

    if (parsedData) {
      const predId = parsedData.categoryId || parsedData.category?.id;
      const predSlug = parsedData.categorySlug || parsedData.category?.slug;
      const predName = parsedData.predictedCategory || parsedData.category?.name;

      let matchedCat = categories.find((c) => predId && c._id === predId);
      if (!matchedCat && predSlug) {
        matchedCat = categories.find((c) => c.slug === predSlug);
      }
      if (!matchedCat && predName) {
        const predNameLower = predName.toLowerCase().trim();
        matchedCat = categories.find(
          (c) => typeof c.name === 'string' && c.name.toLowerCase().trim() === predNameLower,
        );
      }
      if (!matchedCat && predName) {
        const predNameLower = predName.toLowerCase().trim();
        matchedCat = categories.find(
          (c) =>
            typeof c.name === 'string' &&
            (c.name.toLowerCase().includes(predNameLower) || predNameLower.includes(c.name.toLowerCase())),
        );
      }
      if (!matchedCat && categories.length > 0) {
        const typeMatched = categories.find((c) => c.type === (parsedData.transactionType || editType));
        matchedCat = typeMatched || categories[0];
      }

      if (matchedCat) {
        setEditCategoryId(matchedCat._id);
      }
    } else if (!editCategoryId && categories.length > 0) {
      setEditCategoryId(categories[0]._id);
    }
  }, [categories, parsedData, editCategoryId, editType]);

  const handleParse = async (textToParse?: string) => {
    const rawInput = typeof textToParse === 'string' ? textToParse : inputText;
    const query = (rawInput || '').trim();
    if (!query) {
      setParseError('Please enter a transaction description to parse (e.g. "Monthly Netflix subscription ₹649").');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setSaveSuccess(false);

    try {
      const result = await MlService.categorize({
        text: query,
        dateContext: new Date().toISOString(),
      });
      if (!result) {
        throw new Error('Unable to parse this transaction. Please check the description and try again.');
      }
      setParsedData(result);

      // Populate editable fields
      setEditAmount(result.amount !== null && result.amount !== undefined ? String(result.amount) : '');
      setEditCurrency(result.currency || 'INR');
      setEditMerchant(result.merchant || '');
      setEditDate(result.date ? result.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setEditType(result.transactionType || 'EXPENSE');

      // Robust Category matching: match by ID, then slug, then name against categories list
      const predId = result.categoryId || result.category?.id;
      const predSlug = result.categorySlug || result.category?.slug;
      const predName = result.predictedCategory || result.category?.name;

      let matchedCat = categories.find((c) => predId && c._id === predId);
      if (!matchedCat && predSlug) {
        matchedCat = categories.find((c) => c.slug === predSlug);
      }
      if (!matchedCat && predName) {
        const predNameLower = predName.toLowerCase().trim();
        matchedCat = categories.find(
          (c) => typeof c.name === 'string' && c.name.toLowerCase().trim() === predNameLower,
        );
      }
      if (!matchedCat && predName) {
        const predNameLower = predName.toLowerCase().trim();
        matchedCat = categories.find(
          (c) =>
            typeof c.name === 'string' &&
            (c.name.toLowerCase().includes(predNameLower) || predNameLower.includes(c.name.toLowerCase())),
        );
      }
      if (!matchedCat && categories.length > 0) {
        const typeMatched = categories.find((c) => c.type === (result.transactionType || editType));
        matchedCat = typeMatched || categories[0];
      }

      if (matchedCat) {
        setEditCategoryId(matchedCat._id);
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const msg =
        rawMsg && !rawMsg.includes('Cannot read properties')
          ? rawMsg
          : 'Unable to parse this transaction. Please check the description and try again.';
      setParseError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!parsedData) return;

    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setParseError('Please specify a valid transaction amount greater than 0.');
      return;
    }

    if (!editMerchant.trim()) {
      setParseError('Merchant or description is required.');
      return;
    }

    let targetCategoryId = editCategoryId;
    if (!targetCategoryId || !categories.some((c) => c._id === targetCategoryId)) {
      if (categories.length > 0) {
        targetCategoryId = categories[0]._id;
        setEditCategoryId(targetCategoryId);
      } else {
        setParseError('No categories are currently loaded. Please try again.');
        return;
      }
    }

    setIsSaving(true);
    setParseError(null);

    try {
      const selectedCategoryObj = categories.find((c) => c._id === targetCategoryId);
      const categoryName = selectedCategoryObj
        ? selectedCategoryObj.name
        : typeof parsedData.predictedCategory === 'string'
          ? parsedData.predictedCategory
          : parsedData.category?.name || 'General';

      // Use current ISO timestamp if transaction is for today, so sorting by date desc places it at top
      const todayYMD = new Date().toISOString().split('T')[0];
      const transactionDateIso =
        editDate === todayYMD
          ? new Date().toISOString()
          : new Date(`${editDate}T12:00:00.000Z`).toISOString();

      // 1. Create Transaction in Database
      const newTx = await TransactionService.createTransaction({
        type: editType,
        amount: amountNum,
        currency: editCurrency,
        merchant: editMerchant.trim(),
        description: parsedData.rawText,
        category: targetCategoryId,
        subcategory: parsedData.predictedSubcategory || parsedData.subcategory || undefined,
        date: transactionDateIso,
        paymentMethod: editPaymentMethod,
        isRecurring: false,
        source: 'API',
        notes: `AI-parsed from: "${parsedData.rawText}" (${Math.round((parsedData.confidence ?? 0.8) * 100)}% conf)`,
        tags: ['ai-parsed', parsedData.source || 'ai'],
      });

      // 2. Submit ML Feedback for continuous model retraining (safely isolated)
      try {
        const predCatName =
          typeof parsedData.predictedCategory === 'string'
            ? parsedData.predictedCategory
            : typeof parsedData.category?.name === 'string'
              ? parsedData.category.name
              : '';
        const predCatLower = predCatName.toLowerCase().trim();
        const catNameLower = typeof categoryName === 'string' ? categoryName.toLowerCase().trim() : '';

        const wasCorrect =
          amountNum === parsedData.amount &&
          (predCatLower ? catNameLower.includes(predCatLower) || predCatLower.includes(catNameLower) : true) &&
          editType === parsedData.transactionType;

        const feedbackSlug =
          parsedData.categorySlug ||
          parsedData.category?.slug ||
          selectedCategoryObj?.slug ||
          'general';

        await MlService.submitFeedback({
          rawText: parsedData.rawText,
          predictedCategory: predCatName || categoryName,
          predictedCategorySlug: feedbackSlug,
          predictedSubcategory: parsedData.predictedSubcategory || parsedData.subcategory,
          predictedAmount: parsedData.amount,
          predictedMerchant: parsedData.merchant,
          confidence: typeof parsedData.confidence === 'number' ? parsedData.confidence : 0.8,
          finalCategory: categoryName,
          finalSubcategory: parsedData.predictedSubcategory || parsedData.subcategory,
          finalAmount: amountNum,
          finalMerchant: editMerchant.trim(),
          finalType: editType,
          transactionId: newTx._id,
          wasCorrect,
          notes: wasCorrect ? 'Accepted by user' : 'User adjusted parsed fields before confirmation',
        });
      } catch (feedbackErr) {
        console.warn('ML feedback submission skipped or failed:', feedbackErr);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setParsedData(null);
        setInputText('');
        setSaveSuccess(false);
      }, 1500);

      // Notify parent page immediately with the populated transaction
      onTransactionCreated(newTx);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const msg =
        rawMsg && !rawMsg.includes('Cannot read properties')
          ? rawMsg
          : 'Failed to record transaction. Please try again.';
      setParseError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismiss = () => {
    setParsedData(null);
    setParseError(null);
  };

  return (
    <div className="w-full bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 border border-indigo-500/20 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md transition-all">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              AI Smart Transaction Entry
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                FastAPI NLP + ML
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Type naturally in everyday language — SmartFin parses amount, merchant, category &
              date.
            </p>
          </div>
        </div>
      </div>

      {/* Main Input Bar */}
      <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isParsing) {
                e.preventDefault();
                handleParse();
              }
            }}
            placeholder='Type anything, e.g. "I spent 800 on dinner at Zomato yesterday" or "Spent ₹750 at Swiggy"'
            className="w-full pl-4 pr-10 py-3 bg-slate-900/90 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm text-slate-100 placeholder-slate-500 transition-all outline-none"
            disabled={isParsing}
          />
          {inputText && (
            <button
              onClick={() => setInputText('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => handleParse()}
          disabled={isParsing || !inputText.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {isParsing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Parse with AI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Quick Example Chips */}
      {!parsedData && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span className="text-[11px] font-semibold text-slate-400">Try quick prompt:</span>
          {EXAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(prompt);
                handleParse(prompt);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900/60 hover:bg-indigo-900/40 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/30 text-[11px] transition-all cursor-pointer"
            >
              &ldquo;{prompt}&rdquo;
            </button>
          ))}
        </div>
      )}

      {/* Parse Error Notification */}
      {parseError && (
        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{parseError}</span>
          </div>
          <button onClick={() => setParseError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Confirmation & Review Card */}
      {parsedData && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Header Status & Confidence Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Parsed Extraction:</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  parsedData.confidence >= 0.75
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {Math.round(parsedData.confidence * 100)}% Confidence (
                {parsedData.confidence >= 0.75 ? 'High' : 'Low'})
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                via {parsedData.source.replace('_', ' ')}
              </span>
            </div>

            <button
              onClick={handleDismiss}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>
          </div>

          {/* Low Confidence Safety Warning Banner */}
          {parsedData.requiresConfirmation && (
            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Confirmation Required: </span>
                {parsedData.explanation ||
                  'The ML model detected lower confidence or missing elements. Verify and adjust the details below before committing this record to your financial ledger.'}
              </div>
            </div>
          )}

          {/* Editable Field Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            {/* Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Type
              </label>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditType('EXPENSE')}
                  className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                    editType === 'EXPENSE'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setEditType('INCOME')}
                  className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                    editType === 'INCOME'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Income
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs font-bold text-white outline-none"
                />
              </div>
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Currency
              </label>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-white outline-none cursor-pointer"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            {/* Merchant */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Merchant / Payee
              </label>
              <input
                type="text"
                value={editMerchant}
                onChange={(e) => setEditMerchant(e.target.value)}
                placeholder="e.g. Swiggy, Zomato"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-white outline-none"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Category
              </label>
              <div className="relative">
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-white outline-none appearance-none pr-7 cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Date
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-white outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Payment Method & Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Payment Method:</span>
              <select
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 outline-none cursor-pointer"
              >
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer / UPI</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </select>

              {parsedData.predictedSubcategory && (
                <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                  Subcategory:{' '}
                  <strong className="text-slate-200">{parsedData.predictedSubcategory}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                id="confirm-ledger-btn"
                data-testid="confirm-ledger-btn"
                onClick={handleConfirmAndSave}
                disabled={isSaving || saveSuccess}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Transaction Added Successfully!</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Ledger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
