import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header.tsx';
import { AnalyticsService } from '../services/analytics.service.ts';
import { DashboardAnalyticsResponse } from '../types/analytics.ts';
import { DashboardKPICards } from '../components/dashboard/DashboardKPICards.tsx';
import { IncomeExpenseChart } from '../components/dashboard/IncomeExpenseChart.tsx';
import { CategoryDistributionChart } from '../components/dashboard/CategoryDistributionChart.tsx';
import { DailySpendingChart } from '../components/dashboard/DailySpendingChart.tsx';
import { BurnRateSavingsWidget } from '../components/dashboard/BurnRateSavingsWidget.tsx';
import { TopCategoriesCard } from '../components/dashboard/TopCategoriesCard.tsx';
import { TopMerchantsCard } from '../components/dashboard/TopMerchantsCard.tsx';
import { LargestTransactionsCard } from '../components/dashboard/LargestTransactionsCard.tsx';
import { RecentTransactionsCard } from '../components/dashboard/RecentTransactionsCard.tsx';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton.tsx';
import { RotateCw, PlusCircle, TrendingUp, AlertCircle, Sparkles, Layers } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await AnalyticsService.getDashboardAnalytics();
      setData(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch financial analytics';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Financial Intelligence Dashboard
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3 h-3" />
                Live Real-Time
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Complete wealth analysis, cash flow velocity, burn rate, and category distributions
              calculated from real database records
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              title="Refresh Analytics"
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <Link
              to="/transactions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add / Manage Txns</span>
            </Link>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchAnalytics()}
              className="underline font-semibold hover:text-rose-200 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && <DashboardSkeleton />}

        {/* Main Dashboard Content */}
        {!loading && data && (
          <div className="space-y-6">
            {/* Zero State Alert Banner if no transactions exist */}
            {data.kpis.totalIncome === 0 && data.kpis.totalExpenses === 0 && (
              <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <Sparkles className="w-4 h-4" />
                      Get Started with SmartFin AI
                    </div>
                    <p className="text-xs text-slate-300">
                      You haven&apos;t recorded any income or expenses yet. Add your initial
                      paycheck, investments, or expenses to trigger automated AI analytics.
                    </p>
                  </div>
                  <Link
                    to="/transactions"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Record First Transaction
                  </Link>
                </div>
              </div>
            )}

            {/* 1. KPI Cards (Total Balance, Income, Expenses, Savings, Burn Rate, YTD, MoM) */}
            <DashboardKPICards kpis={data.kpis} />

            {/* 2. Primary Charts Grid: Cash Flow (2 cols) & Category Distribution (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <IncomeExpenseChart data={data.incomeVsExpense} />
              </div>
              <div className="lg:col-span-1">
                <CategoryDistributionChart
                  categories={data.categorySpending}
                  totalExpenses={data.kpis.totalExpenses}
                />
              </div>
            </div>

            {/* 3. Secondary Trends Grid: Daily Spending Velocity (2 cols) & Burn Rate / Runway (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DailySpendingChart data={data.dailySpending} />
              </div>
              <div className="lg:col-span-1">
                <BurnRateSavingsWidget kpis={data.kpis} />
              </div>
            </div>

            {/* 4. Deep Intelligence & Breakdown Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <TopCategoriesCard categories={data.categorySpending} />
              <TopMerchantsCard merchants={data.topMerchants} />
              <LargestTransactionsCard transactions={data.largestTransactions} />
              <RecentTransactionsCard transactions={data.recentTransactions} />
            </div>

            {/* Quick Navigation Footer Strip */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Need to inspect individual line-item transactions or export ledgers?</span>
              </div>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                <span>Go to Transactions Management</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
