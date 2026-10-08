import React from 'react';
import { CategorySpendingItem } from '../../types/analytics.ts';
import { Layers, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TopCategoriesCardProps {
  categories: CategorySpendingItem[];
}

export const TopCategoriesCard: React.FC<TopCategoriesCardProps> = ({ categories }) => {
  const topList = categories.slice(0, 5);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Top Spending Categories
            </h2>
          </div>
          <Link
            to="/transactions"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-xs text-slate-400 mb-4">Ranked by total outflow volume</p>

        {topList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
            No category spending recorded yet
          </div>
        ) : (
          <div className="space-y-3.5">
            {topList.map((cat, idx) => (
              <div key={cat.categoryId || idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || '#10b981' }}
                    />
                    <span className="font-medium text-white truncate max-w-[140px] sm:max-w-[170px]">
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({cat.transactionCount} {cat.transactionCount === 1 ? 'txn' : 'txns'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-200">{formatCurrency(cat.amount)}</span>
                    <span className="text-[11px] text-emerald-400 w-10 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Relative progress bar */}
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, cat.percentage))}%`,
                      backgroundColor: cat.color || '#10b981',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
