import React, { useState, useEffect, useMemo } from 'react';
import {
  StockAlert,
  StockAlertType,
  CreateStockAlertPayload,
  UpdateStockAlertPayload,
} from '../../types/alert.ts';
import { MarketQuote } from '../../types/stock.ts';
import { AlertService } from '../../services/alert.service.ts';
import { StockService } from '../../services/stock.service.ts';
import {
  X,
  Bell,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  AlertCircle,
  Check,
  ChevronDown,
  ArrowRight,
  FileText,
} from 'lucide-react';

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (alert: StockAlert) => void;
  initialSymbol?: string;
  currentPrice?: number;
  existingAlert?: StockAlert | null;
}

interface AlertConditionConfig {
  type: StockAlertType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  borderColor: string;
  bgActive: string;
}

const ALERT_CONDITIONS: AlertConditionConfig[] = [
  {
    type: 'PRICE_ABOVE',
    title: '↗ Price Above',
    description: 'Trigger above',
    icon: TrendingUp,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    bgActive: 'bg-emerald-500/10',
  },
  {
    type: 'PRICE_BELOW',
    title: '↘ Price Below',
    description: 'Trigger below',
    icon: TrendingDown,
    accentColor: 'text-rose-400',
    borderColor: 'border-rose-500/50',
    bgActive: 'bg-rose-500/10',
  },
  {
    type: 'PERCENT_CHANGE_UP',
    title: 'Pulse Momentum',
    description: 'Momentum gain',
    icon: Activity,
    accentColor: 'text-teal-400',
    borderColor: 'border-teal-500/50',
    bgActive: 'bg-teal-500/10',
  },
  {
    type: 'PERCENT_CHANGE_DOWN',
    title: 'Drawdown',
    description: 'Drop percentage',
    icon: Activity,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    bgActive: 'bg-amber-500/10',
  },
  {
    type: 'VOLUME_ABOVE',
    title: 'Volume Spike',
    description: 'Unusual volume',
    icon: BarChart3,
    accentColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/50',
    bgActive: 'bg-cyan-500/10',
  },
];

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSymbol = 'AAPL',
  currentPrice,
  existingAlert,
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [alertType, setAlertType] = useState<StockAlertType>('PRICE_ABOVE');
  const [threshold, setThreshold] = useState<string>('');
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ symbol?: string; threshold?: string }>({});

  // Active price from live quote, passed prop, or fallback
  const activePrice = quote?.currentPrice || currentPrice || 0;
  const currencySymbol = quote?.currency === 'INR' ? '₹' : '$';

  // Initialize or reset form state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (existingAlert) {
      setSymbol(existingAlert.symbol);
      setAlertType(existingAlert.alertType);
      if (
        existingAlert.alertType === 'VOLUME_ABOVE' &&
        existingAlert.threshold > 100 &&
        quote?.volume
      ) {
        setThreshold((existingAlert.threshold / quote.volume).toFixed(2));
      } else {
        setThreshold(String(existingAlert.threshold));
      }
      setCooldownMinutes(existingAlert.cooldownMinutes || 60);
      setNotes(existingAlert.notes || '');
      setShowNotes(Boolean(existingAlert.notes));
    } else {
      setSymbol(initialSymbol);
      setAlertType('PRICE_ABOVE');
      if (currentPrice && currentPrice > 0) {
        setThreshold((currentPrice * 1.05).toFixed(2));
      } else {
        setThreshold('');
      }
      setCooldownMinutes(60);
      setNotes('');
      setShowNotes(false);
    }
    setError(null);
    setFieldErrors({});
  }, [existingAlert, initialSymbol, currentPrice, isOpen]);

  // Fetch live market quote for active symbol
  useEffect(() => {
    if (!isOpen || !symbol.trim()) return;
    const clean = symbol.trim().toUpperCase();

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const q = await StockService.getQuote(clean);
        if (isMounted && q && q.currentPrice) {
          setQuote(q);
          if (!existingAlert && (!threshold || threshold === '')) {
            setThreshold((q.currentPrice * 1.05).toFixed(2));
          }
        }
      } catch {
        // Fall back gracefully to currentPrice prop if quote fetch fails
      } finally {
        if (isMounted) setQuoteLoading(false);
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [symbol, isOpen, existingAlert]);

  // Handle symbol change
  const handleSymbolChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setSymbol(clean);
    if (fieldErrors.symbol) {
      setFieldErrors((prev) => ({ ...prev, symbol: undefined }));
    }
  };

  // Handle condition switch with smart default threshold presets
  const handleConditionSelect = (type: StockAlertType) => {
    setAlertType(type);
    if (fieldErrors.threshold) {
      setFieldErrors((prev) => ({ ...prev, threshold: undefined }));
    }

    if (type === 'PRICE_ABOVE') {
      setThreshold(activePrice > 0 ? (activePrice * 1.05).toFixed(2) : '');
    } else if (type === 'PRICE_BELOW') {
      setThreshold(activePrice > 0 ? (activePrice * 0.95).toFixed(2) : '');
    } else if (type === 'PERCENT_CHANGE_UP' || type === 'PERCENT_CHANGE_DOWN') {
      setThreshold('5.00');
    } else if (type === 'VOLUME_ABOVE') {
      setThreshold('2.00');
    }
  };

  // Quick preset chips calculation
  const handlePresetSelect = (presetVal: number | string) => {
    if (alertType === 'PRICE_ABOVE' && activePrice > 0) {
      const pct = typeof presetVal === 'number' ? presetVal : parseFloat(presetVal);
      setThreshold((activePrice * (1 + pct / 100)).toFixed(2));
    } else if (alertType === 'PRICE_BELOW' && activePrice > 0) {
      const pct = typeof presetVal === 'number' ? presetVal : parseFloat(presetVal);
      setThreshold((activePrice * (1 - Math.abs(pct) / 100)).toFixed(2));
    } else if (alertType === 'PERCENT_CHANGE_UP' || alertType === 'PERCENT_CHANGE_DOWN') {
      setThreshold(String(presetVal));
    } else if (alertType === 'VOLUME_ABOVE') {
      setThreshold(String(presetVal));
    }
    if (fieldErrors.threshold) {
      setFieldErrors((prev) => ({ ...prev, threshold: undefined }));
    }
  };

  // Dynamic input label and units
  const inputConfig = useMemo(() => {
    switch (alertType) {
      case 'PRICE_ABOVE':
      case 'PRICE_BELOW':
        return {
          label: 'Target Price',
          placeholder: '350.37',
          prefix: currencySymbol,
          suffix: '',
          unit: currencySymbol,
        };
      case 'PERCENT_CHANGE_UP':
      case 'PERCENT_CHANGE_DOWN':
        return {
          label: 'Target Percentage',
          placeholder: '5.00',
          prefix: '',
          suffix: '%',
          unit: '%',
        };
      case 'VOLUME_ABOVE':
        return {
          label: 'Volume Multiplier',
          placeholder: '2.00',
          prefix: '',
          suffix: '×',
          unit: '×',
        };
    }
  }, [alertType, currencySymbol]);

  // Computed Real-Time Price Reference
  const { currentPriceDisplay, targetDisplay, distanceDisplay, distanceColor } = useMemo(() => {
    const num = parseFloat(threshold);

    if (alertType === 'VOLUME_ABOVE') {
      const currVol = quote?.volume || 0;
      const currVolFormatted =
        currVol >= 1e6 ? `${(currVol / 1e6).toFixed(1)}M shares` : `${currVol.toLocaleString()} shares`;

      if (isNaN(num) || num <= 0) {
        return {
          currentPriceDisplay: currVolFormatted,
          targetDisplay: '—',
          distanceDisplay: '—',
          distanceColor: 'text-slate-400',
        };
      }

      const targetShares =
        num <= 50 && currVol > 0 ? num * currVol : num;
      const targetFormatted =
        targetShares >= 1e6
          ? `${(targetShares / 1e6).toFixed(1)}M shares`
          : `${Math.round(targetShares).toLocaleString()} shares`;

      const multiplier =
        currVol > 0 ? (targetShares / currVol).toFixed(2) : num.toFixed(2);

      return {
        currentPriceDisplay: currVolFormatted,
        targetDisplay: targetFormatted,
        distanceDisplay: `${multiplier}×`,
        distanceColor: 'text-cyan-400',
      };
    }

    // Price & Percentage conditions
    const formattedCurrentPrice =
      activePrice > 0 ? `${currencySymbol}${activePrice.toFixed(2)}` : '—';

    if (isNaN(num) || num <= 0 || activePrice <= 0) {
      return {
        currentPriceDisplay: formattedCurrentPrice,
        targetDisplay: '—',
        distanceDisplay: '—',
        distanceColor: 'text-slate-400',
      };
    }

    if (alertType === 'PRICE_ABOVE') {
      const diff = num - activePrice;
      const pct = (diff / activePrice) * 100;
      const isBelow = num <= activePrice;
      return {
        currentPriceDisplay: formattedCurrentPrice,
        targetDisplay: `${currencySymbol}${num.toFixed(2)}`,
        distanceDisplay: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
        distanceColor: isBelow ? 'text-amber-400' : 'text-emerald-400',
      };
    }

    if (alertType === 'PRICE_BELOW') {
      const diff = num - activePrice;
      const pct = (diff / activePrice) * 100;
      const isAbove = num >= activePrice;
      return {
        currentPriceDisplay: formattedCurrentPrice,
        targetDisplay: `${currencySymbol}${num.toFixed(2)}`,
        distanceDisplay: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
        distanceColor: isAbove ? 'text-amber-400' : 'text-rose-400',
      };
    }

    if (alertType === 'PERCENT_CHANGE_UP') {
      const implied = activePrice * (1 + num / 100);
      return {
        currentPriceDisplay: formattedCurrentPrice,
        targetDisplay: `${currencySymbol}${implied.toFixed(2)}`,
        distanceDisplay: `+${num.toFixed(2)}%`,
        distanceColor: 'text-teal-400',
      };
    }

    // PERCENT_CHANGE_DOWN
    const implied = activePrice * (1 - num / 100);
    return {
      currentPriceDisplay: formattedCurrentPrice,
      targetDisplay: `${currencySymbol}${implied.toFixed(2)}`,
      distanceDisplay: `-${num.toFixed(2)}%`,
      distanceColor: 'text-amber-400',
    };
  }, [threshold, activePrice, alertType, currencySymbol, quote?.volume]);

  if (!isOpen) return null;

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      setFieldErrors((prev) => ({ ...prev, symbol: 'Stock symbol is required' }));
      return;
    }

    const numericThreshold = parseFloat(threshold);
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
      setFieldErrors((prev) => ({
        ...prev,
        threshold: alertType.includes('PRICE')
          ? 'Enter a valid price.'
          : 'Enter a valid threshold value.',
      }));
      return;
    }

    // Specific threshold validation
    if (alertType === 'PRICE_ABOVE' && activePrice > 0 && numericThreshold <= activePrice) {
      setFieldErrors((prev) => ({
        ...prev,
        threshold: 'Threshold must be greater than the current price.',
      }));
      return;
    }

    if (alertType === 'PRICE_BELOW' && activePrice > 0 && numericThreshold >= activePrice) {
      setFieldErrors((prev) => ({
        ...prev,
        threshold: 'Threshold must be less than the current price.',
      }));
      return;
    }

    // For VOLUME_ABOVE, normalize multiplier into shares if entered as multiplier
    let finalThreshold = numericThreshold;
    if (alertType === 'VOLUME_ABOVE' && numericThreshold <= 50 && (quote?.volume || 0) > 0) {
      finalThreshold = Math.round(numericThreshold * (quote?.volume || 0));
    }

    try {
      setLoading(true);
      if (existingAlert) {
        const payload: UpdateStockAlertPayload = {
          alertType,
          threshold: finalThreshold,
          cooldownMinutes,
          notes: notes.trim() || undefined,
        };
        const updated = await AlertService.updateAlert(existingAlert._id, payload);
        onSuccess(updated);
      } else {
        const payload: CreateStockAlertPayload = {
          symbol: cleanSymbol,
          alertType,
          threshold: finalThreshold,
          cooldownMinutes,
          notes: notes.trim() || undefined,
        };
        const created = await AlertService.createAlert(payload);
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save stock alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-[620px] max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800/90 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-100 overflow-hidden relative animate-in zoom-in-95 duration-200">
        {/* ─── 1. COMPACT ENTERPRISE HEADER ─── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {existingAlert ? 'Edit Stock Alert' : 'Create Stock Alert'}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Market Data
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {symbol || 'TICKER'} • {quote?.name || (symbol === 'AAPL' ? 'Apple Inc.' : 'Asset Name')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── 2. SCROLLABLE FORM BODY ─── */}
        <form
          id="stock-alert-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 text-xs"
        >
          {/* Global Error Banner (if API fails) */}
          {error && (
            <div className="flex items-center gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Stock Information Card */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-slate-800 border border-indigo-500/30 flex items-center justify-center font-mono font-black text-sm text-indigo-300 shrink-0">
                {symbol.slice(0, 3) || 'STK'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {existingAlert ? (
                    <span className="font-mono font-bold text-sm text-white tracking-wide">
                      {symbol}
                    </span>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={symbol}
                        onChange={(e) => handleSymbolChange(e.target.value)}
                        placeholder="SYMBOL"
                        maxLength={10}
                        className="w-24 px-2 py-0.5 bg-slate-900 border border-slate-700 focus:border-emerald-500/80 rounded-md font-mono font-bold text-xs text-white uppercase outline-none transition"
                      />
                    </div>
                  )}
                  <span className="text-xs text-slate-300 font-semibold truncate max-w-[150px] sm:max-w-[220px]">
                    {quote?.name || (symbol === 'AAPL' ? 'Apple Inc.' : 'Asset Name')}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {quote?.currency || 'USD'} • Market Quote
                </p>
                {fieldErrors.symbol && (
                  <p className="text-[10px] text-rose-400 font-medium mt-0.5">
                    {fieldErrors.symbol}
                  </p>
                )}
              </div>
            </div>

            {/* Price & Change Pill */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/50">
              <div className="flex items-center gap-1.5 font-mono">
                {quoteLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {activePrice > 0 ? `${currencySymbol}${activePrice.toFixed(2)}` : '—'}
                  </span>
                )}
              </div>
              {quote?.changePercent !== undefined && (
                <div
                  className={`flex items-center gap-0.5 text-[11px] font-bold ${
                    quote.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {quote.changePercent >= 0 ? (
                    <TrendingUp className="w-3 h-3 stroke-[2.5]" />
                  ) : (
                    <TrendingDown className="w-3 h-3 stroke-[2.5]" />
                  )}
                  <span>
                    {quote.changePercent >= 0 ? '+' : ''}
                    {quote.changePercent.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Alert Condition 2-Column Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Alert Condition
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Select trigger rule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALERT_CONDITIONS.map((cond) => {
                const Icon = cond.icon;
                const isSelected = alertType === cond.type;
                return (
                  <button
                    key={cond.type}
                    type="button"
                    onClick={() => handleConditionSelect(cond.type)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition relative cursor-pointer ${
                      isSelected
                        ? `${cond.borderColor} ${cond.bgActive} ring-1 ring-emerald-500/30 text-white shadow-sm`
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isSelected ? 'bg-slate-900 border border-slate-700' : 'bg-slate-900/60'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${cond.accentColor}`} />
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold leading-none text-slate-100">
                          {cond.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                        {cond.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute right-2.5 top-2.5 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Condition Input & Preset Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                {inputConfig.label}
              </label>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 hidden sm:inline">Presets:</span>
                {alertType === 'PRICE_ABOVE' && (
                  <>
                    {[2, 5, 10, 15].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePresetSelect(pct)}
                        className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800/80 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700/60 transition cursor-pointer"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </>
                )}
                {alertType === 'PRICE_BELOW' && (
                  <>
                    {[2, 5, 10, 15].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePresetSelect(pct)}
                        className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/60 transition cursor-pointer"
                      >
                        -{pct}%
                      </button>
                    ))}
                  </>
                )}
                {(alertType === 'PERCENT_CHANGE_UP' || alertType === 'PERCENT_CHANGE_DOWN') && (
                  <>
                    {[2, 5, 10, 15].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePresetSelect(pct)}
                        className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800/80 hover:bg-teal-500/20 text-slate-300 hover:text-teal-300 border border-slate-700/60 transition cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </>
                )}
                {alertType === 'VOLUME_ABOVE' && (
                  <>
                    {[1.5, 2.0, 3.0, 5.0].map((mult) => (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => handlePresetSelect(mult.toFixed(2))}
                        className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700/60 transition cursor-pointer"
                      >
                        {mult}×
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Input Box with Units */}
            <div className="relative flex items-center">
              {inputConfig.prefix && (
                <span className="absolute left-3.5 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                  {inputConfig.prefix}
                </span>
              )}
              <input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => {
                  setThreshold(e.target.value);
                  if (fieldErrors.threshold) {
                    setFieldErrors((prev) => ({ ...prev, threshold: undefined }));
                  }
                }}
                placeholder={inputConfig.placeholder}
                className={`w-full ${
                  inputConfig.prefix ? 'pl-8' : 'pl-3.5'
                } pr-16 py-2 bg-slate-950 border ${
                  fieldErrors.threshold
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-800 focus:border-emerald-500/80'
                } rounded-xl text-white font-mono font-bold text-sm outline-none transition`}
                required
              />
              {inputConfig.suffix && (
                <span className="absolute right-3.5 text-[11px] font-mono font-semibold text-slate-500 pointer-events-none">
                  {inputConfig.suffix}
                </span>
              )}
            </div>

            {/* Field-Specific Validation Error */}
            {fieldErrors.threshold && (
              <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {fieldErrors.threshold}
              </p>
            )}

            {/* Current Price Reference Card */}
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    {alertType === 'VOLUME_ABOVE' ? 'Current Volume' : 'Current Price'}
                  </span>
                  <span className="font-mono font-semibold text-slate-200">
                    {currentPriceDisplay}
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Target
                  </span>
                  <span className="font-mono font-semibold text-slate-200">{targetDisplay}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Distance
                </span>
                <span className={`font-mono font-bold text-xs ${distanceColor}`}>
                  {distanceDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Notification Settings & Cooldown */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/70">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Notification Settings
              </label>
              <span className="text-[10px] text-slate-500">Multi-channel routing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
              {/* Notification Channels */}
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">
                  Notification channels
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    In-App
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    Email
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    Real-time
                  </span>
                </div>
              </div>

              {/* Cooldown Select */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-400">Cooldown</span>
                  <span className="text-[9px] text-slate-500">Anti-spam</span>
                </div>
                <div className="relative">
                  <select
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(parseInt(e.target.value, 10))}
                    className="w-full pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 focus:border-emerald-500/70 rounded-lg text-xs text-slate-200 outline-none appearance-none cursor-pointer transition"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour (Default)</option>
                    <option value={240}>4 hours</option>
                    <option value={1440}>24 hours</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Duplicate alerts are suppressed during this period.
            </p>
          </div>

          {/* Collapsible Additional Notes */}
          <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/30">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <span className="font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Additional Notes (Optional)
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  showNotes ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showNotes && (
              <div className="p-3 pt-1 border-t border-slate-800/50">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Rebalance portfolio if price crosses threshold..."
                  maxLength={250}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500/50 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none transition"
                />
              </div>
            )}
          </div>
        </form>

        {/* ─── 3. STICKY FOOTER ─── */}
        <div className="px-5 sm:px-6 py-3 bg-slate-900/95 border-t border-slate-800/80 flex items-center justify-end gap-2.5 shrink-0 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="stock-alert-form"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 shadow-md shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>{existingAlert ? 'Save Changes' : 'Create Alert'}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
