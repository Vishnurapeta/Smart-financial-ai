import React, { useState, useEffect } from 'react';
import { HoldingDto, EditHoldingPayload } from '../../types/portfolio.ts';
import { X, Edit2, Loader2, AlertCircle } from 'lucide-react';

interface EditHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: HoldingDto | null;
  onSubmit: (payload: EditHoldingPayload) => Promise<void>;
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

export const EditHoldingModal: React.FC<EditHoldingModalProps> = ({
  isOpen,
  onClose,
  holding,
  onSubmit,
  currencySymbol = '$',
}) => {
  const [quantity, setQuantity] = useState<string>('');
  const [averageBuyPrice, setAverageBuyPrice] = useState<string>('');
  const [sector, setSector] = useState<string>('Technology');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (holding) {
      setQuantity(String(holding.quantity));
      setAverageBuyPrice(String(holding.averageBuyPrice));
      setSector(holding.sector || 'Technology');
      setNotes(holding.notes || '');
      setError(null);
    }
  }, [holding]);

  if (!isOpen || !holding) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qtyNum = parseFloat(quantity);
    const priceNum = parseFloat(averageBuyPrice);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Average buy price must be zero or positive.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        quantity: qtyNum,
        averageBuyPrice: priceNum,
        sector: sector || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update holding';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Edit {holding.symbol}</h3>
            <p className="text-xs text-slate-400">
              Adjust quantity, average cost basis, and sector metadata
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Avg Buy Price ({currencySymbol})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={averageBuyPrice}
                onChange={(e) => setAverageBuyPrice(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Sector / Industry
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
            >
              {SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Investment rationale or target exit"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

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
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Edit2 className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
