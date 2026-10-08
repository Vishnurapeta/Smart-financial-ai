import React from 'react';
import { MonthlyComparisonResult } from '../../types/budget.ts';
import { ArrowUpRight, ArrowDownRight, GitCompare, Minus } from 'lucide-react';

interface MonthlyComparisonSectionProps {
  comparison: MonthlyComparisonResult;
}

export const MonthlyComparisonSection: React.FC<MonthlyComparisonSectionProps> = ({
  comparison,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-6">
      {/* Title & Overview Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <GitCompare className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Monthly Budget & Outflow Comparison
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Comparing <span className="text-white font-semibold">{comparison.month1.label}</span>{' '}
            vs. <span className="text-white font-semibold">{comparison.month2.label}</span>
          </p>
        </div>

        {/* Change Indicators */}
        <div className="flex items-center gap-3">
          {/* Spend Change */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs">
            <span className="text-slate-400">Spend Variance:</span>
            <span
              className={`inline-flex items-center gap-0.5 font-bold font-mono ${
                comparison.spendChange <= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {comparison.spendChange > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : comparison.spendChange < 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              {formatCurrency(Math.abs(comparison.spendChange))} (
              {formatPercent(comparison.spendChangePercent)})
            </span>
          </div>

          {/* Budget Change */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs">
            <span className="text-slate-400">Budget Limit Δ:</span>
            <span
              className={`inline-flex items-center gap-0.5 font-bold font-mono ${
                comparison.budgetChange >= 0 ? 'text-blue-400' : 'text-slate-300'
              }`}
            >
              {formatPercent(comparison.budgetChangePercent)}
            </span>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      {comparison.categories.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
          No categories found to compare between these two periods
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">{comparison.month1.label} Budget</th>
                <th className="py-3 px-4 text-right">{comparison.month1.label} Spent</th>
                <th className="py-3 px-4 text-right">{comparison.month2.label} Spent</th>
                <th className="py-3 px-4 text-right">Spend Variance</th>
                <th className="py-3 px-4 text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {comparison.categories.map((c) => {
                const spentDecreased = c.spendDifference < 0;
                const spentIncreased = c.spendDifference > 0;
                return (
                  <tr key={c.categoryId} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color || '#10b981' }}
                      />
                      <span className="font-semibold text-white">{c.categoryName}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {formatCurrency(c.month1Budget)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                      {formatCurrency(c.month1Spent)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {formatCurrency(c.month2Spent)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        spentDecreased
                          ? 'text-emerald-400'
                          : spentIncreased
                            ? 'text-rose-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {c.spendDifference > 0 ? '+' : ''}
                      {formatCurrency(c.spendDifference)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          spentDecreased
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : spentIncreased
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {spentDecreased ? (
                          <>
                            <ArrowDownRight className="w-3 h-3" />
                            Saved {Math.abs(c.spendChangePercent)}%
                          </>
                        ) : spentIncreased ? (
                          <>
                            <ArrowUpRight className="w-3 h-3" />+{c.spendChangePercent}%
                          </>
                        ) : (
                          'No Change'
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
