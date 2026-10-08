import React from 'react';

export const BudgetSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Month Selector & Controls Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-10 w-48 bg-slate-800 rounded-2xl" />
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-slate-800 rounded-xl" />
          <div className="h-10 w-36 bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-28 bg-slate-800 rounded" />
              <div className="h-8 w-8 bg-slate-800 rounded-xl" />
            </div>
            <div className="h-7 w-32 bg-slate-800 rounded-lg" />
            <div className="h-3 w-40 bg-slate-800/50 rounded" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="h-5 w-48 bg-slate-800 rounded" />
          <div className="h-64 w-full bg-slate-800/30 rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="h-5 w-48 bg-slate-800 rounded" />
          <div className="h-64 w-full bg-slate-800/30 rounded-xl" />
        </div>
      </div>

      {/* Category Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-800 rounded-xl" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-32 bg-slate-800 rounded" />
                <div className="h-3 w-20 bg-slate-800/60 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="h-6 bg-slate-800/40 rounded" />
              <div className="h-6 bg-slate-800/40 rounded" />
            </div>
            <div className="h-2.5 w-full bg-slate-800/40 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
};
