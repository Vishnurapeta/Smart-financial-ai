import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header.tsx';
import { StockSearch, ML_TRAINED_TICKERS, POPULAR_TICKERS } from '../../components/stocks/StockSearch.tsx';
import { PredictionDisclaimer } from '../../components/stocks/PredictionDisclaimer.tsx';
import { Sparkles, TrendingUp, ArrowRight, Cpu } from 'lucide-react';

export const StockSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('TCS');

  const handleSelect = (sym: string) => {
    setSelectedSymbol(sym);
    navigate(`/stocks/${sym}/prediction`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SmartFin AI Stock Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Search Equities &amp;{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
              Model Forecasts
            </span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Search thousands of global and Indian equities with real-time market data quotes, technical indicators, and leak-free machine learning price predictions.
          </p>
        </div>

        {/* Big Search Input */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md">
          <StockSearch
            currentSymbol={selectedSymbol}
            onSelectSymbol={handleSelect}
            placeholder="Type ticker symbol or company name (e.g. TCS, RELIANCE, INFY, AAPL, MSFT)..."
          />
        </div>

        {/* Featured ML Trained Models Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Pre-Trained Machine Learning Models (NIFTY 500)
            </h2>
            <span className="text-xs text-slate-400">Prompt 15 &amp; 16 Registered Catalog</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ML_TRAINED_TICKERS.map((item) => (
              <div
                key={item.symbol}
                onClick={() => handleSelect(item.symbol)}
                className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-emerald-500/30 hover:border-emerald-500/70 transition-all cursor-pointer group shadow-lg hover:shadow-emerald-500/10 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xl font-extrabold text-white font-mono group-hover:text-emerald-300 transition">
                      {item.symbol}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">{item.name}</p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse mt-1" />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-[11px] text-emerald-400 font-medium">
                    XGBoost, LSTM, RF Active
                  </span>
                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-emerald-400 transition font-semibold text-[11px]">
                    <span>Analyze</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Market Movers */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            Popular Large-Cap Equities
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {POPULAR_TICKERS.map((sym) => (
              <button
                key={sym}
                onClick={() => handleSelect(sym)}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white group-hover:text-cyan-300">
                    {sym}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Live Quotes</span>
              </button>
            ))}
          </div>
        </div>

        <PredictionDisclaimer compact={true} />
      </main>
    </div>
  );
};

export default StockSearchPage;
