import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header } from '../components/Header.tsx';
import { reportService } from '../services/report.service.ts';
import { FinancialReport, MonthlyReportSnapshot } from '../types/report.ts';
import {
  FileText,
  Download,
  Mail,
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  PieChart,
  AlertTriangle,
  Sparkles,
  Activity,
  Repeat,
  Target,
  LineChart,
  Eye,
  Clock,
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext.tsx';

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currency: userCurrency, format } = useCurrency();

  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [emailing, setEmailing] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await reportService.getReportById(id);
      setReport(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load financial report';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleDownloadPdf = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const filename = `SmartFin-Report-${report.year}-${String(report.month).padStart(2, '0')}.pdf`;
      await reportService.downloadPdf(report._id, filename);
      setNotificationMsg({ text: 'PDF report downloaded successfully', type: 'success' });
      setTimeout(() => setNotificationMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download report PDF';
      setNotificationMsg({ text: msg, type: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!report) return;
    setEmailing(true);
    try {
      await reportService.sendReportEmail(report._id);
      setNotificationMsg({ text: 'Report delivery email has been queued to your registered inbox', type: 'success' });
      setTimeout(() => setNotificationMsg(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to queue report email';
      setNotificationMsg({ text: msg, type: 'error' });
    } finally {
      setEmailing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Header />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-spin">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm text-slate-400">Loading comprehensive financial audit...</p>
        </main>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Report Not Accessible</h2>
          <p className="text-sm text-slate-400">{error || 'The requested report could not be found.'}</p>
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </main>
      </div>
    );
  }

  const s = report.dataSnapshot as MonthlyReportSnapshot | undefined;
  const curr = report.currency || userCurrency || 'USD';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-2">
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Reports
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {report.title}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  report.status === 'READY'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : report.status === 'READY_WITH_LIMITATIONS'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}
              >
                {report.status === 'READY' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {report.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                {s?.metadata.periodLabel || `${new Date(report.periodStart).toLocaleDateString()} - ${new Date(report.periodEnd).toLocaleDateString()}`}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Generated on {new Date(report.generatedAt || report.createdAt).toLocaleDateString()} ({report.timezone})
              </span>
              <span>•</span>
              <span className="text-slate-500">v{report.reportVersion} ({report.templateVersion})</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSendEmail}
              disabled={emailing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all disabled:opacity-50"
            >
              <Mail className="w-4 h-4 text-teal-400" />
              <span>{emailing ? 'Queuing...' : 'Email Report'}</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Preparing PDF...' : 'Download Vector PDF'}</span>
            </button>
          </div>
        </div>

        {/* Notifications Toast / Alert */}
        {notificationMsg && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border ${
              notificationMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notificationMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{notificationMsg.text}</span>
            </div>
            <button onClick={() => setNotificationMsg(null)} className="font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Limitations Notice */}
        {report.limitations && report.limitations.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Reporting Period Limitations
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-2 text-amber-200/80">
              {report.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        )}

        {/* SECTION 1: EXECUTIVE SUMMARY KPIS */}
        {s && (
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Executive Financial Overview
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Total Income</span>
                <div className="text-lg sm:text-xl font-extrabold text-emerald-400">
                  {curr} {s.executiveSummary.totalIncome.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  {s.incomeSection.percentageChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-rose-400" />
                  )}
                  <span>{s.incomeSection.percentageChange >= 0 ? '+' : ''}{s.incomeSection.percentageChange}% MoM</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Total Expenses</span>
                <div className="text-lg sm:text-xl font-extrabold text-slate-100">
                  {curr} {s.executiveSummary.totalExpenses.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>{s.expenseSection.percentageChange >= 0 ? '+' : ''}{s.expenseSection.percentageChange}% MoM</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Net Savings</span>
                <div
                  className={`text-lg sm:text-xl font-extrabold ${
                    s.executiveSummary.savings >= 0 ? 'text-teal-400' : 'text-rose-400'
                  }`}
                >
                  {curr} {s.executiveSummary.savings.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  Prev: {curr} {s.savingsSection.previousSavings.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Savings Rate</span>
                <div className="text-lg sm:text-xl font-extrabold text-cyan-400">
                  {s.executiveSummary.savingsRateFormatted}
                </div>
                <div className="text-[11px] text-slate-400">
                  Target: &gt;20%
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Burn Rate</span>
                <div className="text-lg sm:text-xl font-extrabold text-amber-400">
                  {curr} {s.executiveSummary.monthlyBurnRate.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={s.executiveSummary.burnRateDefinition}>
                  {s.executiveSummary.burnRateDefinition}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Net Worth</span>
                <div className="text-lg sm:text-xl font-extrabold text-indigo-300">
                  {curr} {s.executiveSummary.netWorth.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  {s.netWorthSection.percentageChange >= 0 ? '+' : ''}{s.netWorthSection.percentageChange}% MoM
                </div>
              </div>
            </div>

            {/* Key Insights & Takeaways */}
            {s.insights && s.insights.length > 0 && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  Deterministic Financial Insights
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                  {s.insights.map((ins, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 2: INCOME & EXPENSE BREAKDOWN */}
        {s && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Spending Categories */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-400" />
                  Top Spending Categories
                </h3>
                <span className="text-xs text-slate-400">
                  Fixed: {curr} {s.expenseSection.fixedExpenses.toLocaleString()} • Variable: {curr} {s.expenseSection.variableExpenses.toLocaleString()}
                </span>
              </div>

              {s.expenseSection.categories.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No categorized expenses recorded for this month.</p>
              ) : (
                <div className="space-y-3">
                  {s.expenseSection.categories.map((cat, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{curr} {cat.amount.toLocaleString()}</span>
                          <span className="text-slate-400 text-[11px]">({cat.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Largest Transactions */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-teal-400" />
                  Largest Transactions
                </h3>
                <span className="text-xs text-slate-400">Top Outflows</span>
              </div>

              {s.largestTransactions.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No transactions recorded during this period.</p>
              ) : (
                <div className="space-y-2">
                  {s.largestTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-white">{tx.merchant}</div>
                        <div className="text-[11px] text-slate-400">
                          {tx.date} • {tx.category}
                        </div>
                      </div>
                      <div className="text-sm font-extrabold text-slate-100">
                        {curr} {tx.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: RECURRING EXPENSES & FINANCIAL GOALS */}
        {s && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recurring Commitments & Subscriptions */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-cyan-400" />
                  Recurring & Subscriptions
                </h3>
                <span className="text-xs font-semibold text-cyan-400">
                  Total: {curr} {s.recurringCommitments.totalMonthlyCommitments.toLocaleString()}/mo
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  <span className="text-slate-400">Recurring Bills ({s.recurringCommitments.activeRecurringCount})</span>
                  <div className="font-bold text-white mt-1">
                    {curr} {s.recurringCommitments.totalMonthlyRecurring.toLocaleString()}/mo
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  <span className="text-slate-400">Subscriptions ({s.recurringCommitments.activeSubscriptionCount})</span>
                  <div className="font-bold text-white mt-1">
                    {curr} {s.recurringCommitments.totalMonthlySubscriptions.toLocaleString()}/mo
                  </div>
                </div>
              </div>

              {s.recurringCommitments.upcomingBills.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Upcoming Commitments
                  </div>
                  {s.recurringCommitments.upcomingBills.slice(0, 4).map((bill) => (
                    <div
                      key={bill.id}
                      className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{bill.name}</span>
                        <div className="text-[10px] text-slate-400">Due: {bill.nextExpectedDate || 'Recurring'}</div>
                      </div>
                      <div className="font-bold text-slate-200">
                        {curr} {bill.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Goals Progress */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  Financial Goals Progress
                </h3>
                <span className="text-xs text-slate-400">{s.goalsSection.length} Active Goals</span>
              </div>

              {s.goalsSection.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No active financial goals configured.</p>
              ) : (
                <div className="space-y-3.5">
                  {s.goalsSection.map((g) => (
                    <div key={g.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{g.name}</span>
                        <span className="text-slate-300">
                          {curr} {g.currentAmount.toLocaleString()} / {curr} {g.targetAmount.toLocaleString()} ({g.progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${Math.min(100, g.progressPercent)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Remaining: {curr} {g.remainingAmount.toLocaleString()}</span>
                        {g.targetDate && <span>Target: {g.targetDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: INVESTMENT PORTFOLIO & WATCHLIST */}
        {s && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Summary */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-indigo-400" />
                  Investment Portfolio
                </h3>
                {s.portfolioSection.available && (
                  <span
                    className={`text-xs font-bold ${
                      s.portfolioSection.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {s.portfolioSection.unrealizedPnL >= 0 ? '+' : ''}{s.portfolioSection.unrealizedPnLPercent}% P&L
                  </span>
                )}
              </div>

              {!s.portfolioSection.available || s.portfolioSection.holdings.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No portfolio holdings recorded.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Invested</span>
                      <div className="font-bold text-white">{curr} {s.portfolioSection.totalInvested.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Market Value</span>
                      <div className="font-bold text-white">{curr} {s.portfolioSection.currentMarketValue.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Unrealized P&L</span>
                      <div className={`font-bold ${s.portfolioSection.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {curr} {s.portfolioSection.unrealizedPnL.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {s.portfolioSection.holdings.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-800/20 border border-slate-700/20 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">{h.symbol}</span>
                          <span className="text-slate-400 ml-2">({h.shares} shares @ {curr}{h.avgPrice})</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">{curr} {h.marketValue.toLocaleString()}</div>
                          <div className={`text-[10px] ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {h.pnl >= 0 ? '+' : ''}{h.pnlPercent}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Watchlist Summary */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Stock Watchlist Quotes
                </h3>
                <span className="text-xs text-slate-400">{s.watchlistSection.symbolCount} Symbols</span>
              </div>

              {!s.watchlistSection.available || s.watchlistSection.symbols.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Market data currently unavailable or no watchlist tracked.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {s.watchlistSection.symbols.map((sym, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white">{sym.symbol}</span>
                        {sym.changePercent !== undefined ? (
                          <span className={`text-[11px] font-semibold ${sym.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {sym.changePercent >= 0 ? '+' : ''}{sym.changePercent}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Quotes pending</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-200">
                        {sym.price ? `$${sym.price.toLocaleString()}` : 'Price unavailable'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 5: MACHINE LEARNING & STOCK MODEL FORECASTS */}
        {s && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash Flow & Expense Forecast */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <h3 className="text-base font-bold text-white">Expense & Cash-Flow Forecast</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Forecast — Model Estimate
                </span>
              </div>

              {!s.forecastSection.available ? (
                <p className="text-xs text-slate-500 py-6 text-center">Forecast model data unavailable for this reporting period.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {s.forecastSection.expenseForecast && (
                      <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/40 space-y-1">
                        <span className="text-slate-400 text-[10px] uppercase font-semibold">Predicted Outflow</span>
                        <div className="text-lg font-extrabold text-white">
                          {curr} {s.forecastSection.expenseForecast.nextMonthEstimatedExpenses.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Confidence: {Math.round(s.forecastSection.expenseForecast.confidenceScore * 100)}% ({s.forecastSection.expenseForecast.modelUsed})
                        </div>
                      </div>
                    )}

                    {s.forecastSection.cashFlowForecast && (
                      <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/40 space-y-1">
                        <span className="text-slate-400 text-[10px] uppercase font-semibold">Net Projected Flow</span>
                        <div className={`text-lg font-extrabold ${s.forecastSection.cashFlowForecast.projectedNetFlow >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                          {curr} {s.forecastSection.cashFlowForecast.projectedNetFlow.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Period: {s.forecastSection.cashFlowForecast.period}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    {s.forecastSection.disclaimer}
                  </p>
                </div>
              )}
            </div>

            {/* Stock Model Forecasts */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Stock Model Forecasts</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Model Estimate
                </span>
              </div>

              {!s.stockModelForecasts.available || s.stockModelForecasts.forecasts.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No stock model forecast available for this reporting period.</p>
              ) : (
                <div className="space-y-3">
                  {s.stockModelForecasts.forecasts.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-800/30 border border-slate-700/40 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">{f.symbol}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                            {f.predictionHorizonDays} Horizon
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Est. Price</span>
                          <span className="font-extrabold text-emerald-400">
                            {format(f.predictedPrice, {
                              currency:
                                f.symbol?.endsWith('.NS') || f.symbol?.endsWith('.BO')
                                  ? 'INR'
                                  : curr,
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        <span>Model: {f.modelName} ({f.modelVersion})</span>
                        <span>Feature: {f.featureVersion}</span>
                        <span>RMSE: {f.historicalRmse}</span>
                      </div>
                    </div>
                  ))}

                  <p className="text-[10px] text-slate-500 italic pt-1">
                    {s.stockModelForecasts.disclaimer}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 6: FINANCIAL ANOMALIES SUMMARY */}
        {s && (
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-bold text-white">Unusual Spending Detected</h3>
              </div>
              <span className="text-xs text-slate-400">
                {s.anomalySection.unusualSpendingCount} events flagged
              </span>
            </div>

            {s.anomalySection.events.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero unusual spending spikes or anomalous transactions identified during this month.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  The anomaly detection engine flagged unusual spending patterns across categories:{' '}
                  <span className="font-semibold text-white">{s.anomalySection.affectedCategories.join(', ') || 'General'}</span>.
                  These indicate deviation from historical habits (not proof of fraud).
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {s.anomalySection.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{evt.merchant}</div>
                        <div className="text-[10px] text-slate-400">{evt.date} • Severity: {evt.severity}</div>
                      </div>
                      <div className="font-bold text-amber-400">
                        {curr} {evt.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
