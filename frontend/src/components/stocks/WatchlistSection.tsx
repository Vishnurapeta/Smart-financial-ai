import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Watchlist, WatchlistSymbol } from '../../types/watchlist.ts';
import { WatchlistService } from '../../services/watchlist.service.ts';
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  LineChart,
  Bell,
  Loader2,
  Layers,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface WatchlistSectionProps {
  watchlists: Watchlist[];
  activeWatchlist: Watchlist | null;
  onSelectWatchlist: (wl: Watchlist) => void;
  onWatchlistsChange: (watchlists: Watchlist[]) => void;
  onInspectSymbol: (symbol: string) => void;
  onOpenAlertModal: (symbol: string, currentPrice?: number) => void;
}

export const WatchlistSection: React.FC<WatchlistSectionProps> = ({
  watchlists,
  activeWatchlist,
  onSelectWatchlist,
  onWatchlistsChange,
  onInspectSymbol,
  onOpenAlertModal,
}) => {
  const navigate = useNavigate();
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [targetBuy, setTargetBuy] = useState<string>('');
  const [targetSell, setTargetSell] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [showNewWatchlistModal, setShowNewWatchlistModal] = useState<boolean>(false);
  const [newWatchlistName, setNewWatchlistName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWatchlist || !newSymbol.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await WatchlistService.addSymbol(activeWatchlist.id, {
        symbol: newSymbol.trim().toUpperCase(),
        notes: notes.trim(),
        targetBuyPrice: targetBuy ? parseFloat(targetBuy) : undefined,
        targetSellPrice: targetSell ? parseFloat(targetSell) : undefined,
      });

      const updatedList = watchlists.map((w) => (w.id === updated.id ? updated : w));
      onWatchlistsChange(updatedList);
      onSelectWatchlist(updated);
      setNewSymbol('');
      setTargetBuy('');
      setTargetSell('');
      setNotes('');
      setShowAddForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add ticker to watchlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    if (!activeWatchlist) return;
    try {
      const updated = await WatchlistService.removeSymbol(activeWatchlist.id, symbol);
      const updatedList = watchlists.map((w) => (w.id === updated.id ? updated : w));
      onWatchlistsChange(updatedList);
      onSelectWatchlist(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove ticker from watchlist');
    }
  };

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const created = await WatchlistService.createWatchlist({
        name: newWatchlistName.trim(),
      });
      const updatedList = [...watchlists, created];
      onWatchlistsChange(updatedList);
      onSelectWatchlist(created);
      setNewWatchlistName('');
      setShowNewWatchlistModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create new watchlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const symbols: WatchlistSymbol[] = activeWatchlist?.symbols || [];

  return (
    <div className="space-y-6">
      {/* Watchlist Bar & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={activeWatchlist?.id || ''}
                onChange={(e) => {
                  const found = watchlists.find((w) => w.id === e.target.value);
                  if (found) onSelectWatchlist(found);
                }}
                className="bg-transparent font-bold text-white text-base focus:outline-none border-b border-dashed border-slate-600 pb-0.5 cursor-pointer"
              >
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                    {w.name} {w.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {symbols.length} tracked {symbols.length === 1 ? 'asset' : 'assets'} with live quotes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold hover:from-emerald-400 hover:to-teal-300 transition shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            Add Symbol
          </button>
          <button
            onClick={() => setShowNewWatchlistModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-semibold transition"
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            New List
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Inline Add Symbol Card */}
      {showAddForm && (
        <form
          onSubmit={handleAddSymbol}
          className="p-5 bg-slate-900/90 border border-emerald-500/30 rounded-3xl space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Add Ticker to Watchlist
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Ticker Symbol</label>
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. MSFT, NVDA"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-white font-mono uppercase focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Target Buy Price ($)</label>
              <input
                type="number"
                step="any"
                value={targetBuy}
                onChange={(e) => setTargetBuy(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Target Sell Price ($)</label>
              <input
                type="number"
                step="any"
                value={targetSell}
                onChange={(e) => setTargetSell(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Earnings play"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Track Symbol
            </button>
          </div>
        </form>
      )}

      {/* Symbols Grid / List */}
      {symbols.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">Watchlist is empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your favorite stocks, indices, or crypto to monitor real-time prices, volume, and
            daily movements in one unified place.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            Add First Symbol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {symbols.map((item) => {
            const quote = item.quote;
            const price =
              quote?.currentPrice ?? (quote as unknown as { price?: number })?.price ?? 0;
            const change = quote?.change ?? 0;
            const changePercent = quote?.changePercent ?? 0;
            const isPositive = change >= 0;

            return (
              <div
                key={item.symbol}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-3xl p-5 transition space-y-4 group relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base font-mono">
                        {item.symbol}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                        {quote?.provider || 'Live'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{quote?.name || 'Equity'}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/stocks/${item.symbol}/prediction`)}
                      title="AI Prediction Analysis"
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenAlertModal(item.symbol, price)}
                      title="Set Alert"
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onInspectSymbol(item.symbol)}
                      title="Inspect Chart"
                      className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    >
                      <LineChart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveSymbol(item.symbol)}
                      title="Remove Symbol"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Price & Change */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-2xl font-black text-white font-mono">
                      ${price > 0 ? price.toFixed(2) : '---'}
                    </span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                      isPositive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isPositive ? '+' : ''}
                      {change.toFixed(2)} ({changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* 52W & Metrics */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/80 font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Volume:</span>
                    <span className="text-slate-300">
                      {quote?.volume ? `${(quote.volume / 1000000).toFixed(2)}M` : '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Day Range:</span>
                    <span className="text-slate-300">
                      ${quote?.low?.toFixed(2) || '0'} - ${quote?.high?.toFixed(2) || '0'}
                    </span>
                  </div>
                </div>

                {/* Notes or Targets */}
                {(item.targetBuyPrice || item.targetSellPrice || item.notes) && (
                  <div className="pt-2 text-[11px] text-slate-400 space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="flex justify-between">
                      {item.targetBuyPrice && (
                        <span>
                          Target Buy:{' '}
                          <strong className="text-teal-400 font-mono">
                            ${item.targetBuyPrice}
                          </strong>
                        </span>
                      )}
                      {item.targetSellPrice && (
                        <span>
                          Target Sell:{' '}
                          <strong className="text-amber-400 font-mono">
                            ${item.targetSellPrice}
                          </strong>
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="italic text-slate-400 line-clamp-1">"{item.notes}"</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Watchlist Modal */}
      {showNewWatchlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Create New Watchlist</h3>
            <form onSubmit={handleCreateWatchlist} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Watchlist Name</label>
                <input
                  type="text"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="e.g. Dividend Kings, Energy Sector"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWatchlistModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
