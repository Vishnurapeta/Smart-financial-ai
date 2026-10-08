import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header.tsx';
import { FinancialSummaryCards } from '../components/transactions/FinancialSummaryCards.tsx';
import { TransactionFilters } from '../components/transactions/TransactionFilters.tsx';
import { TransactionTable } from '../components/transactions/TransactionTable.tsx';
import { TransactionModal } from '../components/transactions/TransactionModal.tsx';
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal.tsx';
import { NaturalLanguageTransactionBar } from '../components/transactions/NaturalLanguageTransactionBar.tsx';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { TransactionService } from '../services/transaction.service.ts';
import { AnomalyService } from '../services/anomaly.service.ts';
import { FinancialAnomaly } from '../types/anomaly.ts';
import {
  Category,
  CreateTransactionDTO,
  FinancialSummary,
  PaginationMetadata,
  Transaction,
  TransactionFiltersState,
  TransactionType,
} from '../types/transaction.ts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const initialFilters: TransactionFiltersState = {
  search: '',
  type: '',
  category: '',
  paymentMethod: '',
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  recurring: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  limit: 20,
};

export const TransactionsPage: React.FC = () => {
  const { currency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState<TransactionFiltersState>(initialFilters);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalDefaultType, setModalDefaultType] = useState<TransactionType>('EXPENSE');
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);
  const [anomaliesMap, setAnomaliesMap] = useState<Map<string, FinancialAnomaly>>(new Map());

  // Load anomalous transaction map to highlight unusual patterns
  useEffect(() => {
    AnomalyService.getAnomalies({ limit: 100 })
      .then((res) => {
        const map = new Map<string, FinancialAnomaly>();
        res.data?.forEach((a) => {
          if (a.transactionId) {
            map.set(String(a.transactionId), a);
          }
        });
        setAnomaliesMap(map);
      })
      .catch((err) => console.warn('Could not load anomalies map:', err));
  }, [transactions]);

  // Load Categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await TransactionService.getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch Transactions with current or overridden filters
  const fetchTransactions = useCallback(
    async (filtersToUse?: TransactionFiltersState, preserveTopTx?: Transaction) => {
      setIsLoading(transactions.length === 0);
      setError(null);
      const activeFilters = filtersToUse || filters;
      try {
        const data = await TransactionService.getTransactions(activeFilters);
        setTransactions((prev) => {
          const keepTx = preserveTopTx || (prev.length > 0 ? prev[0] : null);
          if (keepTx && !data.transactions.slice(0, 1).some((t) => t._id === keepTx._id)) {
            // Verify if keepTx satisfies active search and type filters
            const typeMatch = !activeFilters.type || keepTx.type === activeFilters.type;
            const searchMatch =
              !activeFilters.search ||
              keepTx.merchant.toLowerCase().includes(activeFilters.search.toLowerCase()) ||
              keepTx.description?.toLowerCase().includes(activeFilters.search.toLowerCase());
            if (typeMatch && searchMatch) {
              const others = data.transactions.filter((t) => t._id !== keepTx._id);
              return [keepTx, ...others];
            }
          }
          return data.transactions;
        });
        setPagination(data.pagination);
        setSummary(data.summary);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch transactions';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, transactions.length],
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Dedicated instant-UI callback for AI transaction entry & modal creation
  const handleTransactionCreated = useCallback(
    async (createdTx?: Transaction) => {
      if (createdTx) {
        // 1. Immediately update UI state with createdTx at top so transaction is 100% visible immediately
        setTransactions((prev) => {
          const others = prev.filter((t) => t._id !== createdTx._id);
          return [createdTx, ...others];
        });

        // 2. Immediately update summary cards with new transaction delta
        setSummary((prev) => {
          if (!prev) {
            return {
              totalIncome: createdTx.type === 'INCOME' ? createdTx.amount : 0,
              totalExpense: createdTx.type === 'EXPENSE' ? createdTx.amount : 0,
              netCashFlow: createdTx.type === 'INCOME' ? createdTx.amount : -createdTx.amount,
              transactionCount: 1,
            };
          }
          const deltaIncome = createdTx.type === 'INCOME' ? createdTx.amount : 0;
          const deltaExpense = createdTx.type === 'EXPENSE' ? createdTx.amount : 0;
          return {
            totalIncome: prev.totalIncome + deltaIncome,
            totalExpense: prev.totalExpense + deltaExpense,
            netCashFlow: prev.netCashFlow + deltaIncome - deltaExpense,
            transactionCount: prev.transactionCount + 1,
          };
        });

        // 3. Immediately increment total in pagination
        setPagination((prev) => ({
          ...prev,
          total: prev.total + 1,
        }));
      }

      // 4. Reset pagination to page 1 and clear filters that might hide the new transaction
      const targetFilters: TransactionFiltersState = {
        ...filters,
        page: 1,
        search: '',
        type: createdTx && filters.type && filters.type !== createdTx.type ? '' : filters.type,
        category: '',
        startDate: '',
        endDate: '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      setFilters(targetFilters);

      // 5. Authoritatively fetch from backend with targetFilters while strictly preserving createdTx at top
      try {
        const data = await TransactionService.getTransactions(targetFilters);
        if (createdTx) {
          const others = data.transactions.filter((t) => t._id !== createdTx._id);
          setTransactions([createdTx, ...others]);
        } else {
          setTransactions(data.transactions);
        }
        setPagination(data.pagination);
        setSummary(data.summary);
      } catch (err) {
        console.error('Failed to sync transactions after creation:', err);
      }
    },
    [filters],
  );

  const handleFilterChange = (newFilters: Partial<TransactionFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  // Open modal for Income
  const handleOpenAddIncome = () => {
    setSelectedTxForEdit(null);
    setModalDefaultType('INCOME');
    setIsModalOpen(true);
  };

  // Open modal for Expense
  const handleOpenAddExpense = () => {
    setSelectedTxForEdit(null);
    setModalDefaultType('EXPENSE');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleEdit = (tx: Transaction) => {
    setSelectedTxForEdit(tx);
    setIsModalOpen(true);
  };

  // View Details
  const handleViewDetails = (tx: Transaction) => {
    setSelectedTxForDetail(tx);
  };

  // Handle Create or Update
  const handleSubmitTransaction = async (dto: CreateTransactionDTO) => {
    if (selectedTxForEdit) {
      await TransactionService.updateTransaction(selectedTxForEdit._id, dto);
      await fetchTransactions();
    } else {
      const createdTx = await TransactionService.createTransaction(dto);
      await handleTransactionCreated(createdTx);
    }
  };

  // Handle Delete
  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction record?')) {
      return;
    }
    setDeletingId(id);
    try {
      await TransactionService.deleteTransaction(id);
      await fetchTransactions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete transaction';
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Transaction Ledger
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                Live Module
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Double-entry tracking, cash-flow categorization, and backend-calculated analytics.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchTransactions()}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenAddIncome}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              Record Income
            </button>

            <button
              onClick={handleOpenAddExpense}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white text-xs font-bold transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              Record Expense
            </button>
          </div>
        </div>

        {/* Backend Financial Aggregation Cards */}
        <FinancialSummaryCards summary={summary} currency={currency} isLoading={isLoading && !summary} />

        {/* AI Natural Language Transaction Parser */}
        <NaturalLanguageTransactionBar
          categories={categories}
          onTransactionCreated={handleTransactionCreated}
        />

        {/* Filters Bar */}
        <TransactionFilters
          filters={filters}
          categories={categories}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
        />

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-rose-300 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchTransactions()}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Transactions Table */}
        <TransactionTable
          transactions={transactions}
          isLoading={isLoading}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onDelete={handleDeleteTransaction}
          deletingId={deletingId}
          anomaliesMap={anomaliesMap}
        />

        {/* Pagination Bar */}
        {!isLoading && transactions.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                Showing{' '}
                <strong className="text-slate-200">
                  {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-200">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </strong>{' '}
                of <strong className="text-slate-200">{pagination.total}</strong> transactions
              </span>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-slate-500">Per page:</span>
                <select
                  value={filters.limit}
                  onChange={(e) =>
                    handleFilterChange({
                      limit: parseInt(e.target.value, 10),
                      page: 1,
                    })
                  }
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500 text-xs"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Page Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleFilterChange({ page: pagination.page - 1 })}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-semibold text-slate-200">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                onClick={() => handleFilterChange({ page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitTransaction}
        categories={categories}
        initialTransaction={selectedTxForEdit}
        defaultType={modalDefaultType}
      />

      {/* View Details Modal */}
      <TransactionDetailModal
        transaction={selectedTxForDetail}
        isOpen={!!selectedTxForDetail}
        onClose={() => setSelectedTxForDetail(null)}
        onEdit={(tx) => {
          setSelectedTxForDetail(null);
          handleEdit(tx);
        }}
      />
    </div>
  );
};
