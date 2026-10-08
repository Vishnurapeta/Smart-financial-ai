import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.tsx';
import { adminService } from '../../services/admin.service.ts';
import { AdminUserListItem, AdminUserDetails, AccountStatus } from '../../types/admin.ts';
import { RoleName } from '../../types/auth.ts';
import {
  Users,
  Search,
  Shield,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Key,
  MailCheck,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  PieChart,
  FileText,
  BellRing,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States
  const [detailUser, setDetailUser] = useState<AdminUserDetails | null>(null);

  const [statusModalUser, setStatusModalUser] = useState<AdminUserListItem | null>(null);
  const [statusAction, setStatusAction] = useState<'SUSPEND' | 'REACTIVATE' | 'LOCK' | 'UNLOCK'>('SUSPEND');
  const [statusReason, setStatusReason] = useState('');

  const [roleModalUser, setRoleModalUser] = useState<AdminUserListItem | null>(null);
  const [newRole, setNewRole] = useState<RoleName>('USER');

  const [resetTokenData, setResetTokenData] = useState<{ user: AdminUserListItem; token: string } | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.listUsers({
        page,
        limit: 15,
        search: search.trim() || undefined,
        role: selectedRole !== 'ALL' ? selectedRole : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setUsers(res.users);
      setTotal(res.pagination.total);
      setPages(res.pagination.pages);
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to fetch user accounts',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, selectedRole, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleViewDetails = async (userId: string) => {
    try {
      const data = await adminService.getUserDetails(userId);
      setDetailUser(data);
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load user details',
      });
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusModalUser) return;
    try {
      await adminService.updateUserStatus(statusModalUser.id, statusAction, statusReason);
      setActionMessage({
        type: 'success',
        text: `Account status for ${statusModalUser.email} successfully updated to ${statusAction}.`,
      });
      setStatusModalUser(null);
      setStatusReason('');
      fetchUsers();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update user status',
      });
    }
  };

  const handleRoleUpdate = async () => {
    if (!roleModalUser) return;
    try {
      await adminService.updateUserRole(roleModalUser.id, newRole);
      setActionMessage({
        type: 'success',
        text: `User role for ${roleModalUser.email} successfully updated to ${newRole}.`,
      });
      setRoleModalUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update role',
      });
    }
  };

  const handleVerifyEmail = async (userId: string, email: string) => {
    try {
      await adminService.verifyUserEmail(userId);
      setActionMessage({
        type: 'success',
        text: `Email for ${email} manually verified.`,
      });
      fetchUsers();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to verify email',
      });
    }
  };

  const handleResetPassword = async (user: AdminUserListItem) => {
    try {
      const res = await adminService.triggerPasswordReset(user.id);
      setResetTokenData({ user, token: res.resetToken });
      setActionMessage({
        type: 'success',
        text: `Password reset token generated for ${user.email}.`,
      });
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate reset token',
      });
    }
  };

  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <UserX className="w-3 h-3" /> Suspended
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Lock className="w-3 h-3" /> Locked
          </span>
        );
      case 'PENDING_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3 h-3" /> Unverified
          </span>
        );
    }
  };

  return (
    <AdminLayout onRefresh={fetchUsers} isRefreshing={isLoading}>
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl text-sm flex items-center justify-between gap-3 border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header, Search & Filters Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Platform User Accounts
            </h2>
            <p className="text-xs text-slate-400">
              Manage authentication status, role privileges, and security lockouts ({total} total accounts)
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, name..."
                className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 w-52 sm:w-64"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Roles</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="PREMIUM_USER">PREMIUM_USER</option>
              <option value="FINANCIAL_ANALYST">FINANCIAL_ANALYST</option>
              <option value="COMPLIANCE_OFFICER">COMPLIANCE_OFFICER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

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
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="LOCKED">LOCKED</option>
              <option value="UNVERIFIED">UNVERIFIED</option>
            </select>
          </div>

          <div className="ml-auto text-slate-400 text-xs">
            Showing Page <span className="text-white font-semibold">{page}</span> of{' '}
            <span className="text-white font-semibold">{pages || 1}</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">User / Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Security</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-white">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-slate-400 font-mono text-[11px]">{u.email}</p>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : u.role === 'ADMIN'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : u.role === 'PREMIUM_USER'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">{getStatusBadge(u.status)}</td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            u.isMfaEnabled
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                          title={u.isMfaEnabled ? 'MFA Active' : 'MFA Disabled'}
                        >
                          MFA
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            u.isEmailVerified
                              ? 'bg-teal-500/20 text-teal-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                          title={u.isEmailVerified ? 'Email Verified' : 'Unverified'}
                        >
                          {u.isEmailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(u.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="View Non-Sensitive Account Summary"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setRoleModalUser(u);
                            setNewRole(u.role);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition cursor-pointer"
                          title="Change Role"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setStatusModalUser(u);
                            setStatusAction(u.isSuspended ? 'REACTIVATE' : 'SUSPEND');
                            setStatusReason(u.suspendedReason || '');
                          }}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            u.isSuspended
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                          }`}
                          title={u.isSuspended ? 'Reactivate User' : 'Suspend Account'}
                        >
                          {u.isSuspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>

                        {u.lockoutUntil && (
                          <button
                            onClick={() => {
                              setStatusModalUser(u);
                              setStatusAction('UNLOCK');
                            }}
                            className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                            title="Unlock Account"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {!u.isEmailVerified && (
                          <button
                            onClick={() => handleVerifyEmail(u.id, u.email)}
                            className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition cursor-pointer"
                            title="Manually Verify Email"
                          >
                            <MailCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleResetPassword(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition cursor-pointer"
                          title="Generate Password Reset Token"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No users found matching current query and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Total: <span className="text-white font-semibold">{total}</span> accounts
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

      {/* MODAL 1: User Account Details (Least Privilege Enforced) */}
      {detailUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {detailUser.firstName} {detailUser.lastName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{detailUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailUser(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Least Privilege Notice */}
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-2.5 text-xs text-indigo-300">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Least Privilege Enforced:</strong> Detailed financial transaction items, merchant names, bank accounts, and balances are sealed from administrative inspection. Only high-level service metadata is provided.
              </span>
            </div>

            {/* User Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Account Role</span>
                <p className="text-sm font-semibold text-white mt-1">{detailUser.role}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Account Status</span>
                <p className="mt-1">{getStatusBadge(detailUser.status)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">MFA Enrolled</span>
                <p className="text-sm font-semibold text-white mt-1">
                  {detailUser.isMfaEnabled ? 'Enabled (TOTP)' : 'Disabled'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Email Verification</span>
                <p className="text-sm font-semibold text-white mt-1">
                  {detailUser.isEmailVerified ? 'Verified' : 'Pending'}
                </p>
              </div>
            </div>

            {/* High Level Counts */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Platform Activity Counts
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <PieChart className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <span className="text-slate-400 text-[10px]">Budgets</span>
                  <p className="font-bold text-white text-sm">{detailUser.summaryStats.budgetCount}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <Layers className="w-4 h-4 text-teal-400 mx-auto mb-1" />
                  <span className="text-slate-400 text-[10px]">Portfolios</span>
                  <p className="font-bold text-white text-sm">{detailUser.summaryStats.portfolioCount}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <BellRing className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <span className="text-slate-400 text-[10px]">Alerts</span>
                  <p className="font-bold text-white text-sm">{detailUser.summaryStats.activeAlertsCount}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <FileText className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                  <span className="text-slate-400 text-[10px]">Reports</span>
                  <p className="font-bold text-white text-sm">{detailUser.summaryStats.reportsGeneratedCount}</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Account Status Action (Suspend / Reactivate / Lock / Unlock) */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div
                className={`p-2 rounded-xl border ${
                  statusAction === 'SUSPEND' || statusAction === 'LOCK'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {statusAction === 'SUSPEND' ? (
                  <UserX className="w-5 h-5" />
                ) : statusAction === 'LOCK' ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {statusAction === 'SUSPEND' && 'Suspend User Account'}
                  {statusAction === 'REACTIVATE' && 'Reactivate User Account'}
                  {statusAction === 'LOCK' && 'Lock User Account (24h)'}
                  {statusAction === 'UNLOCK' && 'Unlock User Account'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{statusModalUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {statusAction === 'SUSPEND' &&
                'Suspension blocks login sessions immediately. The user will be notified of the administrative suspension reason.'}
              {statusAction === 'REACTIVATE' &&
                'Reactivating restores standard login permissions and clears any active administrative suspensions.'}
              {statusAction === 'LOCK' &&
                'Temporarily locks the account for 24 hours to prevent brute-force attacks or suspicious activity.'}
              {statusAction === 'UNLOCK' &&
                'Clears the lockout expiration and resets failed login counters.'}
            </p>

            {(statusAction === 'SUSPEND' || statusAction === 'LOCK') && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Suspension / Lock Reason (Logged to Audit Trail)
                </label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Terms violation, compromised credentials..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-500/50"
                />
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setStatusModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
                  statusAction === 'SUSPEND' || statusAction === 'LOCK'
                    ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                Confirm {statusAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Role */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Privileged Role Assignment</h3>
                <p className="text-xs text-slate-400 font-mono">{roleModalUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Select the new security role. This privileged change is recorded immutably in the platform audit trail.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as RoleName)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="USER">USER (Standard Access)</option>
                <option value="PREMIUM_USER">PREMIUM_USER (Priority features)</option>
                <option value="FINANCIAL_ANALYST">FINANCIAL_ANALYST (Advanced analytics)</option>
                <option value="COMPLIANCE_OFFICER">COMPLIANCE_OFFICER (Audits & compliance)</option>
                <option value="ADMIN">ADMIN (Full administrative monitoring)</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (Requires SUPER_ADMIN authority)</option>
              </select>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setRoleModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleUpdate}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-500/20"
              >
                Apply Role Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Temporary Password Reset Token Display */}
      {resetTokenData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Password Reset Token Generated</h3>
                <p className="text-xs text-slate-400 font-mono">{resetTokenData.user.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              A temporary 1-hour password reset token has been issued. Provide this token securely to the user or transmit via verified out-of-band communication:
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
              {resetTokenData.token}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setResetTokenData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
