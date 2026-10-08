import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.tsx';
import { adminService } from '../../services/admin.service.ts';
import {
  SystemHealthReport,
  QueueJobCounts,
  FeatureMetrics,
  ApiTelemetrySummary,
} from '../../types/admin.ts';
import {
  Server,
  Database,
  Cpu,
  Zap,
  Activity,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export const AdminSystemPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'queues' | 'ai-ml' | 'telemetry'>('infrastructure');
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [queues, setQueues] = useState<QueueJobCounts[]>([]);
  const [features, setFeatures] = useState<FeatureMetrics | null>(null);
  const [telemetry, setTelemetry] = useState<ApiTelemetrySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemData = async () => {
    try {
      setError(null);
      const [hlData, qData, ftData, telData] = await Promise.all([
        adminService.getSystemHealth(),
        adminService.getQueueMetrics(),
        adminService.getFeatureMetrics(),
        adminService.getTelemetryMetrics(),
      ]);
      setHealth(hlData);
      setQueues(qData);
      setFeatures(ftData);
      setTelemetry(telData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load system diagnostics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  const getHeapPercentage = () => {
    if (!health) return 0;
    const total = health.node.memory.heapTotalMb;
    const used = health.node.memory.heapUsedMb;
    return total > 0 ? Math.round((used / total) * 100) : 0;
  };

  return (
    <AdminLayout onRefresh={fetchSystemData} isRefreshing={isLoading}>
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Subsystem Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('infrastructure')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition cursor-pointer ${
            activeTab === 'infrastructure'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Server className="w-4 h-4" />
          Node & Databases
        </button>

        <button
          onClick={() => setActiveTab('queues')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition cursor-pointer ${
            activeTab === 'queues'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          BullMQ Queues ({queues.length})
        </button>

        <button
          onClick={() => setActiveTab('ai-ml')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition cursor-pointer ${
            activeTab === 'ai-ml'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          ML & AI Telemetry
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition cursor-pointer ${
            activeTab === 'telemetry'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          API & Error Monitor
        </button>
      </div>

      {/* TAB 1: Infrastructure & Databases */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Node Process & Memory */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  Node.js Runtime & Memory Allocation
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  {health?.node.version}
                </span>
              </div>

              {/* Memory Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">V8 Heap Utilization</span>
                  <span className="font-mono text-emerald-400 font-bold">{getHeapPercentage()}%</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, getHeapPercentage())}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                  <span>Used: {health?.node.memory.heapUsedMb} MB</span>
                  <span>Total Allocated: {health?.node.memory.heapTotalMb} MB</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Resident Set Size (RSS)</span>
                  <p className="text-base font-bold text-white mt-1 font-mono">{health?.node.memory.rssMb} MB</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">External Buffers</span>
                  <p className="text-base font-bold text-white mt-1 font-mono">{health?.node.memory.externalMb} MB</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Process Platform</span>
                  <p className="text-base font-bold text-white mt-1 font-mono">{health?.node.platform}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Process Uptime</span>
                  <p className="text-base font-bold text-emerald-400 mt-1 font-mono">
                    {formatUptime(health?.uptimeSeconds ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Databases & Network Pings */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-400" />
                  Database Clusters & Endpoints
                </h3>
                <span className="text-xs text-slate-400">Connection Health</span>
              </div>

              {/* MongoDB Details */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">MongoDB Primary Cluster</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {health?.databases.mongodb.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-400">
                  <div>
                    <span>Ping Latency: </span>
                    <span className="font-mono text-white font-semibold">{health?.databases.mongodb.pingMs}ms</span>
                  </div>
                  <div>
                    <span>Target Database: </span>
                    <span className="font-mono text-white font-semibold">{health?.databases.mongodb.databaseName}</span>
                  </div>
                </div>
              </div>

              {/* Redis Details */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Redis Cache & Distributed State</span>
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
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-400">
                  <div>
                    <span>Host: </span>
                    <span className="font-mono text-white font-semibold">{health?.databases.redis.host}</span>
                  </div>
                  <div>
                    <span>Port: </span>
                    <span className="font-mono text-white font-semibold">{health?.databases.redis.port}</span>
                  </div>
                </div>
              </div>

              {/* FastAPI Microservice */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">FastAPI ML Prediction Engine</span>
                  </div>
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
                <div className="text-xs text-slate-400 truncate">
                  <span>Endpoint URL: </span>
                  <span className="font-mono text-white">{health?.services.fastApiMl.url}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BullMQ Queues */}
      {activeTab === 'queues' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Active BullMQ queues handling asynchronous stock evaluations, reports, and notification dispatches
            </p>
            <span className="text-xs text-emerald-400 font-mono font-medium">Auto-synced</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queues.map((q) => (
              <div key={q.name} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <h4 className="text-xs font-bold text-white truncate max-w-[190px]">{q.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      q.isAvailable
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {q.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Active</span>
                    <p className="font-bold text-amber-400 text-sm mt-0.5">{q.counts.active}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Waiting</span>
                    <p className="font-bold text-slate-300 text-sm mt-0.5">{q.counts.waiting}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Delayed</span>
                    <p className="font-bold text-indigo-400 text-sm mt-0.5">{q.counts.delayed}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {q.counts.completed} completed
                  </span>
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    {q.counts.failed} failed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AI & ML Telemetry */}
      {activeTab === 'ai-ml' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Categorization & Active ML Models */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  NLP Categorization & Accuracy
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                  {features?.ml.categorization.accuracyPercent}% Accuracy
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Total Feedbacks</span>
                  <p className="text-lg font-bold text-white mt-1">
                    {features?.ml.categorization.totalFeedback ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Accepted</span>
                  <p className="text-lg font-bold text-emerald-400 mt-1">
                    {features?.ml.categorization.accepted ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Corrected</span>
                  <p className="text-lg font-bold text-amber-400 mt-1">
                    {features?.ml.categorization.corrected ?? 0}
                  </p>
                </div>
              </div>

              {/* Active ML Models List */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-300">Registered Machine Learning Models</h4>
                {features?.ml.activeModels && features.ml.activeModels.length > 0 ? (
                  <div className="space-y-2">
                    {features.ml.activeModels.map((m) => (
                      <div
                        key={m.name}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-white">{m.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            v{m.version} • {m.framework} • {m.datasetSize.toLocaleString()} training samples
                          </p>
                        </div>
                        {m.accuracyScore !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[11px]">
                            {Math.round(m.accuracyScore * 100)}% Acc
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl">
                    No active metadata models recorded yet.
                  </p>
                )}
              </div>
            </div>

            {/* AI Assistant Telemetry */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  AI Assistant Query Engine
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold">
                  {features?.aiAssistant.averageLatencyMs}ms Avg Latency
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Total User Queries</span>
                  <p className="text-xl font-bold text-white mt-1">
                    {features?.aiAssistant.totalQueries.toLocaleString() ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Token Consumption</span>
                  <p className="text-xl font-bold text-indigo-400 mt-1 font-mono">
                    {features?.aiAssistant.totalTokensUsed.toLocaleString() ?? 0}
                  </p>
                </div>
              </div>

              {/* User Ratings Breakdown */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-semibold text-slate-300">User Satisfaction Ratings</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="text-[11px] block">Helpful</span>
                    <span className="font-bold text-sm">{features?.aiAssistant.feedbackBreakdown.helpful}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <span className="text-[11px] block">Unhelpful</span>
                    <span className="font-bold text-sm">{features?.aiAssistant.feedbackBreakdown.unhelpful}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
                    <span className="text-[11px] block">Unrated</span>
                    <span className="font-bold text-sm">{features?.aiAssistant.feedbackBreakdown.unrated}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: API & Telemetry Monitor */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-slate-400">Total Tracked Requests</span>
              <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                {telemetry?.totalRequests.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-slate-400">HTTP 2xx (Success)</span>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
                {telemetry?.statusCodes['2xx'] ?? 0}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-slate-400">HTTP 4xx (Client Rejections)</span>
              <p className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
                {telemetry?.statusCodes['4xx'] ?? 0}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-slate-400">HTTP 5xx (Server Faults)</span>
              <p className="text-2xl font-extrabold text-rose-400 mt-1 font-mono">
                {telemetry?.statusCodes['5xx'] ?? 0}
              </p>
            </div>
          </div>

          {/* Latency Percentiles & Top Routes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Latency Percentiles</h4>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Average</span>
                  <p className="text-lg font-bold text-emerald-400 mt-1 font-mono">{telemetry?.avgLatencyMs}ms</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">95th Percentile</span>
                  <p className="text-lg font-bold text-teal-400 mt-1 font-mono">{telemetry?.p95LatencyMs}ms</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Max Recorded</span>
                  <p className="text-lg font-bold text-amber-400 mt-1 font-mono">{telemetry?.maxLatencyMs}ms</p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Most Active Endpoints</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {telemetry?.topEndpoints && telemetry.topEndpoints.length > 0 ? (
                  telemetry.topEndpoints.map((ep, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-950/60 font-mono">
                      <span className="text-slate-300 truncate max-w-xs">{ep.endpoint}</span>
                      <span className="text-emerald-400 font-bold">{ep.count} hits</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No requests recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Errors Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Recent 4xx / 5xx Error Log Stream
            </h4>

            {telemetry?.recentErrors && telemetry.recentErrors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">URL</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Correlation ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                    {telemetry.recentErrors.slice(0, 10).map((err, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-400">
                          {new Date(err.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-200">{err.method}</td>
                        <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{err.url}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              err.statusCode >= 500
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {err.statusCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">{err.durationMs}ms</td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">{err.correlationId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 p-4 text-center">No errors recorded in recent buffer.</p>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
