import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '../components/Header.tsx';
import { reportService } from '../services/report.service.ts';
import { CompleteFinancialReportData, FinancialReport } from '../types/report.ts';
import {
  FileText,
  Download,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  PieChart as PieChartIcon,
  TrendingUp,
  DollarSign,
  Briefcase,
  ShieldCheck,
  Target,
  Repeat,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext.tsx';

export const ReportsPage: React.FC = () => {
  const { format } = useCurrency();

  // Helper to format Date to YYYY-MM-DD in local time
  const formatInputDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = useMemo(() => new Date(), []);

  // Default date range: From 1st of current month to today (e.g. 2026-10-01 to 2026-10-06)
  const defaultFrom = useMemo(() => {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return formatInputDate(firstDay);
  }, [today]);

  const defaultTo = useMemo(() => formatInputDate(today), [today]);

  // Selected Date Range State
  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);

  // Report Preview Data State
  const [reportData, setReportData] = useState<CompleteFinancialReportData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Optional: Collapsible Historical Snapshots Archive
  const [showArchive, setShowArchive] = useState<boolean>(false);
  const [archiveReports, setArchiveReports] = useState<FinancialReport[]>([]);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);

  // Date Range Validation: fromDate <= toDate
  const isInvalidDateRange = useMemo(() => {
    if (!fromDate || !toDate) return false;
    return fromDate > toDate;
  }, [fromDate, toDate]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Fetch Report Preview for Selected Date Range
  // ──────────────────────────────────────────────────────────────────────────
  const fetchReportPreview = useCallback(async () => {
    if (!fromDate || !toDate || isInvalidDateRange) return;

    setLoadingPreview(true);
    setErrorMsg(null);

    try {
      const data = await reportService.getFinancialReport(fromDate, toDate);
      setReportData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate financial report preview';
      setErrorMsg(msg);
      setReportData(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [fromDate, toDate, isInvalidDateRange]);

  // Trigger preview fetch on mount and whenever valid date range changes
  useEffect(() => {
    fetchReportPreview();
  }, [fetchReportPreview]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Download Complete Financial Report PDF
  // ──────────────────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (isInvalidDateRange) {
      setErrorMsg('From date cannot be later than To date.');
      return;
    }

    setDownloading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await reportService.downloadCompleteFinancialReportPdf(fromDate, toDate);
      setSuccessMsg(`Financial report for ${fromDate} to ${toDate} downloaded successfully.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download report PDF';
      setErrorMsg(msg);
    } finally {
      setDownloading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Quick Date Range Presets
  // ──────────────────────────────────────────────────────────────────────────
  const applyPreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30' | 'LAST_7' | 'YTD') => {
    const now = new Date();
    let f = new Date();
    let t = new Date();

    switch (preset) {
      case 'THIS_MONTH':
        f = new Date(now.getFullYear(), now.getMonth(), 1);
        t = now;
        break;
      case 'LAST_MONTH':
        f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        t = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'LAST_30':
        f = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        t = now;
        break;
      case 'LAST_7':
        f = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        t = now;
        break;
      case 'YTD':
        f = new Date(now.getFullYear(), 0, 1);
        t = now;
        break;
    }

    setFromDate(formatInputDate(f));
    setToDate(formatInputDate(t));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Load Historical Archive Snapshots (Collapsible)
  // ──────────────────────────────────────────────────────────────────────────
  const loadArchive = async () => {
    if (archiveReports.length > 0) return;
    setArchiveLoading(true);
    try {
      const res = await reportService.getReports({ limit: 10 });
      setArchiveReports(res.data);
    } catch {
      // Graceful fallback
    } finally {
      setArchiveLoading(false);
    }
  };

  const toggleArchive = () => {
    if (!showArchive) {
      loadArchive();
    }
    setShowArchive(!showArchive);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/5">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Financial Reports
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Generate a complete financial report for a selected date range.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchReportPreview}
              disabled={loadingPreview || isInvalidDateRange}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              title="Refresh Preview"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPreview ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm shadow-lg animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Main Financial Report Generator Card */}
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-2xl p-6 sm:p-8 backdrop-blur-xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Form Header */}
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Complete Financial Statement Generator
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Select any custom date range below to compile an authenticated, multi-module statement including transactions, budgets, portfolio, net worth, and goals.
            </p>
          </div>

          {/* Date Range Presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Quick Reporting Periods
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('THIS_MONTH')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
              >
                Current Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset('LAST_MONTH')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
              >
                Previous Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset('LAST_7')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset('LAST_30')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset('YTD')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
              >
                Year to Date
              </button>
            </div>
          </div>

          {/* Date Pickers Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-6 rounded-2xl border border-slate-800/60">
            {/* From Date */}
            <div className="space-y-2">
              <label htmlFor="fromDateInput" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                From Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  id="fromDateInput"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">Reporting window start date (00:00:00 IST)</p>
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <label htmlFor="toDateInput" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                To Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  id="toDateInput"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">Reporting window end date (23:59:59 IST)</p>
            </div>

            {/* Validation Message */}
            {isInvalidDateRange && (
              <div className="col-span-1 md:col-span-2 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>From date cannot be later than To date.</span>
              </div>
            )}
          </div>

          {/* Main Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-400">
              {reportData?.metadata?.periodDisplay ? (
                <span>
                  Configured Window:{' '}
                  <strong className="text-slate-200">{reportData.metadata.periodDisplay}</strong>
                </span>
              ) : (
                <span>Click download to compile vector PDF statement</span>
              )}
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloading || isInvalidDateRange || !fromDate || !toDate}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transform hover:-translate-y-0.5"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Complete PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Complete PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Small Summary Preview (Optional & Clean) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Selected Period Statement Preview
            </h3>
            {reportData?.metadata?.periodDisplay && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                {reportData.metadata.periodDisplay}
              </span>
            )}
          </div>

          {loadingPreview ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-slate-900/60 border border-slate-800" />
              ))}
            </div>
          ) : reportData ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Card 1: Transactions */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-xs text-slate-400 font-medium block">Total Transactions</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-white mt-1 block">
                  {reportData.summary.transactionCount}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {reportData.incomeAnalysis.count} in / {reportData.expenseAnalysis.count} out
                </span>
              </div>

              {/* Card 2: Total Income */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-xs text-slate-400 font-medium block">Total Inflow</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                  {format(reportData.summary.totalIncome)}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Earned in period</span>
              </div>

              {/* Card 3: Total Expenses */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-xs text-slate-400 font-medium block">Total Outflow</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1 block">
                  {format(reportData.summary.totalExpenses)}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Spent in period</span>
              </div>

              {/* Card 4: Net Savings */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-xs text-slate-400 font-medium block">Net Savings</span>
                <span
                  className={`text-xl sm:text-2xl font-bold font-mono mt-1 block ${
                    reportData.summary.netSavings >= 0 ? 'text-teal-400' : 'text-rose-400'
                  }`}
                >
                  {reportData.summary.netSavings >= 0 ? '+' : ''}
                  {format(reportData.summary.netSavings)}
                </span>
                <span className="text-[11px] text-cyan-300 mt-1 block">
                  Rate: {reportData.summary.savingsRateDisplay}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
              <p className="text-xs text-slate-400">
                Configure a date range and click Refresh to view instant financial metrics.
              </p>
            </div>
          )}
        </div>

        {/* Modules Package Breakdown */}
        <div className="rounded-3xl bg-slate-900/40 border border-slate-800/80 p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            All Comprehensive Modules Included in This Report
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Transactions</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <PieChartIcon className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Category Share</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Budgets</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <Briefcase className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Portfolio</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Net Worth</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <Target className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Goals</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <Repeat className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Subscriptions</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">AI Forecasting</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Anomalies</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Daily Spending</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Multi-Page PDF</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Indian Rupee (₹)</span>
            </div>
          </div>
        </div>

        {/* Collapsible Previously Saved Monthly Snapshots Archive */}
        <div className="rounded-3xl bg-slate-900/40 border border-slate-800/80 overflow-hidden">
          <button
            type="button"
            onClick={toggleArchive}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-300">
                Previously Saved Monthly Snapshots Archive
              </span>
            </div>
            {showArchive ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showArchive && (
            <div className="p-6 border-t border-slate-800/80 space-y-4">
              {archiveLoading ? (
                <div className="text-xs text-slate-500 py-4 text-center">Loading archived reports...</div>
              ) : archiveReports.length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">
                  No previously saved monthly snapshots found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2">Period</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Generated</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {archiveReports.map((rep) => (
                        <tr key={rep._id} className="hover:bg-slate-800/20">
                          <td className="py-2.5 font-medium text-white">{rep.title}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {rep.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-400 font-mono">
                            {new Date(rep.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => reportService.downloadPdf(rep._id, `${rep.title}.pdf`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
