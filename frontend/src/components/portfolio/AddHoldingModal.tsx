import React, { useState, useEffect, useCallback } from 'react';
import { AddHoldingPayload } from '../../types/portfolio.ts';
import { StockService } from '../../services/stock.service.ts';
import { X, Plus, Loader2, Search, AlertCircle, HelpCircle } from 'lucide-react';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AddHoldingPayload) => Promise<void>;
  initialSymbol?: string;
  currencySymbol?: string;
}

const SECTOR_OPTIONS = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Industrials',
  'Utilities',
  'Real Estate',
  'Communication Services',
  'Basic Materials',
  'Index ETF',
  'Other',
];

const ASSET_TYPES = [
  { value: 'EQUITY', label: 'Stock / Equity' },
  { value: 'ETF', label: 'Exchange-Traded Fund (ETF)' },
  { value: 'MUTUAL_FUND', label: 'Mutual Fund' },
  { value: 'CRYPTO', label: 'Cryptocurrency' },
  { value: 'BOND', label: 'Bond' },
  { value: 'OTHER', label: 'Other' },
];

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialSymbol = '',
  currencySymbol = '$',
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [assetType, setAssetType] = useState('EQUITY');
  const [quantity, setQuantity] = useState<string>('1');
  const [buyPrice, setBuyPrice] = useState<string>('');
  const [buyDate, setBuyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sector, setSector] = useState<string>('Technology');
  const [fees, setFees] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [livePriceInfo, setLivePriceInfo] = useState<{
    price: number;
    name?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchLiveQuote = useCallback(async (sym: string) => {
    if (!sym || sym.trim().length === 0) return;
    setIsFetchingQuote(true);
    setError(null);
    try {
      const quote = await StockService.getQuote(sym.trim().toUpperCase());
      setLivePriceInfo({
        price: quote.currentPrice,
        name: quote.name,
      });
      // Suggest live price as buy price if empty
      setBuyPrice((prev) => (prev ? prev : quote.currentPrice.toFixed(2)));
    } catch {
      // Non-fatal if ticker not yet listed or offline
      setLivePriceInfo(null);
    } finally {
      setIsFetchingQuote(false);
    }
  }, []);

  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
      handleFetchLiveQuote(initialSymbol);
    }
  }, [initialSymbol, handleFetchLiveQuote]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qtyNum = parseFloat(quantity);
    const priceNum = parseFloat(buyPrice);
    const feesNum = fees ? parseFloat(fees) : 0;

    if (!symbol.trim()) {
      setError('Ticker symbol is required.');
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Buy price must be zero or positive.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        symbol: symbol.trim().toUpperCase(),
        quantity: qtyNum,
        buyPrice: priceNum,
        buyDate: buyDate ? new Date(buyDate).toISOString() : undefined,
        assetType,
        sector: sector || undefined,
        fees: feesNum,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add holding';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Add Holding / Lot</h3>
            <p className="text-xs text-slate-400">
              Record a purchase lot with real market valuation
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ticker Symbol *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL, NVDA, SPY"
                required
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-semibold tracking-wider focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleFetchLiveQuote(symbol)}
                disabled={isFetchingQuote || !symbol.trim()}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isFetchingQuote ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Check Quote</span>
              </button>
            </div>

            {livePriceInfo && (
              <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-300 truncate max-w-[200px]">
                  {livePriceInfo.name || symbol}
                </span>
                <span className="font-bold text-emerald-400">
                  Live: ${livePriceInfo.price.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Asset Type & Sector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Sector / Industry
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                {SECTOR_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity & Buy Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Shares / Quantity *
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Buy Price per Share *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-xs">{currencySymbol}</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="150.00"
                  required
                  className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Purchase Date & Fees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Brokerage / Fees ({currencySymbol})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dollar-cost averaging, long-term core position"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Lot notice */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              If you already own this ticker, adding this lot will automatically recalculate your
              weighted average buy price and store the new transaction lot.
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Add Position</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
