import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, X, Loader2, ArrowRight } from 'lucide-react';
import { StockService } from '../../services/stock.service.ts';
import { StockSearchResult } from '../../types/stock.ts';

// Equities with registered ML models from Prompt 15 & 16
export const ML_TRAINED_TICKERS = [
  { symbol: 'TCS', name: 'Tata Consultancy Services', hasModels: true },
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', hasModels: true },
  { symbol: 'INFY', name: 'Infosys Limited', hasModels: true },
];

export const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL'];

interface StockSearchProps {
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  className?: string;
  placeholder?: string;
}

export const StockSearch: React.FC<StockSearchProps> = ({
  currentSymbol,
  onSelectSymbol,
  className = '',
  placeholder = 'Search by ticker symbol or company name (e.g. TCS, RELIANCE, AAPL)...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await StockService.search(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = (sym: string) => {
    onSelectSymbol(sym.trim().toUpperCase());
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`space-y-3 ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner font-sans transition"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Autocomplete Dropdown */}
        {isOpen && (query.trim().length > 0 || results.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
            {isSearching ? (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Searching market directory...</span>
              </div>
            ) : results.length > 0 ? (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                {results.map((item) => {
                  const isMLTrained = ML_TRAINED_TICKERS.some(
                    (m) => m.symbol.toUpperCase() === item.symbol.toUpperCase(),
                  );

                  return (
                    <button
                      key={item.symbol}
                      onClick={() => handleSelect(item.symbol)}
                      className="w-full text-left p-3 hover:bg-slate-800/70 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-white text-sm">
                          {item.symbol}
                        </span>
                        <span className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                          {item.name}
                        </span>
                        {item.exchange && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {item.exchange}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isMLTrained && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Sparkles className="w-3 h-3" />
                            ML Models Available
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching ticker found. Press Enter to search anyway.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Select Tickers */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          Trained ML Models:
        </span>
        {ML_TRAINED_TICKERS.map((t) => {
          const isSelected = currentSymbol.toUpperCase() === t.symbol.toUpperCase();
          return (
            <button
              key={t.symbol}
              onClick={() => onSelectSymbol(t.symbol)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-xs transition border cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20 font-bold'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-emerald-500/30 text-slate-300 hover:text-white'
              }`}
            >
              <span>{t.symbol}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          );
        })}

        <span className="text-slate-500 text-[11px] font-medium ml-2">Popular:</span>
        {POPULAR_TICKERS.map((sym) => {
          const isSelected = currentSymbol.toUpperCase() === sym.toUpperCase();
          return (
            <button
              key={sym}
              onClick={() => onSelectSymbol(sym)}
              className={`px-2 py-0.5 rounded-lg font-mono text-[11px] transition border cursor-pointer ${
                isSelected
                  ? 'bg-slate-700 text-white border-slate-500 font-bold'
                  : 'bg-slate-900/50 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sym}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StockSearch;
