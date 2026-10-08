import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.tsx';
import { adminService } from '../../services/admin.service.ts';
import { AuditLogItem, AuditStats } from '../../types/admin.ts';
import {
  FileSpreadsheet,
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedActorRole, setSelectedActorRole] = useState<string>('ALL');

  // Expanded log IDs for diff inspect
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [logsData, statsData] = await Promise.all([
        adminService.listAuditLogs({
          page,
          limit: 25,
          search: search.trim() || undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          action: selectedAction !== 'ALL' ? selectedAction : undefined,
          actorRole: selectedActorRole !== 'ALL' ? selectedActorRole : undefined,
        }),
        adminService.getAuditStats(),
      ]);

      setLogs(logsData.logs);
      setTotal(logsData.pagination.total);
      setPages(logsData.pagination.pages);
      setStats(statsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve audit trail');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [page, selectedStatus, selectedAction, selectedActorRole]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuditData();
  };

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getActionColor = (action: string, status: string) => {
    if (status === 'FAILURE' || action.includes('DENIED') || action.includes('LOCKED')) {
      return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }
    if (action.includes('ADMIN') || action.includes('PRIVILEGED')) {
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  return (
    <AdminLayout onRefresh={fetchAuditData} isRefreshing={isLoading}>
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Audit Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Total Audit Logs</span>
          <p className="text-2xl font-extrabold text-white mt-1 font-mono">
            {stats?.totalLogs.toLocaleString() ?? 0}
          </p>
          <span className="text-[11px] text-slate-500">Immutable ledger records</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Successful Events</span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
            {stats?.successCount.toLocaleString() ?? 0}
          </p>
          <span className="text-[11px] text-emerald-500/80">Authorized actions</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Security Failures</span>
          <p className="text-2xl font-extrabold text-rose-400 mt-1 font-mono">
            {stats?.failureCount.toLocaleString() ?? 0}
          </p>
          <span className="text-[11px] text-rose-500/80">Rejections & lockouts</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Top Recorded Action</span>
          <p className="text-sm font-bold text-amber-400 mt-2 truncate font-mono">
            {stats?.topActions[0]?.action ?? 'N/A'}
          </p>
          <span className="text-[11px] text-slate-400">
            {stats?.topActions[0]?.count ?? 0} occurrences
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Immutable Audit Trail
            </h2>
            <p className="text-xs text-slate-400">
              Query tamper-proof system audit records with state before/after diffs ({total} entries)
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action, IP, resource..."
                className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 w-52 sm:w-64"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Actor Role:</span>
            <select
              value={selectedActorRole}
              onChange={(e) => {
                setSelectedActorRole(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Actor Roles</option>
              <option value="ANONYMOUS">ANONYMOUS</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Action:</span>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Actions</option>
              <option value="PRIVILEGED_ACCESS_DENIED">PRIVILEGED_ACCESS_DENIED</option>
              <option value="PRIVILEGED_USER_ROLE_UPDATED">PRIVILEGED_USER_ROLE_UPDATED</option>
              <option value="ADMIN_USER_STATUS_SUSPEND">ADMIN_USER_STATUS_SUSPEND</option>
              <option value="ADMIN_USER_STATUS_REACTIVATE">ADMIN_USER_STATUS_REACTIVATE</option>
              <option value="ADMIN_MANUAL_EMAIL_VERIFIED">ADMIN_MANUAL_EMAIL_VERIFIED</option>
              <option value="ADMIN_TRIGGERED_PASSWORD_RESET">ADMIN_TRIGGERED_PASSWORD_RESET</option>
              <option value="AUTH_LOGIN_FAILED">AUTH_LOGIN_FAILED</option>
              <option value="AUTH_LOGIN_LOCKED">AUTH_LOGIN_LOCKED</option>
            </select>
          </div>

          <div className="ml-auto text-slate-400 text-xs">
            Showing Page <span className="text-white font-semibold">{page}</span> of{' '}
            <span className="text-white font-semibold">{pages || 1}</span>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">IP / User Agent</th>
                <th className="py-3 px-4 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log._id;
                  const hasDetails = log.changes || log.failureReason;

                  return (
                    <React.Fragment key={log._id}>
                      <tr className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${getActionColor(
                              log.action,
                              log.status,
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                            {log.actorRole}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-200">{log.resource}</span>
                          {log.resourceId && (
                            <span className="block text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                              {log.resourceId}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle className="w-3.5 h-3.5" /> SUCCESS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                              <XCircle className="w-3.5 h-3.5" /> FAILURE
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          <div>{log.ipAddress}</div>
                          <span className="text-[10px] text-slate-500 truncate max-w-[140px] block">
                            {log.userAgent}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {hasDetails ? (
                            <button
                              onClick={() => toggleExpand(log._id)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                            >
                              <span>{isExpanded ? 'Hide' : 'Diff'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px]">None</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Changes / Error Diff Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80">
                          <td colSpan={7} className="p-4 border-b border-slate-800 space-y-2">
                            {log.failureReason && (
                              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                                <strong>Failure Reason:</strong> {log.failureReason}
                              </div>
                            )}

                            {log.changes && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                  State Mutation Diff:
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-rose-400 font-bold block mb-1">
                                      - Before State:
                                    </span>
                                    <pre className="text-slate-400 text-[11px] overflow-x-auto">
                                      {JSON.stringify(log.changes.before || {}, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-emerald-400 font-bold block mb-1">
                                      + After State:
                                    </span>
                                    <pre className="text-slate-200 text-[11px] overflow-x-auto">
                                      {JSON.stringify(log.changes.after || {}, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No audit records matching query parameters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Total: <span className="text-white font-semibold">{total}</span> audit records
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              {page} / {pages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
