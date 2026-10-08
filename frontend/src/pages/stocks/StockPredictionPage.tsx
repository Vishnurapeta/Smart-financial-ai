import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../components/Header.tsx';
import { PredictionDisclaimer } from '../../components/stocks/PredictionDisclaimer.tsx';
import { StockIntelligenceSummaryCards } from '../../components/stocks/intelligence/StockIntelligenceSummaryCards.tsx';
import {
  StockIntelligenceFilters,
  FilterState,
} from '../../components/stocks/intelligence/StockIntelligenceFilters.tsx';
import { StockIntelligenceTable } from '../../components/stocks/intelligence/StockIntelligenceTable.tsx';
import { SectorPerformanceSection } from '../../components/stocks/intelligence/SectorPerformanceSection.tsx';
import { ModelArchitecturePerformanceSection } from '../../components/stocks/intelligence/ModelArchitecturePerformanceSection.tsx';
import { TopOpportunitiesWidgets } from '../../components/stocks/intelligence/TopOpportunitiesWidgets.tsx';
import { StockIntelligenceDetailModal } from '../../components/stocks/intelligence/StockIntelligenceDetailModal.tsx';
import { TrainingDashboardWidget } from '../../components/stocks/intelligence/TrainingDashboardWidget.tsx';
import {
  StockIntelligenceResponse,
  StockPredictionIntelligenceItem,
  SectorPerformanceItem,
  ModelArchitectureBenchmarkItem,
  TrainingStatusData,
} from '../../types/stockPrediction.ts';
import { StockPredictionService } from '../../services/stockPrediction.service.ts';
import { ArrowLeft, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

const INITIAL_FILTERS: FilterState = {
  search: '',
  sector: '',
  horizon: 1,
  direction: '',
  return_range: '',
  min_return: undefined,
  max_return: undefined,
  model: '',
  sort: 'expected_return_desc',
  preset: '',
};

export const StockPredictionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Screener Filters State
  const initialSymbol = searchParams.get('symbol');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Data States
  const [screenerData, setScreenerData] = useState<StockIntelligenceResponse | null>(null);
  const [universeStocks, setUniverseStocks] = useState<StockPredictionIntelligenceItem[]>([]);
  const [sectorData, setSectorData] = useState<SectorPerformanceItem[]>([]);
  const [modelBenchmarkData, setModelBenchmarkData] = useState<ModelArchitectureBenchmarkItem[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatusData | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockPredictionIntelligenceItem | null>(null);

  // Loading & Error States
  const [loadingScreener, setLoadingScreener] = useState<boolean>(true);
  const [loadingSectors, setLoadingSectors] = useState<boolean>(true);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Screener Predictions
  const fetchScreener = useCallback(async () => {
    setLoadingScreener(true);
    setError(null);
    try {
      const resp = await StockPredictionService.getScreenerPredictions({
        search: filters.search || undefined,
        sector: filters.sector || undefined,
        horizon: filters.horizon,
        direction: filters.direction || undefined,
        return_range: filters.return_range || undefined,
        min_return: filters.min_return,
        max_return: filters.max_return,
        model: filters.model || undefined,
        sort: filters.sort,
        preset: filters.preset || undefined,
        page: currentPage,
        limit: pageSize,
      });
      setScreenerData(resp);
    } catch (err: unknown) {
      console.error('Failed to fetch stock predictions:', err);
      setError((err as Error).message || 'Failed to load stock predictions');
    } finally {
      setLoadingScreener(false);
    }
  }, [filters, currentPage, pageSize]);

  // 2. Fetch Sector Performance
  const fetchSectors = useCallback(async (horizon: number) => {
    setLoadingSectors(true);
    try {
      const resp = await StockPredictionService.getSectorPerformance(horizon);
      setSectorData(resp.sectors || []);
    } catch (err) {
      console.warn('Sector performance fetch failed:', err);
    } finally {
      setLoadingSectors(false);
    }
  }, []);

  // 3. Fetch Model Benchmarks
  const fetchBenchmarks = useCallback(async (horizon: number) => {
    setLoadingBenchmarks(true);
    try {
      const resp = await StockPredictionService.getModelArchitecturePerformance(horizon);
      setModelBenchmarkData(resp.models || []);
    } catch (err) {
      console.warn('Model performance fetch failed:', err);
    } finally {
      setLoadingBenchmarks(false);
    }
  }, []);

  // 4. Fetch Training Status
  const fetchTrainingStatus = useCallback(async () => {
    try {
      const st = await StockPredictionService.getTrainingStatus();
      setTrainingStatus(st);
    } catch (err) {
      console.warn('Training status fetch failed:', err);
    }
  }, []);

  // 5. Fetch full universe predictions for Top Opportunities & Potential Decliners widgets
  const fetchUniverseStocks = useCallback(async (horizon: number) => {
    try {
      const resp = await StockPredictionService.getScreenerPredictions({
        horizon,
        limit: 150, // Retrieve full universe of predictions (~107 stocks)
      });
      if (resp?.items && resp.items.length > 0) {
        setUniverseStocks(resp.items);
      }
    } catch (err) {
      console.warn('Universe predictions for widgets fetch failed:', err);
    }
  }, []);

  // Trigger data loading on filter/horizon change
  useEffect(() => {
    fetchScreener();
  }, [fetchScreener]);

  useEffect(() => {
    fetchSectors(filters.horizon);
    fetchBenchmarks(filters.horizon);
    fetchUniverseStocks(filters.horizon);
  }, [filters.horizon, fetchSectors, fetchBenchmarks, fetchUniverseStocks]);

  useEffect(() => {
    fetchTrainingStatus();
  }, [fetchTrainingStatus]);

  // Handle URL symbol param for direct opening
  useEffect(() => {
    if (initialSymbol) {
      StockPredictionService.getStockDetail(initialSymbol)
        .then((detail) => {
          setSelectedStock(detail);
        })
        .catch(() => {
          // Non-fatal if symbol doesn't exist
        });
    }
  }, [initialSymbol]);

  // Filter handlers
  const handleFilterChange = (updated: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
    setCurrentPage(1); // Reset to page 1 on filter modification
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);
  };

  const handleSelectSector = (sector: string) => {
    handleFilterChange({ sector: sector === 'All Sectors' ? '' : sector });
  };

  const handleSelectStock = async (symbol: string) => {
    try {
      const detail = await StockPredictionService.getStockDetail(symbol);
      setSelectedStock(detail);
    } catch (err: unknown) {
      console.error('Error fetching stock detail:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation & Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <button
                onClick={() => navigate('/stocks')}
                className="text-xs font-semibold text-gray-400 hover:text-cyan-400 flex items-center gap-1 transition-colors bg-gray-900 border border-gray-800 px-2.5 py-1 rounded-lg"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Live Stocks
              </button>
              <span className="text-gray-600">•</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                Walk-Forward Validated
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                Zero Data Leakage
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-cyan-400" />
              AI Stock Prediction &amp; Intelligent Screening Center
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-3xl">
              Cross-stock algorithmic forecasts, expected returns, and out-of-sample machine learning screening across the validated universe.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                fetchScreener();
                fetchSectors(filters.horizon);
                fetchBenchmarks(filters.horizon);
                fetchTrainingStatus();
              }}
              disabled={loadingScreener}
              className="px-3.5 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl border border-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Refresh Predictions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingScreener ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Central KPI Summary Cards */}
        <StockIntelligenceSummaryCards
          summary={screenerData?.summary || null}
          loading={loadingScreener && !screenerData}
        />

        {/* 2. Interactive Screener Filters & Search */}
        <StockIntelligenceFilters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* 3. Top AI-Ranked Opportunities & Potential Decliners Widgets */}
        <TopOpportunitiesWidgets
          allStocks={universeStocks.length > 0 ? universeStocks : (screenerData?.items || [])}
          onSelectStock={handleSelectStock}
          horizon={filters.horizon}
        />

        {/* 4. Comprehensive Stock Intelligence Table */}
        <StockIntelligenceTable
          stocks={screenerData?.items || []}
          totalCount={screenerData?.total_count || 0}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={screenerData?.total_pages || 1}
          loading={loadingScreener}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setCurrentPage(1);
          }}
          onSelectStock={handleSelectStock}
        />

        {/* 5. AI Predicted Sector Performance */}
        <SectorPerformanceSection
          sectors={sectorData}
          selectedSector={filters.sector}
          onSelectSector={handleSelectSector}
          loading={loadingSectors}
          horizon={filters.horizon}
        />

        {/* 6. Candidate Model Benchmarks & Selection */}
        <ModelArchitecturePerformanceSection
          models={modelBenchmarkData}
          loading={loadingBenchmarks}
          horizon={filters.horizon}
        />

        {/* 7. ML Pipeline Architecture & Training Governance */}
        <TrainingDashboardWidget
          status={trainingStatus}
          onRefresh={fetchTrainingStatus}
        />

        {/* 8. Regulatory & Financial Disclaimer Banner */}
        <PredictionDisclaimer />

        {/* 9. Stock Detail Modal */}
        {selectedStock && (
          <StockIntelligenceDetailModal
            stock={selectedStock}
            onClose={() => setSelectedStock(null)}
          />
        )}
      </main>
    </div>
  );
};

export default StockPredictionPage;
