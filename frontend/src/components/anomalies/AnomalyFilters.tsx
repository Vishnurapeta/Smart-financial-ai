import React from 'react';
import { AnomalyFilters as FiltersType } from '../../types/anomaly.ts';

interface AnomalyFiltersProps {
  filters: FiltersType;
  onChange: (filters: Partial<FiltersType>) => void;
  onClear: () => void;
}

export const AnomalyFilters: React.FC<AnomalyFiltersProps> = ({
  filters,
  onChange,
  onClear,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
      <div className="flex flex-1 flex-wrap gap-3 items-center">
        {/* Merchant Search */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search merchant or category..."
            value={filters.merchant || filters.category || ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange({ merchant: val || undefined, category: undefined });
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status Filter */}
        <select
          value={filters.status || ''}
          onChange={(e) => onChange({ status: e.target.value || undefined })}
          className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="NEW">New for Review</option>
          <option value="CONFIRMED_UNUSUAL">Confirmed Unusual</option>
          <option value="REVIEWED">Expected Spending</option>
          <option value="DISMISSED">Dismissed</option>
        </select>

        {/* Severity Filter */}
        <select
          value={filters.severity || ''}
          onChange={(e) => onChange({ severity: e.target.value || undefined })}
          className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Severities</option>
          <option value="HIGH">High Unusualness</option>
          <option value="MEDIUM">Medium Unusualness</option>
          <option value="LOW">Low Unusualness</option>
        </select>

        {/* Anomaly Type Filter */}
        <select
          value={filters.anomalyType || ''}
          onChange={(e) => onChange({ anomalyType: e.target.value || undefined })}
          className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Anomaly Types</option>
          <option value="AMOUNT_ANOMALY">Amount Outlier</option>
          <option value="CATEGORY_ANOMALY">Category Pattern</option>
          <option value="MERCHANT_ANOMALY">Merchant Outlier</option>
          <option value="FREQUENCY_ANOMALY">Burst Frequency</option>
        </select>
      </div>

      {/* Clear Button */}
      {(filters.status || filters.severity || filters.anomalyType || filters.merchant || filters.category) && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline whitespace-nowrap self-end md:self-center"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
};
