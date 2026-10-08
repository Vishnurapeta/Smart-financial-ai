import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout.tsx';
import { adminService } from '../../services/admin.service.ts';
import {
  PlatformOverviewMetrics,
  SystemHealthReport,
  QueueJobCounts,
  FeatureMetrics,
  SecurityMetricsReport,
  ApiTelemetrySummary,
} from '../../types/admin.ts';
import {
  Users,
  UserCheck,
  Activity,
  Server,
  Database,
  Cpu,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [overview, setOverview] = useState<PlatformOverviewMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [queues, setQueues] = useState<QueueJobCounts[]>([]);
  const [features, setFeatures] = useState<FeatureMetrics | null>(null);
  const [security, setSecurity] = useState<SecurityMetricsReport | null>(null);
  const [telemetry, setTelemetry] = useState<ApiTelemetrySummary | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const [ovData, hlData, qData, ftData, secData, telData] = await Promise.all([
        adminService.getOverviewMetrics(),
        adminService.getSystemHealth(),
        adminService.getQueueMetrics(),
        adminService.getFeatureMetrics(),
        adminService.getSecurityMetrics(),
        adminService.getTelemetryMetrics(),
      ]);

      setOverview(ovData);
      setHealth(hlData);
      setQueues(qData);
      setFeatures(ftData);
      setSecurity(secData);
      setTelemetry(telData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load administration telemetry');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Aggregating platform telemetry and security status...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered Users */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Users</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{overview?.users.total ?? 0}</span>
            <span className="text-xs text-emerald-400 font-medium">registered</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-teal-400" />
              {overview?.users.active30d ?? 0} Active (30d)
            </span>
            <Link to="/admin/users" className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-teal-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Health</span>
            <div
              className={`p-2 rounded-xl border ${
                health?.status === 'HEALTHY'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-extrabold tracking-tight ${
                health?.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {health?.status ?? 'UNKNOWN'}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              uptime {formatUptime(health?.uptimeSeconds ?? 0)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>RAM: {health?.node.memory.rssMb ?? 0} MB • {telemetry?.avgLatencyMs ?? 0}ms Avg</span>
            <Link to="/admin/system" className="text-teal-400 hover:text-teal-300 font-medium flex items-center gap-0.5">
              Diagnostics <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Security & Access Posture */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Security Posture</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {security?.mfaAdoptionPercent ?? 0}%
            </span>
            <span className="text-xs text-indigo-400 font-medium">MFA Enabled</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="text-rose-400">
              {overview?.security.lockedAccounts ?? 0} Locked • {overview?.security.suspendedAccounts ?? 0} Suspended
            </span>
            <Link to="/admin/audit-logs" className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-0.5">
              Audits <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* ML & AI Operations */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">ML & AI Engine</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {features?.ml.categorization.accuracyPercent ?? 96.5}%
            </span>
            <span className="text-xs text-cyan-400 font-medium">Categorization Acc</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>{features?.aiAssistant.totalTokensUsed.toLocaleString() ?? 0} tokens consumed</span>
            <span className="text-cyan-400 font-medium">{features?.aiAssistant.totalQueries ?? 0} queries</span>
          </div>
        </div>
      </div>

      {/* Subsystems & Queues Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Subsystem Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Subsystems Status
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">Live Pings</span>
          </div>

          <div className="space-y-3">
            {/* MongoDB */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">MongoDB Replica / Cluster</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    DB: {health?.databases.mongodb.databaseName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-mono">{health?.databases.mongodb.pingMs}ms</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  {health?.databases.mongodb.status}
                </span>
              </div>
            </div>

            {/* Redis */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">Redis Distributed Cache & Queues</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {health?.databases.redis.host}:{health?.databases.redis.port}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  health?.databases.redis.status === 'CONNECTED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {health?.databases.redis.status}
              </span>
            </div>

            {/* FastAPI ML Service */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">FastAPI ML Microservice</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">
                    {health?.services.fastApiMl.url}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {health?.services.fastApiMl.pingMs !== undefined && (
                  <span className="text-slate-400 font-mono">{health.services.fastApiMl.pingMs}ms</span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    health?.services.fastApiMl.status === 'UP'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {health?.services.fastApiMl.status}
                </span>
              </div>
            </div>

            {/* Market Data Provider */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">Market Data Integration</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Provider: {features?.stockApi.activeProvider}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[10px] font-bold">
                {features?.stockApi.cachedStockPriceCount} Quotes Cached
              </span>
            </div>
          </div>
        </div>

        {/* BullMQ Background Queues */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              BullMQ Queue Depths
            </h2>
            <Link to="/admin/system" className="text-xs text-teal-400 hover:text-teal-300 font-medium">
              View All →
            </Link>
          </div>

          <div className="space-y-3">
            {queues.slice(0, 4).map((q) => (
              <div
                key={q.name}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-[170px]">{q.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span className="text-emerald-400">{q.counts.completed} completed</span>
                    <span>•</span>
                    <span className="text-amber-400">{q.counts.active} active</span>
                    <span>•</span>
                    <span className="text-slate-400">{q.counts.waiting} waiting</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      q.isAvailable
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {q.status}
                  </span>
                  {q.counts.failed > 0 && (
                    <span className="text-[10px] text-rose-400 font-medium mt-1">
                      {q.counts.failed} failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Domain Overview */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Platform Records
            </h2>
            <span className="text-xs text-slate-400">Aggregate Counts</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">Transactions</p>
              <p className="text-xl font-bold text-white mt-1">
                {overview?.domainTotals.transactionsCount.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">Budgets Set</p>
              <p className="text-xl font-bold text-white mt-1">
                {overview?.domainTotals.budgetsCount.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">Portfolios</p>
              <p className="text-xl font-bold text-white mt-1">
                {overview?.domainTotals.portfoliosCount.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">Stock Predictions</p>
              <p className="text-xl font-bold text-white mt-1">
                {overview?.domainTotals.stockPredictionsCount.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">PDF Reports</p>
              <p className="text-xl font-bold text-white mt-1">
                {overview?.domainTotals.reportsGeneratedCount.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">Anomalies Detected</p>
              <p className="text-xl font-bold text-white mt-1">
                {overview?.domainTotals.anomaliesDetectedCount.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Incidents & Privileged Events */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Security Incidents & Access Audit Stream
            </h2>
            <p className="text-xs text-slate-400">
              Live immutable trail of unauthorized attempts, login failures, and account status modifications
            </p>
          </div>
          <Link
            to="/admin/audit-logs"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            Full Audit Trail →
          </Link>
        </div>

        {security?.recentSecurityIncidents && security.recentSecurityIncidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event Action</th>
                  <th className="py-2.5 px-3">Actor Role</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {security.recentSecurityIncidents.slice(0, 6).map((inc, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-rose-400">
                      {inc.action}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {inc.actorRole}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{inc.ipAddress}</td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">
                      {inc.failureReason || 'Security access rejected'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-80" />
            No security incidents or unauthorized privilege attempts detected in recent window.
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
