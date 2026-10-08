import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  ChevronRight,
  LogOut,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLayoutContext } from '../../context/LayoutContext.tsx';
import { NotificationBell } from '../notifications/NotificationBell.tsx';

interface PageMeta {
  section: string;
  title: string;
}

const getPageMeta = (pathname: string): PageMeta => {
  if (pathname === '/dashboard') return { section: 'MAIN', title: 'Financial Dashboard' };
  if (pathname.startsWith('/transactions'))
    return { section: 'MONEY', title: 'Transaction Ledger' };
  if (pathname.startsWith('/budgets')) return { section: 'MONEY', title: 'Monthly Budgets' };
  if (pathname.startsWith('/net-worth')) return { section: 'MONEY', title: 'Net Worth & Wealth' };
  if (pathname.startsWith('/goals')) return { section: 'MONEY', title: 'Financial Goals' };
  if (pathname.startsWith('/subscriptions'))
    return { section: 'MONEY', title: 'Subscriptions & Recurring' };
  if (pathname.startsWith('/portfolio'))
    return { section: 'INVESTMENTS', title: 'Investment Portfolio' };
  if (pathname.startsWith('/stocks/prediction') || pathname === '/ai-predict') {
    return { section: 'INVESTMENTS', title: 'AI Stock Predictions' };
  }
  if (pathname.startsWith('/stocks'))
    return { section: 'INVESTMENTS', title: 'Stocks & Market Data' };
  if (pathname.startsWith('/forecasting'))
    return { section: 'INTELLIGENCE', title: 'Financial Forecasting' };
  if (pathname.startsWith('/anomalies') || pathname.startsWith('/financial-insights/anomalies')) {
    return { section: 'INTELLIGENCE', title: 'Spending Anomalies' };
  }
  if (pathname.startsWith('/reports')) return { section: 'REPORTS', title: 'Financial Reports' };
  if (pathname.startsWith('/ai-assistant') || pathname.startsWith('/assistant'))
    return { section: 'INTELLIGENCE', title: 'AI Financial Assistant' };
  if (pathname.startsWith('/notifications'))
    return { section: 'SYSTEM', title: 'Notifications & Alerts' };
  if (pathname.startsWith('/settings/notifications'))
    return { section: 'SYSTEM', title: 'Alert Preferences' };
  if (pathname.startsWith('/admin')) return { section: 'ADMIN', title: 'Administration Center' };
  if (pathname.startsWith('/account')) return { section: 'ACCOUNT', title: 'Account Settings' };
  return { section: 'SMARTFIN', title: 'Platform Intelligence' };
};

export const TopHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const layout = useLayoutContext();
  const location = useLocation();

  const isCollapsed = layout?.isCollapsed ?? false;
  const toggleCollapse = layout?.toggleCollapse;
  const toggleMobileOpen = layout?.toggleMobileOpen;

  const { section, title } = getPageMeta(location.pathname);

  return (
    <header className="h-16 shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Brand Logo, Sidebar Toggles & Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={toggleMobileOpen}
          className="lg:hidden p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
          title="Open navigation"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Logo in Top Header */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Activity className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-sm font-black tracking-tight text-white">SMARTFIN</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              AI
            </span>
          </div>
        </Link>

        {/* Vertical divider */}
        <div className="hidden lg:block h-5 w-px bg-slate-800 shrink-0" />

        {/* Desktop Collapse/Expand Toggle */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white transition-colors shrink-0"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeft className="w-4 h-4 text-emerald-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Breadcrumb Hierarchy */}
        <div className="flex items-center gap-2 text-xs truncate">
          <span className="font-bold tracking-wider text-slate-500 uppercase text-[11px] hidden md:inline">
            {section}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden md:inline" />
          <h1 className="font-bold text-white tracking-tight truncate text-sm sm:text-base">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Security Pill, Notifications, User Menu, Logout */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Verification Status Pill */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-[11px]">JWT + RBAC Active</span>
        </div>

        {/* Notifications Bell */}
        <NotificationBell />

        {/* User Account Capsule */}
        {user && (
          <Link
            to="/account"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-200 transition-colors group"
            title="Manage account"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-[11px] shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              {user.firstName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-bold text-white text-xs leading-none">{user.firstName}</span>
              <span className="text-[10px] text-emerald-400 font-semibold leading-tight">
                {user.role}
              </span>
            </div>
          </Link>
        )}

        {/* Sign Out Button */}
        <button
          onClick={() => logout()}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors cursor-pointer"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
