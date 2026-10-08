import React, { useState } from 'react';
import { Header } from '../../components/Header.tsx';
import { AnomalySummaryCards } from '../../components/anomalies/AnomalySummaryCards.tsx';
import { AnomalyFilters } from '../../components/anomalies/AnomalyFilters.tsx';
import { AnomalyTable } from '../../components/anomalies/AnomalyTable.tsx';
import { AnomalyDetailDrawer } from '../../components/anomalies/AnomalyDetailDrawer.tsx';
import { useAnomalies } from '../../hooks/useAnomalies.ts';
import {
  AlertTriangle,
  RotateCw,
  Info,
  Sliders,
  CheckCircle,
} from 'lucide-react';

export const AnomaliesPage: React.FC = () => {
  const {
    anomalies,
    summary,
    loading,
    detecting,
    error,
    filters,
    pagination,
    selectedAnomaly,
    feedbackSuccess,
    setSelectedAnomaly,
    setFilters,
    runDetection,
    updateStatus,
    submitFeedback,
    refresh,
  } = useAnomalies();

  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const handleRunScan = async () => {
    try {
      const res = await runDetection(90);
      if (res.status === 'insufficient_data') {
        setScanMessage(res.message);
      } else {
        setScanMessage(
          `Analysis complete: Evaluated ${res.totalEvaluated} transactions and identified ${res.anomaliesDetected} unusual spending patterns.`,
        );
      }
      setTimeout(() => setScanMessage(null), 6000);
    } catch (err: any) {
      setScanMessage(err?.message || 'Failed to complete anomaly scan.');
      setTimeout(() => setScanMessage(null), 6000);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      status: undefined,
      severity: undefined,
      anomalyType: undefined,
      category: undefined,
      merchant: undefined,
      page: 1,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Scan Action */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Unusual Spending Detection
              </h1>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Personalized pattern analysis to identify statistical deviations in spending.
              Anomalies indicate unusual behavior relative to your personal history and do not establish fraud.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={loading || detecting}
              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Refresh anomalies"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              disabled={detecting || loading}
              onClick={handleRunScan}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
            >
              {detecting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Scanning Transactions...</span>
                </>
              ) : (
                <>
                  <Sliders className="w-4 h-4" />
                  <span>Run Anomaly Scan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan Result Alert */}
        {scanMessage && (
          <div className="p-4 rounded-xl bg-slate-900 border border-primary-500/30 text-primary-300 text-sm flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-primary-400 flex-shrink-0" />
              <span>{scanMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setScanMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Metric Cards */}
        <section aria-label="Anomaly summary statistics">
          <AnomalySummaryCards
            summary={summary}
            activeStatusFilter={filters.status}
            onSelectStatusFilter={(st) => setFilters({ status: st, page: 1 })}
          />
        </section>

        {/* Filters */}
        <section aria-label="Filters and search">
          <AnomalyFilters
            filters={filters}
            onChange={setFilters}
            onClear={handleClearFilters}
          />
        </section>

        {/* Anomaly Table */}
        <section aria-label="Detected anomalies list">
          <AnomalyTable
            anomalies={anomalies}
            loading={loading}
            onSelectAnomaly={setSelectedAnomaly}
            pagination={pagination}
            onPageChange={(page) => setFilters({ page })}
          />
        </section>

        {/* Detail & Feedback Drawer */}
        <AnomalyDetailDrawer
          anomaly={selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
          onSubmitFeedback={submitFeedback}
          onUpdateStatus={updateStatus}
          feedbackSuccessMessage={feedbackSuccess}
        />

        {/* Informational Guidance & Safety Disclaimer */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-3 leading-relaxed">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-300 block mb-0.5">
              Personalized Machine Learning & Data Isolation Notice
            </span>
            Spending patterns are evaluated strictly within your private account history using
            Isolation Forest tree ensembles and robust Modified Z-score statistics.
            Anomalies represent statistical variations and do not constitute fraud or unauthorized activity.
            Your feedback is stored securely to calibrate future personal spending baselines.
          </div>
        </div>
      </main>
    </div>
  );
};
