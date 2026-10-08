import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-slate-800 rounded-lg" />
          <div className="h-4 w-96 bg-slate-800/60 rounded" />
        </div>
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
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-8 w-8 bg-slate-800 rounded-xl" />
            </div>
            <div className="h-7 w-36 bg-slate-800 rounded-lg" />
            <div className="h-4 w-48 bg-slate-800/50 rounded" />
          </div>
        ))}
      </div>

      {/* Secondary KPI Strip Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2"
          >
            <div className="h-3 w-28 bg-slate-800 rounded" />
            <div className="h-6 w-32 bg-slate-800 rounded" />
            <div className="h-2 w-full bg-slate-800/50 rounded-full" />
          </div>
        ))}
      </div>

      {/* Main Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="h-5 w-48 bg-slate-800 rounded" />
          <div className="h-72 w-full bg-slate-800/30 rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="h-5 w-40 bg-slate-800 rounded" />
          <div className="h-72 w-full bg-slate-800/30 rounded-xl" />
        </div>
      </div>

      {/* Trend & Burn-Rate Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="h-5 w-52 bg-slate-800 rounded" />
          <div className="h-64 w-full bg-slate-800/30 rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="h-5 w-36 bg-slate-800 rounded" />
          <div className="h-64 w-full bg-slate-800/30 rounded-xl" />
        </div>
      </div>

      {/* Bottom Grids Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4"
          >
            <div className="h-5 w-36 bg-slate-800 rounded" />
            <div className="space-y-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-10 w-full bg-slate-800/40 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
