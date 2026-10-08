import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header.tsx';
import { BudgetService } from '../services/budget.service.ts';
import {
  Budget,
  MonthlyBudgetSummary,
  BudgetHistoryPoint,
  MonthlyComparisonResult,
  CreateBudgetDTO,
  UpdateBudgetDTO,
} from '../types/budget.ts';
import { BudgetKPICards } from '../components/budgets/BudgetKPICards.tsx';
import { BudgetMonthSelector } from '../components/budgets/BudgetMonthSelector.tsx';
import { CategoryBudgetCard } from '../components/budgets/CategoryBudgetCard.tsx';
import { BudgetVsActualChart } from '../components/budgets/BudgetVsActualChart.tsx';
import { BudgetHistoryChart } from '../components/budgets/BudgetHistoryChart.tsx';
import { MonthlyComparisonSection } from '../components/budgets/MonthlyComparisonSection.tsx';
import { CreateBudgetModal } from '../components/budgets/CreateBudgetModal.tsx';
import { EditBudgetModal } from '../components/budgets/EditBudgetModal.tsx';
import { BudgetSkeleton } from '../components/budgets/BudgetSkeleton.tsx';
import {
  PlusCircle,
  RotateCw,
  GitCompare,
  AlertCircle,
  Target,
  Sparkles,
  BarChart2,
  ListFilter,
} from 'lucide-react';

export const BudgetsPage: React.FC = () => {
  const getInitialMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const [currentMonth, setCurrentMonth] = useState<string>(getInitialMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<MonthlyBudgetSummary | null>(null);
  const [history, setHistory] = useState<BudgetHistoryPoint[]>([]);
  const [comparison, setComparison] = useState<MonthlyComparisonResult | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);

  // Filter tab for budget cards: ALL | OVERSPENT | WARNING | ON_TRACK
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERSPENT' | 'WARNING' | 'ON_TRACK'>(
    'ALL',
  );

  const fetchBudgetData = useCallback(async (month: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [fetchedBudgets, fetchedSummary, fetchedHistory, fetchedComparison] = await Promise.all(
        [
          BudgetService.getBudgets(month),
          BudgetService.getBudgetSummary(month),
          BudgetService.getBudgetHistory(6),
          BudgetService.getMonthlyComparison(month),
        ],
      );

      setBudgets(fetchedBudgets);
      setSummary(fetchedSummary);
      setHistory(fetchedHistory);
      setComparison(fetchedComparison);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load budgeting data';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgetData(currentMonth);
  }, [currentMonth, fetchBudgetData]);

  const handleMonthChange = (newMonth: string) => {
    setCurrentMonth(newMonth);
  };

  const handleCreateSubmit = async (data: CreateBudgetDTO) => {
    await BudgetService.createBudget(data);
    await fetchBudgetData(currentMonth, true);
  };

  const handleEditSubmit = async (id: string, data: UpdateBudgetDTO) => {
    await BudgetService.updateBudget(id, data);
    await fetchBudgetData(currentMonth, true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBudget) return;
    try {
      await BudgetService.deleteBudget(deletingBudget._id);
      setDeletingBudget(null);
      await fetchBudgetData(currentMonth, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete budget';
      setError(msg);
    }
  };

  // Filtered budgets
  const filteredBudgets = budgets.filter((b) => {
    if (statusFilter === 'ALL') return true;
    return b.status === statusFilter;
  });

  const existingCategoryIds = budgets.map((b) => b.categoryId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header: Title, Month Selector, and CTAs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Monthly Budget & Expense Guard
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-3 h-3" />
                Real-Time Overspending Protection
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Track category budget limits, calculate real remaining amounts, and detect spending
              leaks
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Month Selector */}
            <BudgetMonthSelector currentMonth={currentMonth} onChange={handleMonthChange} />

            <button
              onClick={() => fetchBudgetData(currentMonth, true)}
              disabled={refreshing || loading}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              title="Refresh Budgets"
            >
              <RotateCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
            </button>

            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                showComparison
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:bg-slate-800'
              }`}
            >
              <GitCompare className="w-4 h-4 text-blue-400" />
              <span>{showComparison ? 'Hide Comparison' : 'Compare Months'}</span>
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Budget</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchBudgetData(currentMonth)}
              className="underline font-semibold hover:text-rose-200 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && <BudgetSkeleton />}

        {/* Loaded Content */}
        {!loading && summary && (
          <div className="space-y-6">
            {/* 1. Monthly Summary KPI Cards */}
            <BudgetKPICards summary={summary} />

            {/* 2. Optional Month-over-Month Comparison Section */}
            {showComparison && comparison && <MonthlyComparisonSection comparison={comparison} />}

            {/* 3. Visual Charts Grid: Category Budget vs Actual + Historical Trajectory */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BudgetVsActualChart budgets={budgets} />
              <BudgetHistoryChart history={history} />
            </div>

            {/* 4. Category Budgets Grid Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Category Budgets ({budgets.length})
                    </h2>
                    <p className="text-xs text-slate-400">
                      Calculated from real transaction outflows for {summary.label}
                    </p>
                  </div>
                </div>

                {/* Filter Pills */}
                {budgets.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1 rounded-xl text-xs">
                    <span className="px-2 text-slate-500 text-[11px] flex items-center gap-1">
                      <ListFilter className="w-3 h-3" />
                      Filter:
                    </span>
                    {(['ALL', 'OVERSPENT', 'WARNING', 'ON_TRACK'] as const).map((filterVal) => (
                      <button
                        key={filterVal}
                        onClick={() => setStatusFilter(filterVal)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          statusFilter === filterVal
                            ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {filterVal === 'ALL'
                          ? 'All'
                          : filterVal === 'OVERSPENT'
                            ? 'Overspent'
                            : filterVal === 'WARNING'
                              ? '80%+ Alert'
                              : 'On Track'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Zero State if no budgets exist for month */}
              {budgets.length === 0 ? (
                <div className="p-10 rounded-3xl bg-slate-900/50 border border-slate-800/80 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
                    <Target className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="text-base font-bold text-white">
                      No Category Budgets Set for {summary.label}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Establish category spending targets (e.g. Food, Utilities, Entertainment) to
                      activate automated overspending detection and variance tracking.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Your First Budget</span>
                  </button>
                </div>
              ) : filteredBudgets.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No category budgets match the filter &quot;{statusFilter}&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredBudgets.map((b) => (
                    <CategoryBudgetCard
                      key={b._id}
                      budget={b}
                      onEdit={(budgetToEdit) => setEditingBudget(budgetToEdit)}
                      onDelete={(budgetToDelete) => setDeletingBudget(budgetToDelete)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      <CreateBudgetModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        defaultMonth={currentMonth}
        existingCategoryIds={existingCategoryIds}
      />

      {/* Edit Modal */}
      <EditBudgetModal
        isOpen={!!editingBudget}
        budget={editingBudget}
        onClose={() => setEditingBudget(null)}
        onSubmit={handleEditSubmit}
      />

      {/* Delete Confirmation Modal */}
      {deletingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Delete Budget</h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete the budget for{' '}
              <span className="text-white font-semibold">
                {deletingBudget.name || deletingBudget.category?.name}
              </span>
              ? Your existing transactions will not be deleted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingBudget(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
