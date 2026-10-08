import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header.tsx';
import { StockHeader } from '../../components/stocks/StockHeader.tsx';
import { StockSearch } from '../../components/stocks/StockSearch.tsx';
import { PriceChart } from '../../components/stocks/PriceChart.tsx';
import { PredictionDisclaimer } from '../../components/stocks/PredictionDisclaimer.tsx';
import { CreateAlertModal } from '../../components/stocks/CreateAlertModal.tsx';
import { StockService } from '../../services/stock.service.ts';
import { StockPredictionService } from '../../services/stockPrediction.service.ts';
import { WatchlistService } from '../../services/watchlist.service.ts';
import { MarketQuote, HistoricalDataResult } from '../../types/stock.ts';
import { StockPredictionResponse } from '../../types/stockPrediction.ts';
import {
  ArrowLeft,
  Sparkles,
  ArrowRight,
  Cpu,
} from 'lucide-react';

export const StockDetailsPage: React.FC = () => {
  const { symbol = 'TCS' } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<string>('3mo');
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [historyBars, setHistoryBars] = useState<HistoricalDataResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [prediction, setPrediction] = useState<StockPredictionResponse | null>(null);
  const [predLoading, setPredLoading] = useState<boolean>(false);

  // Modals & toast
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cleanSymbol = symbol.trim().toUpperCase();

  // Load quote and historical data
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const [q, h] = await Promise.all([
          StockService.getQuote(cleanSymbol).catch(() => null),
          StockService.getHistory(cleanSymbol, timeframe).catch(() => null),
        ]);
        if (!cancelled) {
          setQuote(q);
          setHistoryBars(h);
        }
      } catch (err) {
        console.warn('Failed loading stock details:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [cleanSymbol, timeframe]);

  // Load quick prediction summary
  useEffect(() => {
    let cancelled = false;

    const loadQuickPrediction = async () => {
      setPredLoading(true);
      try {
        const pred = await StockPredictionService.predict({
          symbol: cleanSymbol,
          horizon: 1,
          target: 'target_next_return',
          allow_candidate: true,
        });
        if (!cancelled) {
          setPrediction(pred);
        }
      } catch {
        if (!cancelled) setPrediction(null);
      } finally {
        if (!cancelled) setPredLoading(false);
      }
    };

    loadQuickPrediction();
    return () => {
      cancelled = true;
    };
  }, [cleanSymbol]);

  const handleAddToWatchlist = async () => {
    try {
      const watchlists = await WatchlistService.getWatchlists();
      if (watchlists.length > 0) {
        await WatchlistService.addSymbol(watchlists[0].id, { symbol: cleanSymbol });
        setToastMessage(`Added ${cleanSymbol} to your watchlist!`);
      } else {
        const created = await WatchlistService.createWatchlist({ name: 'My Watchlist' });
        await WatchlistService.addSymbol(created.id, { symbol: cleanSymbol });
        setToastMessage(`Created watchlist and added ${cleanSymbol}!`);
      }
    } catch {
      setToastMessage(`Could not add ${cleanSymbol} to watchlist.`);
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const isIndianTicker =
    cleanSymbol.includes('.NS') ||
    cleanSymbol.includes('.BO') ||
    ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'ITC', 'LT', 'SBIN'].includes(
      cleanSymbol,
    );
  const currencySymbol = isIndianTicker ? '₹' : '$';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => navigate('/stocks')}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Stocks Directory</span>
            </button>
            <span className="text-slate-600">/</span>
            <span className="font-semibold text-white font-mono">{cleanSymbol}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Overview</span>
          </div>

          <button
            onClick={() => navigate(`/stocks/${cleanSymbol}/prediction`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold hover:from-emerald-400 hover:to-teal-300 transition shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open AI Prediction Analysis</span>
          </button>
        </div>

        {/* Search */}
        <StockSearch
          currentSymbol={cleanSymbol}
          onSelectSymbol={(sym) => navigate(`/stocks/${sym}`)}
        />

        {/* Stock Header */}
        <StockHeader
          symbol={cleanSymbol}
          quote={quote}
          loading={loading}
          onRefresh={() => {
            setLoading(true);
            StockService.getQuote(cleanSymbol).then(setQuote).finally(() => setLoading(false));
          }}
          onOpenAlertModal={() => setIsAlertModalOpen(true)}
          onAddToWatchlist={handleAddToWatchlist}
          onJumpToPrediction={() => navigate(`/stocks/${cleanSymbol}/prediction`)}
        />

        {toastMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
            {toastMessage}
          </div>
        )}

        {/* AI Prediction Quick Preview Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">Machine Learning Forecast Preview</h3>
              {prediction?.model_status && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {prediction.model_status}
                </span>
              )}
            </div>

            {predLoading ? (
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                Querying registered prediction models...
              </p>
            ) : prediction ? (
              <div className="flex items-center gap-4 text-xs font-mono pt-1">
                <div>
                  <span className="text-slate-400 font-sans text-[11px] block">Model:</span>
                  <span className="font-bold text-white">{prediction.model_name} (h=1d)</span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans text-[11px] block">Est. Return:</span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      prediction.predicted_return >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {prediction.predicted_return >= 0 ? '+' : ''}
                    {(prediction.predicted_return * 100).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans text-[11px] block">Price Target:</span>
                  <span className="font-bold text-emerald-300">
                    {currencySymbol}
                    {prediction.predicted_value.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Explore chronological multi-model forecasts (XGBoost, LSTM, Random Forest) with historical metrics.
              </p>
            )}
          </div>

          <div>
            <button
              onClick={() => navigate(`/stocks/${cleanSymbol}/prediction`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold border border-emerald-500/40 hover:border-emerald-500 transition shadow-lg cursor-pointer"
            >
              <span>Full Prediction Deep-Dive</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Historical Price Chart with Technical Indicators */}
        <PriceChart
          symbol={cleanSymbol}
          bars={historyBars?.bars || []}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          currencySymbol={currencySymbol}
          loading={loading}
        />

        {/* Regulatory Disclaimer */}
        <PredictionDisclaimer compact={true} />
      </main>

      {/* Alert Modal */}
      {isAlertModalOpen && (
        <CreateAlertModal
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          initialSymbol={cleanSymbol}
          currentPrice={quote?.currentPrice}
          onSuccess={() => {
            setIsAlertModalOpen(false);
            setToastMessage(`Price alert created for ${cleanSymbol}!`);
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
};

export default StockDetailsPage;
