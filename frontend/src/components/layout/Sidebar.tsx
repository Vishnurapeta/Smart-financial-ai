import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  PieChart,
  Target,
  Layers,
  Briefcase,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  FileText,
  RefreshCw,
  LineChart,
  ShieldCheck,
  ChevronRight,
  X,
  Bot,
} from 'lucide-react';
import { useLayoutContext } from '../../context/LayoutContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  matchPrefix?: string[];
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const layout = useLayoutContext();
  const { user } = useAuth();
  const location = useLocation();

  const isCollapsed = layout?.isCollapsed ?? false;
  const isMobileOpen = layout?.isMobileOpen ?? false;
  const toggleCollapse = layout?.toggleCollapse;
  const setMobileOpen = layout?.setMobileOpen;

  const sections: NavSection[] = [
    {
      title: 'MAIN',
      items: [
        {
          label: 'Dashboard',
          path: '/dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'MONEY',
      items: [
        {
          label: 'Transactions',
          path: '/transactions',
          icon: TrendingUp,
        },
        {
          label: 'Budgets',
          path: '/budgets',
          icon: PieChart,
        },
        {
          label: 'Net Worth',
          path: '/net-worth',
          icon: Layers,
        },
        {
          label: 'Goals',
          path: '/goals',
          icon: Target,
        },
        {
          label: 'Subscriptions',
          path: '/subscriptions',
          icon: RefreshCw,
        },
      ],
    },
    {
      title: 'INVESTMENTS',
      items: [
        {
          label: 'Portfolio',
          path: '/portfolio',
          icon: Briefcase,
        },
        {
          label: 'Stocks',
          path: '/stocks',
          icon: LineChart,
          matchPrefix: ['/stocks/search', '/stocks/AAPL', '/stocks/MSFT', '/stocks/GOOGL'],
        },
        {
          label: 'AI Stock Predictions',
          path: '/stocks/prediction',
          icon: Sparkles,
          matchPrefix: ['/ai-predict', '/stocks/prediction'],
          badge: 'AI',
          badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        },
      ],
    },
    {
      title: 'INTELLIGENCE',
      items: [
        {
          label: 'AI Financial Assistant',
          path: '/ai-assistant',
          icon: Bot,
          matchPrefix: ['/ai-assistant', '/assistant'],
          badge: 'NEW',
          badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
        },
        {
          label: 'Financial Forecasting',
          path: '/forecasting',
          icon: TrendingUp,
        },
        {
          label: 'Anomalies',
          path: '/anomalies',
          icon: AlertTriangle,
          matchPrefix: ['/financial-insights/anomalies'],
        },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        {
          label: 'Financial Reports',
          path: '/reports',
          icon: FileText,
          matchPrefix: ['/reports'],
        },
      ],
    },
  ];

  // Admin section for authorized users
  if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
    sections.push({
      title: 'ADMIN',
      items: [
        {
          label: 'Admin Console',
          path: '/admin',
          icon: ShieldCheck,
          badge: 'RBAC',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        },
      ],
    });
  }

  const isItemActive = (item: NavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix?.some((prefix) => location.pathname.startsWith(prefix))) return true;
    if (
      item.path !== '/dashboard' &&
      item.path !== '/' &&
      location.pathname.startsWith(item.path)
    ) {
      // Avoid matching /stocks when on /stocks/prediction
      if (item.path === '/stocks' && location.pathname.includes('prediction')) return false;
      return true;
    }
    return false;
  };

  const sidebarContent = (
    <aside
      className={`h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Mobile Drawer Header */}
      {isMobileOpen && (
        <div className="h-16 border-b border-slate-800/80 flex items-center justify-between px-4 lg:hidden">
          <NavLink
            to="/dashboard"
            onClick={() => setMobileOpen?.(false)}
            className="flex items-center gap-3 group min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Activity className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">SMARTFIN</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">Financial & Investment Platform</p>
            </div>
          </NavLink>

          <button
            onClick={() => setMobileOpen?.(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Close navigation"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-5 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {/* Section Title */}
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {section.title}
              </div>
            ) : (
              <div className="my-2 border-t border-slate-800/60 mx-1.5" />
            )}

            {/* Section Items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const IconComponent = item.icon;
                const active = isItemActive(item);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (isMobileOpen) setMobileOpen?.(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl transition-all duration-150 ${
                      isCollapsed
                        ? 'justify-center h-10 w-10 mx-auto px-0'
                        : 'px-3 py-2 text-xs font-medium'
                    } ${
                      active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold shadow-sm shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    {/* Active accent bar (expanded) */}
                    {active && !isCollapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-emerald-400" />
                    )}

                    <IconComponent
                      className={`shrink-0 transition-transform duration-150 ${
                        isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
                      } ${active ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'} ${
                        !active && 'group-hover:scale-105'
                      }`}
                    />

                    {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}

                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Tooltip for collapsed view */}
                    {isCollapsed && (
                      <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden group-hover:flex items-center px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-200 shadow-xl whitespace-nowrap animate-in fade-in duration-100">
                        {item.label}
                        {item.badge && (
                          <span
                            className={`ml-1.5 text-[9px] font-bold px-1 py-0.2 rounded border ${
                              item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer / Collapse Toggle when Collapsed */}
      {isCollapsed && (
        <div className="p-3 border-t border-slate-800/80 flex justify-center">
          <button
            onClick={toggleCollapse}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:block shrink-0 h-full z-20">{sidebarContent}</div>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      {/* Mobile Slide-in Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
