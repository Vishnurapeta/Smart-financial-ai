import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header.tsx';
import { PortfolioService } from '../services/portfolio.service.ts';
import {
  PortfolioSummary,
  PortfolioDashboard,
  HoldingDto,
  CreatePortfolioPayload,
  AddHoldingPayload,
  EditHoldingPayload,
} from '../types/portfolio.ts';
import { PortfolioKPICards } from '../components/portfolio/PortfolioKPICards.tsx';
import { PortfolioAllocationChart } from '../components/portfolio/PortfolioAllocationChart.tsx';
import { SectorAllocationChart } from '../components/portfolio/SectorAllocationChart.tsx';
import { StockPerformanceCards } from '../components/portfolio/StockPerformanceCards.tsx';
import { HoldingsTable } from '../components/portfolio/HoldingsTable.tsx';
import { AddHoldingModal } from '../components/portfolio/AddHoldingModal.tsx';
import { EditHoldingModal } from '../components/portfolio/EditHoldingModal.tsx';
import { CreatePortfolioModal } from '../components/portfolio/CreatePortfolioModal.tsx';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { getCurrencySymbol } from '../utils/format.ts';
import {
  Briefcase,
  Plus,
  RefreshCw,
  Loader2,
  AlertTriangle,
  FolderPlus,
  ChevronDown,
} from 'lucide-react';

export const PortfolioPage: React.FC = () => {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<PortfolioDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addInitialSymbol, setAddInitialSymbol] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingDto | null>(null);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState(false);
  const [holdingToDelete, setHoldingToDelete] = useState<HoldingDto | null>(null);

  // Load portfolios list
  const loadPortfolios = useCallback(async (selectId?: string) => {
    try {
      const list = await PortfolioService.getPortfolios();
      setPortfolios(list);

      if (list.length > 0) {
        const targetId = selectId || list.find((p) => p.isDefault)?.id || list[0].id;
        setSelectedPortfolioId(targetId);
        return targetId;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load portfolios';
      setError(msg);
      return null;
    }
  }, []);

  // Load dashboard data for current portfolio
  const loadDashboard = useCallback(async (portfolioId: string) => {
    try {
      setError(null);
      const data = await PortfolioService.getDashboard(portfolioId);
      setDashboard(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load portfolio dashboard';
      setError(msg);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const activeId = await loadPortfolios();
      if (activeId) {
        await loadDashboard(activeId);
      }
      setLoading(false);
    };
    init();
  }, [loadPortfolios, loadDashboard]);

  // When selected portfolio changes
  const handleSelectPortfolio = async (id: string) => {
    setSelectedPortfolioId(id);
    setLoading(true);
    await loadDashboard(id);
    setLoading(false);
  };

  // Manual refresh quotes
  const handleRefresh = async () => {
    if (!selectedPortfolioId) return;
    setRefreshing(true);
    await loadDashboard(selectedPortfolioId);
    setRefreshing(false);
  };

  // Portfolio creation
  const handleCreatePortfolio = async (payload: CreatePortfolioPayload) => {
    const newPort = await PortfolioService.createPortfolio(payload);
    await loadPortfolios(newPort.id);
    await loadDashboard(newPort.id);
  };

  // Add holding / lot
  const handleAddHolding = async (payload: AddHoldingPayload) => {
    if (!selectedPortfolioId) return;
    await PortfolioService.addHolding(selectedPortfolioId, payload);
    await loadDashboard(selectedPortfolioId);
    await loadPortfolios(selectedPortfolioId);
  };

  // Edit holding
  const handleEditHolding = async (payload: EditHoldingPayload) => {
    if (!selectedPortfolioId || !editingHolding) return;
    await PortfolioService.editHolding(selectedPortfolioId, editingHolding.id, payload);
    await loadDashboard(selectedPortfolioId);
    await loadPortfolios(selectedPortfolioId);
  };

  // Delete holding
  const handleDeleteHolding = async () => {
    if (!selectedPortfolioId || !holdingToDelete) return;
    try {
      await PortfolioService.removeHolding(selectedPortfolioId, holdingToDelete.id);
      setHoldingToDelete(null);
      await loadDashboard(selectedPortfolioId);
      await loadPortfolios(selectedPortfolioId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete holding';
      setError(msg);
    }
  };

  const { currency: userCurrency } = useCurrency();
  const currentPortfolio = portfolios.find((p) => p.id === selectedPortfolioId);
  const activeCurrency = currentPortfolio?.baseCurrency || userCurrency;
  const currencySymbol = getCurrencySymbol(activeCurrency);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Briefcase className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Investment Portfolio
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  Live Quotes
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-asset tracking, lots, real-time marked-to-market valuations &amp; allocation
                analytics
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Portfolio Selector */}
            {portfolios.length > 0 && (
              <div className="relative">
                <select
                  value={selectedPortfolioId || ''}
                  onChange={(e) => handleSelectPortfolio(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm"
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            )}

            {/* New Portfolio Button */}
            <button
              onClick={() => setIsCreatePortfolioOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>New Portfolio</span>
            </button>

            {/* Refresh Quotes */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh live market quotes"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
            </button>

            {/* Add Position */}
            <button
              onClick={() => {
                setAddInitialSymbol('');
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Position</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Notice: </span>
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs font-bold underline hover:text-rose-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs font-medium">
              Fetching real-time market data &amp; portfolio positions...
            </p>
          </div>
        ) : dashboard ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <PortfolioKPICards summary={dashboard.summary} />

            {/* Stock Performance Highlights (Best & Worst) */}
            <StockPerformanceCards
              bestPerformer={dashboard.performance.bestPerformer}
              worstPerformer={dashboard.performance.worstPerformer}
              currencySymbol={currencySymbol}
            />

            {/* Visual Analytics Grid: Asset Allocation & Sector Diversification */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PortfolioAllocationChart
                allocations={dashboard.allocation}
                currencySymbol={currencySymbol}
              />
              <SectorAllocationChart
                sectorAllocations={dashboard.sectorAllocation}
                currencySymbol={currencySymbol}
              />
            </div>

            {/* Holdings Table */}
            <HoldingsTable
              holdings={dashboard.holdings}
              currencySymbol={currencySymbol}
              onEditHolding={(h) => {
                setEditingHolding(h);
                setIsEditModalOpen(true);
              }}
              onDeleteHolding={(h) => {
                setHoldingToDelete(h);
              }}
              onAddLot={(h) => {
                setAddInitialSymbol(h.symbol);
                setIsAddModalOpen(true);
              }}
            />
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <p>Select or create a portfolio to get started.</p>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {holdingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              Remove {holdingToDelete.symbol}?
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Are you sure you want to remove this position and all its recorded lots? This action
              cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setHoldingToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHolding}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors"
              >
                Remove Position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Holding Modal */}
      <AddHoldingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddHolding}
        initialSymbol={addInitialSymbol}
        currencySymbol={currencySymbol}
      />

      {/* Edit Holding Modal */}
      <EditHoldingModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingHolding(null);
        }}
        holding={editingHolding}
        onSubmit={handleEditHolding}
        currencySymbol={currencySymbol}
      />

      {/* Create Portfolio Modal */}
      <CreatePortfolioModal
        isOpen={isCreatePortfolioOpen}
        onClose={() => setIsCreatePortfolioOpen(false)}
        onSubmit={handleCreatePortfolio}
      />
    </div>
  );
};
