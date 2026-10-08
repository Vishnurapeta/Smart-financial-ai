import React, { useState } from 'react';
import {
  Category,
  PaymentMethod,
  TransactionFiltersState,
  TransactionType,
} from '../../types/transaction.ts';
import {
  Search,
  Filter,
  X,
  RotateCcw,
  ArrowUpDown,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TransactionFiltersProps {
  filters: TransactionFiltersState;
  categories: Category[];
  onFilterChange: (newFilters: Partial<TransactionFiltersState>) => void;
  onResetFilters: () => void;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  categories,
  onFilterChange,
  onResetFilters,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const paymentMethods: PaymentMethod[] = [
    'CREDIT_CARD',
    'DEBIT_CARD',
    'BANK_TRANSFER',
    'CASH',
    'CRYPTO',
    'OTHER',
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      {/* Top Bar: Search, Type Tabs & Advanced Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search merchant, description, notes, or tags..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '', page: 1 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
          {[
            { label: 'All', value: '' },
            { label: 'Income', value: 'INCOME' },
            { label: 'Expense', value: 'EXPENSE' },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => onFilterChange({ type: tab.value as TransactionType | '', page: 1 })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                (filters.type || '') === tab.value
                  ? tab.value === 'INCOME'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : tab.value === 'EXPENSE'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Advanced Filters Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              isAdvancedOpen
                ? 'bg-slate-800 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={onResetFilters}
            className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
            title="Reset All Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Advanced Filter Drawdown */}
      {isAdvancedOpen && (
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Category Dropdown */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Category
            </label>
            <select
              value={filters.category || ''}
              onChange={(e) => onFilterChange({ category: e.target.value, page: 1 })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Payment Method
            </label>
            <select
              value={filters.paymentMethod || ''}
              onChange={(e) =>
                onFilterChange({
                  paymentMethod: e.target.value as PaymentMethod | '',
                  page: 1,
                })
              }
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Payment Methods</option>
              {paymentMethods.map((pm) => (
                <option key={pm} value={pm}>
                  {pm.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" /> Start Date
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => onFilterChange({ startDate: e.target.value, page: 1 })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" /> End Date
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => onFilterChange({ endDate: e.target.value, page: 1 })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
            />
          </div>

          {/* Amount Range */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" /> Min Amount
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={filters.minAmount ?? ''}
              onChange={(e) =>
                onFilterChange({
                  minAmount: e.target.value ? parseFloat(e.target.value) : '',
                  page: 1,
                })
              }
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" /> Max Amount
            </label>
            <input
              type="number"
              placeholder="10000.00"
              value={filters.maxAmount ?? ''}
              onChange={(e) =>
                onFilterChange({
                  maxAmount: e.target.value ? parseFloat(e.target.value) : '',
                  page: 1,
                })
              }
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Sort By & Order */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-emerald-400" /> Sort By
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  onFilterChange({
                    sortBy: e.target.value as TransactionFiltersState['sortBy'],
                    page: 1,
                  })
                }
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="merchant">Merchant</option>
                <option value="createdAt">Created</option>
              </select>

              <select
                value={filters.sortOrder}
                onChange={(e) =>
                  onFilterChange({
                    sortOrder: e.target.value as TransactionFiltersState['sortOrder'],
                    page: 1,
                  })
                }
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="desc">Desc (High / New)</option>
                <option value="asc">Asc (Low / Old)</option>
              </select>
            </div>
          </div>

          {/* Recurring Filter Toggle */}
          <div className="space-y-1 flex flex-col justify-end">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-950/80 border border-slate-800 select-none">
              <input
                type="checkbox"
                checked={filters.recurring === true}
                onChange={(e) =>
                  onFilterChange({
                    recurring: e.target.checked ? true : undefined,
                    page: 1,
                  })
                }
                className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="text-xs">Recurring Only</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
