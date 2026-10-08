import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '../components/Header.tsx';
import { StockService } from '../services/stock.service.ts';
import { WatchlistService } from '../services/watchlist.service.ts';
import { AlertService } from '../services/alert.service.ts';
import { MarketQuote, StockSearchResult, HistoricalDataResult } from '../types/stock.ts';
import { Watchlist } from '../types/watchlist.ts';
import { StockAlert, AppNotification, NotificationPreferences } from '../types/alert.ts';
import { CreateAlertModal } from '../components/stocks/CreateAlertModal.tsx';
import { WatchlistSection } from '../components/stocks/WatchlistSection.tsx';
import { AlertsManagerSection } from '../components/stocks/AlertsManagerSection.tsx';
import { AlertHistorySection } from '../components/stocks/AlertHistorySection.tsx';
import { NotificationPreferencesSection } from '../components/stocks/NotificationPreferencesSection.tsx';
import { PredictionCard } from '../components/stocks/PredictionCard.tsx';
import { ActualPredictedChart } from '../components/stocks/ActualPredictedChart.tsx';
import { ModelComparison } from '../components/stocks/ModelComparison.tsx';
import { MetricsCard } from '../components/stocks/MetricsCard.tsx';
import { PredictionHistory } from '../components/stocks/PredictionHistory.tsx';
import { PredictionDisclaimer } from '../components/stocks/PredictionDisclaimer.tsx';
import { useStockPrediction } from '../hooks/useStockPrediction.ts';
import { getCurrencySymbol } from '../utils/format.ts';
import {
  Search,
  Activity,
  BarChart2,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Layers,
  Settings,
  Plus,
  Check,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'SPY', 'META'];

type ActiveTab = 'overview' | 'predictions' | 'watchlists' | 'alerts' | 'history' | 'preferences';

interface TooltipProps {
  active?: boolean;
  currencySymbol?: string;
  payload?: Array<{
    value?: number;
    dataKey?: string;
    payload?: {
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };
  }>;
  label?: string;
}

const StockPriceTooltip: React.FC<TooltipProps> = ({ active, payload, label, currencySymbol = '$' }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (!data) return null;

    return (
      <div className="bg-slate-900/95 border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 min-w-[190px]">
        <div className="font-semibold text-white border-b border-slate-800 pb-1">{label}</div>
        <div className="space-y-1 font-mono">
          <div className="flex justify-between items-center text-slate-300">
            <span>Close:</span>
            <span className="font-bold text-white">{currencySymbol}{data.close.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>Open:</span>
            <span>{currencySymbol}{data.open.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-emerald-400 text-[11px]">
            <span>High:</span>
            <span>{currencySymbol}{data.high.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-rose-400 text-[11px]">
            <span>Low:</span>
            <span>{currencySymbol}{data.low.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-cyan-400 text-[11px] pt-1 border-t border-slate-800">
            <span>Volume:</span>
            <span>{data.volume.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const StocksPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL');
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [history, setHistory] = useState<HistoricalDataResult | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1mo');
  const [loading, setLoading] = useState<boolean>(true);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Watchlist & Alerts state
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlist, setActiveWatchlist] = useState<Watchlist | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailAlerts: true,
    pushAlerts: true,
    weeklyDigest: true,
    stockAlertsEnabled: true,
    minCooldownMinutes: 60,
  });

  // Modal states
  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);
  const [modalSymbol, setModalSymbol] = useState<string>('AAPL');
  const [modalPrice, setModalPrice] = useState<number | undefined>(undefined);
  const [editingAlert, setEditingAlert] = useState<StockAlert | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Stock Prediction Engine Hook
  const predHook = useStockPrediction({
    initialSymbol: selectedSymbol,
    autoFetch: activeTab === 'predictions',
  });

  const isIndianTicker =
    selectedSymbol.includes('.NS') ||
    selectedSymbol.includes('.BO') ||
    ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'ITC', 'LT', 'SBIN'].includes(
      selectedSymbol.toUpperCase(),
    );
  const currencySymbol = getCurrencySymbol(
    quote?.currency || history?.currency || (isIndianTicker ? 'INR' : 'USD'),
  );

  // Fetch initial stock quote & chart
  useEffect(() => {
    loadStockData(selectedSymbol, timeframe);
    predHook.setSymbol(selectedSymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol]);

  useEffect(() => {
    if (selectedSymbol) {
      loadHistoryData(selectedSymbol, timeframe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  // Load user watchlists, alerts, notifications, and preferences
  useEffect(() => {
    loadSubsystemData();
  }, []);

  const loadSubsystemData = async () => {
    try {
      const [wls, alts, notifs, prefs] = await Promise.all([
        WatchlistService.getWatchlists().catch(() => []),
        AlertService.getAlerts().catch(() => []),
        AlertService.getNotifications().catch(() => ({
          notifications: [],
          total: 0,
          unreadCount: 0,
        })),
        AlertService.getPreferences().catch(() => ({
          emailAlerts: true,
          pushAlerts: true,
          weeklyDigest: true,
          stockAlertsEnabled: true,
          minCooldownMinutes: 60,
        })),
      ]);

      setWatchlists(wls);
      if (wls.length > 0) {
        setActiveWatchlist(wls.find((w) => w.isDefault) || wls[0]);
      }
      setAlerts(alts);
      setNotifications(notifs.notifications || []);
      setPreferences(prefs);
    } catch (err) {
      console.warn('Subsystem data load error', err);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await StockService.search(searchQuery.trim());
        setSearchResults(results);
        setShowSearchResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadStockData = async (symbol: string, range: string) => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedQuote, fetchedHistory] = await Promise.all([
        StockService.getQuote(symbol),
        StockService.getHistory(symbol, range, range === '1d' ? '5m' : '1d'),
      ]);
      setQuote(fetchedQuote);
      setHistory(fetchedHistory);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to retrieve live market data for selected stock.',
      );
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryData = async (symbol: string, range: string) => {
    try {
      setChartLoading(true);
      const interval = range === '1d' ? '5m' : range === '5d' ? '15m' : '1d';
      const fetchedHistory = await StockService.getHistory(symbol, range, interval);
      setHistory(fetchedHistory);
    } catch (err: unknown) {
      console.warn('Failed to update historical range', err);
    } finally {
      setChartLoading(false);
    }
  };

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setSearchQuery('');
    setShowSearchResults(false);
    setActiveTab('overview');
  };

  const handleOpenAlertModal = (symbol: string, currentPrice?: number) => {
    setModalSymbol(symbol);
    setModalPrice(currentPrice);
    setEditingAlert(null);
    setAlertModalOpen(true);
  };

  const handleOpenEditAlert = (alert: StockAlert) => {
    setEditingAlert(alert);
    setModalSymbol(alert.symbol);
    setModalPrice(undefined);
    setAlertModalOpen(true);
  };

  const handleQuickAddToWatchlist = async () => {
    if (!activeWatchlist || !quote) return;
    try {
      const updated = await WatchlistService.addSymbol(activeWatchlist.id, {
        symbol: quote.symbol,
      });
      const updatedList = watchlists.map((w) => (w.id === updated.id ? updated : w));
      setWatchlists(updatedList);
      setActiveWatchlist(updated);
      setFeedbackToast(`Added ${quote.symbol} to ${activeWatchlist.name}`);
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: unknown) {
      setFeedbackToast(err instanceof Error ? err.message : 'Failed to add ticker to watchlist');
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  const isCurrentInWatchlist = useMemo(() => {
    if (!activeWatchlist || !quote) return false;
    return activeWatchlist.symbols.some((s) => s.symbol === quote.symbol);
  }, [activeWatchlist, quote]);

  // Chart data formatting
  const chartPoints = useMemo(() => {
    if (!history || !history.bars) return [];
    return history.bars.map((bar) => {
      const d = new Date(bar.timestamp);
      const formattedDate =
        timeframe === '1d'
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return {
        date: formattedDate,
        close: bar.close,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        volume: bar.volume,
      };
    });
  }, [history, timeframe]);

  const priceStats = useMemo(() => {
    if (!chartPoints.length) return { min: 0, max: 0 };
    const closes = chartPoints.map((p) => p.close);
    return {
      min: Math.floor(Math.min(...closes) * 0.98),
      max: Math.ceil(Math.max(...closes) * 1.02),
    };
  }, [chartPoints]);

  const isPositive = quote ? quote.change >= 0 : true;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'overview', label: 'Stock Intelligence & Charts', icon: BarChart2 },
              {
                id: 'predictions',
                label: 'AI Predictions',
                icon: Sparkles,
                badge: 'ML Models',
                badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
              },
              {
                id: 'watchlists',
                label: 'Watchlists',
                icon: Layers,
                badge: watchlists.reduce((acc, w) => acc + (w.symbols?.length || 0), 0),
              },
              {
                id: 'alerts',
                label: 'Stock Alerts',
                icon: Bell,
                badge: alerts.filter((a) => a.isActive).length,
              },
              {
                id: 'history',
                label: 'Alert History',
                icon: Activity,
                badge: unreadCount > 0 ? `${unreadCount} new` : undefined,
                badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
              },
              { id: 'preferences', label: 'Preferences', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/10 font-bold'
                      : 'bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        tab.badgeColor ||
                        (isActive
                          ? 'bg-slate-950/20 text-slate-950 border-slate-950/30'
                          : 'bg-slate-800 text-emerald-400 border-emerald-500/30')
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Search in Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition"
            />
            {isSearching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
            )}

            {/* Dropdown Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-60 overflow-y-auto">
                {searchResults.map((item) => (
                  <button
                    key={item.symbol}
                    onClick={() => handleSelectSymbol(item.symbol)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/60 transition border-b border-slate-800/40 last:border-0"
                  >
                    <div>
                      <span className="font-bold text-white text-xs font-mono">{item.symbol}</span>
                      <span className="text-[11px] text-slate-400 block line-clamp-1">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                      {item.exchange || item.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {feedbackToast && (
          <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Tab 1: Stock Overview & Interactive Charts */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Tickers Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap mr-1">
                Trending Tickers:
              </span>
              {POPULAR_TICKERS.map((sym) => {
                const isSelected = selectedSymbol === sym;
                return (
                  <button
                    key={sym}
                    onClick={() => handleSelectSymbol(sym)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3 bg-slate-900/40 rounded-3xl border border-slate-800">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <p className="text-xs font-mono">
                  Fetching real-time market data for {selectedSymbol}...
                </p>
              </div>
            ) : error ? (
              <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center space-y-3">
                <AlertTriangle className="w-8 h-8 mx-auto" />
                <div className="font-semibold">{error}</div>
                <p className="text-slate-400 text-[11px] max-w-md mx-auto">
                  The external market provider was unable to resolve ticker "{selectedSymbol}".
                  Check the symbol spelling or select another ticker above.
                </p>
              </div>
            ) : quote ? (
              <div className="space-y-6">
                {/* Active Ticker Hero Banner with Actions */}
                <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 border border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                          {quote.symbol}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {quote.currency}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Live Feed • {quote.provider.toUpperCase()}
                        </span>
                      </div>
                      <h2 className="text-sm sm:text-base font-semibold text-slate-300 mt-1">
                        {quote.name}
                      </h2>
                    </div>

                    <div className="flex flex-col sm:items-end gap-3">
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl sm:text-4xl font-black text-white font-mono">
                          {currencySymbol}
                          {(
                            quote.currentPrice ?? (quote as unknown as { price: number }).price
                          ).toFixed(2)}
                        </span>
                        <div
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold font-mono shadow-sm ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          <span>
                            {isPositive ? '+' : ''}
                            {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      {/* Action Pills */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleQuickAddToWatchlist}
                          disabled={isCurrentInWatchlist}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                            isCurrentInWatchlist
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {isCurrentInWatchlist ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              In Watchlist
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 text-emerald-400" />
                              Add to Watchlist
                            </>
                          )}
                        </button>
                        <button
                          onClick={() =>
                            handleOpenAlertModal(
                              quote.symbol,
                              quote.currentPrice ?? (quote as unknown as { price: number }).price,
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition"
                        >
                          <Bell className="w-3.5 h-3.5 text-cyan-400" />
                          Set Alert
                        </button>
                        <button
                          onClick={() => setActiveTab('predictions')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/10 hover:from-emerald-400 hover:to-teal-300 transition cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Prediction
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6 Key Financial Metrics KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[11px] text-slate-400 font-medium block">
                      Previous Close
                    </span>
                    <span className="text-base font-bold text-white font-mono mt-1 block">
                      {currencySymbol}{quote.previousClose.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[11px] text-slate-400 font-medium block">Day Open</span>
                    <span className="text-base font-bold text-white font-mono mt-1 block">
                      {currencySymbol}{quote.open.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[11px] text-slate-400 font-medium block">Day Range</span>
                    <span className="text-xs font-bold text-slate-200 font-mono mt-1.5 block">
                      {currencySymbol}{quote.low.toFixed(2)} - {currencySymbol}{quote.high.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[11px] text-slate-400 font-medium block">Volume</span>
                    <span className="text-base font-bold text-cyan-400 font-mono mt-1 block">
                      {quote.volume ? `${(quote.volume / 1000000).toFixed(2)}M` : '---'}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[11px] text-slate-400 font-medium block">
                      52-Week High
                    </span>
                    <span className="text-base font-bold text-emerald-400 font-mono mt-1 block">
                      {currencySymbol}
                      {(
                        quote.week52High ??
                        (quote as unknown as { fiftyTwoWeekHigh?: number }).fiftyTwoWeekHigh
                      )?.toFixed(2) || '---'}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[11px] text-slate-400 font-medium block">
                      52-Week Low
                    </span>
                    <span className="text-base font-bold text-rose-400 font-mono mt-1 block">
                      {currencySymbol}
                      {(
                        quote.week52Low ??
                        (quote as unknown as { fiftyTwoWeekLow?: number }).fiftyTwoWeekLow
                      )?.toFixed(2) || '---'}
                    </span>
                  </div>
                </div>

                {/* Interactive Chart Section */}
                <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-base font-bold text-white">Historical Market Trend</h3>
                    </div>

                    {/* Timeframe Switcher */}
                    <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-2xl gap-1">
                      {['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y'].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase transition ${
                            timeframe === tf
                              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                              : 'text-slate-400 hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {chartLoading ? (
                    <div className="h-80 flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      <span className="text-xs font-mono">Loading OHLCV candles...</span>
                    </div>
                  ) : chartPoints.length > 0 ? (
                    <div className="space-y-4">
                      {/* Price Area Chart */}
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={chartPoints}
                            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                  offset="5%"
                                  stopColor={isPositive ? '#10b981' : '#f43f5e'}
                                  stopOpacity={0.4}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={isPositive ? '#10b981' : '#f43f5e'}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#1e293b"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[priceStats.min, priceStats.max]}
                              stroke="#64748b"
                              tick={{ fontSize: 11 }}
                              tickFormatter={(val) => `${currencySymbol}${val}`}
                              orientation="right"
                              tickLine={false}
                            />
                            <Tooltip content={<StockPriceTooltip currencySymbol={currencySymbol} />} />
                            <Area
                              type="monotone"
                              dataKey="close"
                              stroke={isPositive ? '#10b981' : '#f43f5e'}
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#priceGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Synchronized Volume Bar Chart */}
                      <div className="h-28 w-full border-t border-slate-800/80 pt-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-2 mb-1">
                          <span>Trading Volume</span>
                          <span>Bar Volume Profile</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartPoints}
                            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                          >
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Tooltip
                              formatter={(value: unknown) => [
                                `${(Number(value || 0) / 1000000).toFixed(2)}M`,
                                'Volume',
                              ]}
                              labelStyle={{ color: '#fff' }}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '12px',
                                fontSize: '11px',
                              }}
                            />
                            <Bar
                              dataKey="volume"
                              fill="#06b6d4"
                              opacity={0.6}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                      No historical data returned by provider for {timeframe}.
                    </div>
                  )}
                </div>

                {/* Historical OHLCV Table */}
                {chartPoints.length > 0 && (
                  <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Recent Daily Bars (OHLCV)</h3>
                      <span className="text-xs text-slate-400">
                        Showing latest {Math.min(10, chartPoints.length)} sessions
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-sans">
                            <th className="pb-3 font-semibold">Date</th>
                            <th className="pb-3 font-semibold text-right">Open</th>
                            <th className="pb-3 font-semibold text-right">High</th>
                            <th className="pb-3 font-semibold text-right">Low</th>
                            <th className="pb-3 font-semibold text-right">Close</th>
                            <th className="pb-3 font-semibold text-right">Volume</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {chartPoints
                            .slice(-10)
                            .reverse()
                            .map((pt, i) => (
                              <tr key={i} className="hover:bg-slate-800/30">
                                <td className="py-2.5 text-white font-medium">{pt.date}</td>
                                <td className="py-2.5 text-right text-slate-300">
                                  {currencySymbol}{pt.open.toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right text-emerald-400">
                                  {currencySymbol}{pt.high.toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right text-rose-400">
                                  {currencySymbol}{pt.low.toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right font-bold text-white">
                                  {currencySymbol}{pt.close.toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right text-slate-400">
                                  {pt.volume.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Tab: AI Stock Predictions */}
        {activeTab === 'predictions' && (
          <div className="space-y-6">
            <PredictionDisclaimer compact={true} />

            {/* AI Intelligence Center Navigation Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-purple-950/40 border border-cyan-500/30 rounded-2xl backdrop-blur-md gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    AI Stock Prediction &amp; Intelligent Screening Center
                  </h3>
                  <p className="text-xs text-gray-400">
                    Screen, rank, and compare ML predictions across 100+ stocks in the universe.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/stocks/prediction?symbol=${selectedSymbol}`)}
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                View in AI Intelligence Center
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <PredictionCard
              symbol={selectedSymbol}
              prediction={predHook.prediction}
              loading={predHook.loading}
              error={predHook.error}
              errorStatus={predHook.errorStatus}
              activeHorizon={predHook.horizon}
              onHorizonChange={predHook.setHorizon}
              activeTarget={predHook.target}
              onTargetChange={predHook.setTarget}
              onRefresh={() => predHook.refetchPrediction()}
              currencySymbol={currencySymbol}
            />

            {history && (
              <ActualPredictedChart
                symbol={selectedSymbol}
                bars={history.bars}
                prediction={predHook.prediction}
                history={predHook.history}
                currencySymbol={currencySymbol}
              />
            )}

            <ModelComparison
              symbol={selectedSymbol}
              models={predHook.models}
              selectedModelName={predHook.prediction?.model_name}
              onSelectModel={(m) => {
                predHook.setTarget(m.target);
                predHook.setHorizon(m.horizon);
                predHook.refetchPrediction(selectedSymbol, m.horizon, m.target);
              }}
              loading={predHook.modelsLoading}
            />

            {predHook.prediction && (
              <MetricsCard
                metrics={predHook.prediction.historical_metrics}
                modelName={predHook.prediction.model_name}
                target={predHook.prediction.target}
              />
            )}

            <PredictionHistory
              symbol={selectedSymbol}
              items={predHook.history}
              totalCount={predHook.historyTotal}
              loading={predHook.historyLoading}
              currencySymbol={currencySymbol}
            />

            <PredictionDisclaimer compact={false} />
          </div>
        )}

        {/* Tab 2: Watchlists Section */}
        {activeTab === 'watchlists' && (
          <WatchlistSection
            watchlists={watchlists}
            activeWatchlist={activeWatchlist}
            onSelectWatchlist={setActiveWatchlist}
            onWatchlistsChange={setWatchlists}
            onInspectSymbol={handleSelectSymbol}
            onOpenAlertModal={handleOpenAlertModal}
          />
        )}

        {/* Tab 3: Alerts Section */}
        {activeTab === 'alerts' && (
          <AlertsManagerSection
            alerts={alerts}
            onAlertsChange={setAlerts}
            onOpenCreateModal={() => handleOpenAlertModal(selectedSymbol, quote?.currentPrice)}
            onOpenEditModal={handleOpenEditAlert}
          />
        )}

        {/* Tab 4: Alert History Section */}
        {activeTab === 'history' && (
          <AlertHistorySection
            notifications={notifications}
            onNotificationsChange={setNotifications}
            onInspectSymbol={handleSelectSymbol}
          />
        )}

        {/* Tab 5: Preferences Section */}
        {activeTab === 'preferences' && (
          <NotificationPreferencesSection
            preferences={preferences}
            onPreferencesChange={setPreferences}
          />
        )}

        {/* Create / Edit Alert Modal */}
        <CreateAlertModal
          isOpen={alertModalOpen}
          onClose={() => setAlertModalOpen(false)}
          onSuccess={(saved) => {
            if (editingAlert) {
              setAlerts(alerts.map((a) => (a._id === saved._id ? saved : a)));
              setFeedbackToast(`Updated alert rule for ${saved.symbol}`);
            } else {
              setAlerts([saved, ...alerts]);
              setFeedbackToast(`Activated alert for ${saved.symbol}`);
            }
            setTimeout(() => setFeedbackToast(null), 3000);
          }}
          initialSymbol={modalSymbol}
          currentPrice={modalPrice}
          existingAlert={editingAlert}
        />
      </main>
    </div>
  );
};

export default StocksPage;
