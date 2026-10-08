import React from 'react';
import { Budget } from '../../types/budget.ts';
import { Tag, AlertTriangle, Edit2, Trash2, Bell, CheckCircle, Flame } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface CategoryBudgetCardProps {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
}

export const CategoryBudgetCard: React.FC<CategoryBudgetCardProps> = ({
  budget,
  onEdit,
  onDelete,
}) => {
  const { currency: userCurrency, format } = useCurrency();
  const formatCurrency = (val: number) => {
    return format(val, { currency: budget.currency || userCurrency });
  };

  const usagePercent = Math.min(100, Math.max(0, budget.percentageUsed));
  const isOverspent = budget.isOverspent;
  const isWarning = budget.status === 'WARNING';

  return (
    <div
      className={`p-5 rounded-2xl bg-slate-900/70 border transition-all duration-200 flex flex-col justify-between shadow-lg relative group ${
        isOverspent
          ? 'border-rose-500/40 hover:border-rose-500/70 bg-gradient-to-b from-rose-950/20 to-slate-900/90'
          : isWarning
            ? 'border-amber-500/40 hover:border-amber-500/70'
            : 'border-slate-800/80 hover:border-slate-700'
      }`}
    >
      <div>
        {/* Header: Category Icon, Name, and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
              style={{
                backgroundColor: `${budget.category?.color || '#10B981'}20`,
                borderColor: `${budget.category?.color || '#10B981'}40`,
                borderWidth: '1px',
              }}
            >
              <Tag className="w-5 h-5" style={{ color: budget.category?.color || '#10B981' }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate group-hover:text-emerald-400 transition">
                {budget.name || budget.category?.name || 'Category Budget'}
              </h3>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{budget.category?.name || 'Expense'}</span>
                <span>•</span>
                <span className="uppercase text-[10px] font-mono text-slate-500 font-semibold">
                  {budget.period}
                </span>
                {(budget.notifyAt80 || budget.notifyAt100) && (
                  <>
                    <span>•</span>
                    <span title="Alerts active" className="text-slate-400">
                      <Bell className="w-3 h-3 inline text-emerald-400/80" />
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {isOverspent ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                <Flame className="w-3 h-3" />
                Overspent
              </span>
            ) : isWarning ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3" />
                Warning (80%+)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" />
                On Track
              </span>
            )}
          </div>
        </div>

        {/* Example Metric Breakdown: Budget, Spent, Remaining, Usage */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-400 text-[11px]">Budget Limit:</span>
            <div className="text-sm font-bold text-white font-mono">
              {formatCurrency(budget.amount)}
            </div>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-slate-400 text-[11px]">Actual Spent:</span>
            <div
              className={`text-sm font-bold font-mono ${
                isOverspent ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {formatCurrency(budget.spent)}
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400 text-[11px]">Remaining:</span>
            <div
              className={`text-sm font-bold font-mono ${
                budget.remaining > 0 ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {formatCurrency(budget.remaining)}
            </div>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-slate-400 text-[11px]">Usage:</span>
            <div
              className={`text-sm font-bold font-mono ${
                isOverspent ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {budget.percentageUsed.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Progress Bar & Indicators */}
        <div className="mt-3.5 space-y-1.5">
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800/80 relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverspent
                  ? 'bg-rose-500'
                  : isWarning
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
            {/* 80% Threshold Marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/40"
              style={{ left: '80%' }}
              title="80% Warning Threshold"
            />
          </div>

          {/* Overspending banner if overspent */}
          {isOverspent && (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center justify-between font-semibold mt-2">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Overspent by {formatCurrency(budget.overspentAmount)}
              </span>
              <span className="font-mono">{budget.percentageUsed.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-500">
          {isOverspent
            ? 'Exceeded budget limit'
            : `${(100 - budget.percentageUsed).toFixed(1)}% available`}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(budget)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Edit Budget Limit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(budget)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            title="Delete Budget"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
