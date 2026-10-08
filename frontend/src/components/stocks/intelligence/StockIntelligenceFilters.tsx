import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Target,
} from 'lucide-react';

export interface FilterState {
  search: string;
  sector: string;
  horizon: number;
  direction: string;
  return_range: string;
  min_return?: number;
  max_return?: number;
  model: string;
  sort: string;
  preset: string;
}

interface Props {
  filters: FilterState;
  onChange: (updated: Partial<FilterState>) => void;
  onReset: () => void;
  availableSectors?: string[];
}

const DEFAULT_SECTORS = [
  'All Sectors',
  'IT',
  'Banking',
  'Financial Services',
  'Energy',
  'Pharmaceuticals',
  'Automobile',
  'FMCG',
  'Telecom',
  'Infrastructure',
  'Manufacturing',
  'Chemicals',
  'Consumer Goods',
  'Metals & Mining',
  'Healthcare',
];

const PRESETS = [
  { id: 'top_gainers', label: 'Top AI Gainers', icon: TrendingUp, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { id: 'top_losers', label: 'Potential Decliners', icon: TrendingDown, color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { id: 'bullish', label: 'Strong Bullish', icon: Sparkles, color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  { id: 'bearish', label: 'Bearish Signals', icon: TrendingDown, color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  { id: 'highest_accuracy', label: 'Highest Accuracy', icon: Target, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  { id: 'it_opportunities', label: 'IT Sector', icon: Sparkles, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  { id: 'banking_opportunities', label: 'Banking Sector', icon: Sparkles, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  { id: 'energy_opportunities', label: 'Energy Sector', icon: Sparkles, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { id: 'most_reliable', label: 'Most Reliable', icon: ShieldCheck, color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
];

export const StockIntelligenceFilters: React.FC<Props> = ({
  filters,
  onChange,
  onReset,
  availableSectors = DEFAULT_SECTORS,
}) => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [customMin, setCustomMin] = useState<string>('');
  const [customMax, setCustomMax] = useState<string>('');

  const handlePresetClick = (presetId: string) => {
    if (filters.preset === presetId) {
      onChange({ preset: '' });
    } else {
      onChange({ preset: presetId });
    }
  };

  const handleCustomReturnApply = () => {
    const minVal = customMin !== '' ? parseFloat(customMin) : undefined;
    const maxVal = customMax !== '' ? parseFloat(customMax) : undefined;
    onChange({ min_return: minVal, max_return: maxVal, return_range: '' });
  };

  return (
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-2xl p-4 mb-6 backdrop-blur-xl shadow-lg">
      {/* 1. Quick Screener Presets Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-gray-700/60 mb-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Quick Presets:
        </span>
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const isActive = filters.preset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handlePresetClick(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 shrink-0 transition-all ${
                isActive
                  ? `${p.color} ring-1 ring-cyan-400/50 shadow-sm font-semibold`
                  : 'border-gray-700 bg-gray-900/60 text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* 2. Main Search & Primary Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search Box */}
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search ticker, company name, sector..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full bg-gray-900/80 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Sector Filter */}
        <div className="md:col-span-3">
          <select
            value={filters.sector || 'All Sectors'}
            onChange={(e) => onChange({ sector: e.target.value === 'All Sectors' ? '' : e.target.value })}
            aria-label="Filter by Sector"
            className="w-full bg-gray-900/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
          >
            {availableSectors.map((sec) => (
              <option key={sec} value={sec} className="bg-gray-900 text-white">
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Horizon Tabs (1D, 5D, 20D) */}
        <div className="md:col-span-3 flex bg-gray-900/90 border border-gray-700 rounded-xl p-1">
          {[
            { h: 1, label: '1 Day' },
            { h: 5, label: '5 Days' },
            { h: 20, label: '20 Days' },
          ].map((item) => (
            <button
              key={item.h}
              onClick={() => onChange({ horizon: item.h })}
              className={`flex-1 py-1 px-2 text-xs font-semibold rounded-lg transition-all ${
                filters.horizon === item.h
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="md:col-span-2">
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
            aria-label="Sort Stock Results"
            className="w-full bg-gray-900/80 border border-gray-700 rounded-xl px-2.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors font-medium"
          >
            <option value="expected_return_desc">Expected Return ↓</option>
            <option value="expected_return_asc">Expected Return ↑</option>
            <option value="predicted_price_desc">Predicted Price ↓</option>
            <option value="predicted_price_asc">Predicted Price ↑</option>
            <option value="current_price_desc">Current Price ↓</option>
            <option value="accuracy_desc">Historical Accuracy ↓</option>
            <option value="accuracy_asc">Historical Accuracy ↑</option>
            <option value="symbol_asc">Stock Symbol (A-Z)</option>
            <option value="sector_asc">Sector (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 3. Advanced Filter Toggle Bar */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-medium text-gray-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters (Direction, Range, Model)'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={onReset}
          className="text-xs font-medium text-gray-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset All Filters
        </button>
      </div>

      {/* 4. Advanced Filters Panel */}
      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-gray-700/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in fade-in duration-200">
          {/* Direction Filter */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Direction Filter</label>
            <select
              value={filters.direction || 'All'}
              onChange={(e) => onChange({ direction: e.target.value === 'All' ? '' : e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="All">All Directions</option>
              <option value="Bullish">🟢 Bullish (Return &gt; +2%)</option>
              <option value="Neutral">⚪ Neutral (-2% to +2%)</option>
              <option value="Bearish">🔴 Bearish (Return &lt; -2%)</option>
            </select>
          </div>

          {/* Return Range Preset */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Return Range Preset</label>
            <select
              value={filters.return_range || 'All'}
              onChange={(e) => onChange({ return_range: e.target.value === 'All' ? '' : e.target.value, min_return: undefined, max_return: undefined })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="All">All Return Ranges</option>
              <option value=">10">&gt; +10% High Gainer</option>
              <option value="5to10">+5% to +10% Strong Gain</option>
              <option value="2to5">+2% to +5% Moderate Gain</option>
              <option value="0to2">0% to +2% Low Gain</option>
              <option value="0to-2">0% to -2% Low Decline</option>
              <option value="-2to-5">-2% to -5% Moderate Decline</option>
              <option value="<-5">&lt; -5% Significant Decline</option>
            </select>
          </div>

          {/* Model Architecture Filter */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Production Model</label>
            <select
              value={filters.model || 'All'}
              onChange={(e) => onChange({ model: e.target.value === 'All' ? '' : e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="All">All Model Architectures</option>
              <option value="xgboost">XGBoost</option>
              <option value="random_forest">Random Forest</option>
              <option value="linear_regression">Linear Regression</option>
              <option value="lstm">LSTM Deep Learning</option>
              <option value="naive">Naive Baseline</option>
            </select>
          </div>

          {/* Custom Expected Return Min/Max */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Custom Return (%) Min / Max</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min %"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-200 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="number"
                placeholder="Max %"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                className="w-1/2 bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-200 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleCustomReturnApply}
                className="px-2.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
