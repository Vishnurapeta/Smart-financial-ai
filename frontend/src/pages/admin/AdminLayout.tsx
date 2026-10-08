import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Header } from '../../components/Header.tsx';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Server,
  FileSpreadsheet,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface AdminLayoutProps {
  children?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, onRefresh, isRefreshing }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      {/* Admin Security Banner: Least Privilege Notification */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border-b border-emerald-500/20 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold">Principle of Least Privilege Active:</span>
            <span className="text-slate-300">
              Administrators are restricted to platform metadata & telemetry. Personal transactions, account numbers, and private balances are sealed.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[11px] border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              RBAC Verified
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:opacity-50"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Sync</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Admin Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Administration Control Center
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Production Enterprise
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Real-time infrastructure health, queue telemetry, security controls & audit trail
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs">
            <NavLink
              to="/admin"
              end
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Overview
            </NavLink>

            <NavLink
              to="/admin/users"
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Users className="w-3.5 h-3.5" />
              User Accounts
            </NavLink>

            <NavLink
              to="/admin/system"
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Server className="w-3.5 h-3.5" />
              System & Queues
            </NavLink>

            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Audit Logs
            </NavLink>
          </nav>
        </div>

        {/* Child page content */}
        {children || <Outlet />}
      </main>
    </div>
  );
};
