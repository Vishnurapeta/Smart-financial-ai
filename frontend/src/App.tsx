import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { CurrencyProvider } from './context/CurrencyContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { Header } from './components/Header.tsx';
import { ServiceStatus } from './components/ServiceStatus.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { NotificationToaster } from './components/notifications/NotificationToast.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';

// Code-split route components to prevent monolithic frontend bundle
const LoginPage = lazy(() =>
  import('./pages/LoginPage.tsx').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage.tsx').then((m) => ({ default: m.RegisterPage })),
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage.tsx').then((m) => ({ default: m.AccountPage })),
);
const TransactionsPage = lazy(() =>
  import('./pages/TransactionsPage.tsx').then((m) => ({ default: m.TransactionsPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.tsx').then((m) => ({ default: m.DashboardPage })),
);
const BudgetsPage = lazy(() =>
  import('./pages/BudgetsPage.tsx').then((m) => ({ default: m.BudgetsPage })),
);
const SubscriptionsPage = lazy(() =>
  import('./pages/SubscriptionsPage.tsx').then((m) => ({ default: m.SubscriptionsPage })),
);
const GoalsPage = lazy(() =>
  import('./pages/GoalsPage.tsx').then((m) => ({ default: m.GoalsPage })),
);
const NetWorthPage = lazy(() =>
  import('./pages/NetWorthPage.tsx').then((m) => ({ default: m.NetWorthPage })),
);
const StocksPage = lazy(() =>
  import('./pages/StocksPage.tsx').then((m) => ({ default: m.StocksPage })),
);
const StockPredictionPage = lazy(() =>
  import('./pages/stocks/StockPredictionPage.tsx').then((m) => ({
    default: m.StockPredictionPage,
  })),
);
const StockDetailsPage = lazy(() =>
  import('./pages/stocks/StockDetailsPage.tsx').then((m) => ({ default: m.StockDetailsPage })),
);
const StockSearchPage = lazy(() =>
  import('./pages/stocks/StockSearchPage.tsx').then((m) => ({ default: m.StockSearchPage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage.tsx').then((m) => ({ default: m.PortfolioPage })),
);
const FinancialForecastingPage = lazy(() =>
  import('./pages/forecasting/FinancialForecastingPage.tsx').then((m) => ({
    default: m.FinancialForecastingPage,
  })),
);
const AnomaliesPage = lazy(() =>
  import('./pages/anomalies/AnomaliesPage.tsx').then((m) => ({ default: m.AnomaliesPage })),
);
const AIAssistantPage = lazy(() => import('./pages/assistant/AIAssistantPage.tsx'));
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage.tsx').then((m) => ({ default: m.NotificationsPage })),
);
const NotificationPreferencesPage = lazy(() =>
  import('./pages/NotificationPreferencesPage.tsx').then((m) => ({
    default: m.NotificationPreferencesPage,
  })),
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage.tsx').then((m) => ({ default: m.ReportsPage })),
);
const ReportDetailPage = lazy(() =>
  import('./pages/ReportDetailPage.tsx').then((m) => ({ default: m.ReportDetailPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage.tsx').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminUsersPage = lazy(() =>
  import('./pages/admin/AdminUsersPage.tsx').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminSystemPage = lazy(() =>
  import('./pages/admin/AdminSystemPage.tsx').then((m) => ({ default: m.AdminSystemPage })),
);
const AdminAuditLogsPage = lazy(() =>
  import('./pages/admin/AdminAuditLogsPage.tsx').then((m) => ({ default: m.AdminAuditLogsPage })),
);

const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
    <p className="mt-4 text-xs font-semibold text-slate-400 uppercase tracking-widest animate-pulse">
      Loading SmartFin AI...
    </p>
  </div>
);
import {
  TrendingUp,
  PieChart,
  Briefcase,
  Shield,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  Lock,
  GitBranch,
  KeyRound,
  UserCheck,
  Sparkles,
} from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Milestone 1 Active • Production Authentication & Authorization Deployed
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Personal Finance, Investment &{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Stock Market Intelligence
              </span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Enterprise-grade SaaS platform with short-lived JWT access tokens, HTTP-only refresh
              tokens, RBAC roles, resource ownership isolation, and immutable audit logs.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all"
              >
                <PieChart className="w-4 h-4" />
                Financial Dashboard
              </Link>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-colors"
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Transactions Ledger
              </Link>
              <Link
                to="/net-worth"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-colors"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                Net Worth & Wealth
              </Link>
              <Link
                to="/goals"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-colors"
              >
                <TrendingUp className="w-4 h-4 text-teal-400" />
                Financial Goals
              </Link>
              <Link
                to="/subscriptions"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-colors"
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                Subscriptions & Recurring
              </Link>
              <Link
                to="/stocks"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-colors"
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Stocks & Market Data
              </Link>
              <Link
                to="/stocks/prediction"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                AI Stock Predictions
              </Link>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
              >
                <Briefcase className="w-4 h-4 text-emerald-400" />
                Investment Portfolio
              </Link>
              <Link
                to="/forecasting"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/40 text-teal-300 text-xs font-semibold transition-colors"
              >
                <TrendingUp className="w-4 h-4 text-teal-400" />
                Financial Forecasting
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                Register
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition-colors"
              >
                <KeyRound className="w-4 h-4 text-emerald-400" />
                Sign In
              </Link>
              <Link
                to="/account"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Session Info
              </Link>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                Python FastAPI Microservice
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                MongoDB 7.0 + Mongoose 8
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Bcrypt + JWT + Helmet + Rate Limiter
              </span>
            </div>
          </div>
        </section>

        {/* Live Service Topology Probes */}
        <ServiceStatus />

        {/* Architectural Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
              <PieChart className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Personal Wealth Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-account consolidation, automated transaction deduplication, budget rollover
              tracking, and recurring subscription detection.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 border border-teal-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Market & Portfolio Intelligence
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time stock watchlist streaming via Socket.IO, mark-to-market position P&L, and
              LSTM/XGBoost short-horizon price forecasting.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 border border-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Zero-Trust & Compliance</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Client never interfaces directly with database secrets. Short-lived JWT pairs,
              HTTP-only cookie protection, RBAC, and immutable audit logs.
            </p>
          </div>
        </section>

        {/* Documentation Hub */}
        <section className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">
                System Documentation & Specifications
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">docs/*.md</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { name: 'Architecture', file: 'ARCHITECTURE.md' },
              { name: 'Roadmap', file: 'ROADMAP.md' },
              { name: 'Database', file: 'DATABASE.md' },
              { name: 'API Contract', file: 'API.md' },
              { name: 'ML Specs', file: 'ML_ARCHITECTURE.md' },
              { name: 'Security', file: 'SECURITY.md' },
            ].map((doc) => (
              <div
                key={doc.file}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-emerald-500/40 transition group cursor-default"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white group-hover:text-emerald-400 transition">
                    {doc.name}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                </div>
                <span className="text-[10px] text-slate-400 font-mono block mt-1">{doc.file}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-500" />
            <span>SMARTFIN AI Enterprise Platform • Production Auth Architecture Active</span>
          </div>
          <div className="flex items-center gap-4">
            <span>TypeScript Strict Mode</span>
            <span>FastAPI ASGI</span>
            <span>React Router v7</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CurrencyProvider>
          <NotificationProvider>
            <BrowserRouter>
              <NotificationToaster />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Landing & Authentication */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Authenticated Platform Shell Layout Routes */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/budgets" element={<BudgetsPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/net-worth" element={<NetWorthPage />} />
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/subscriptions" element={<SubscriptionsPage />} />
                    <Route path="/stocks" element={<StocksPage />} />
                    <Route path="/stocks/search" element={<StockSearchPage />} />
                    <Route path="/stocks/prediction" element={<StockPredictionPage />} />
                    <Route path="/stocks/:symbol/prediction" element={<StockPredictionPage />} />
                    <Route path="/stocks/:symbol" element={<StockDetailsPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/forecasting" element={<FinancialForecastingPage />} />
                    <Route path="/anomalies" element={<AnomaliesPage />} />
                    <Route path="/ai-assistant" element={<AIAssistantPage />} />
                    <Route path="/assistant" element={<Navigate to="/ai-assistant" replace />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/reports/:id" element={<ReportDetailPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route
                      path="/ai-predict"
                      element={<Navigate to="/stocks/prediction" replace />}
                    />
                  </Route>

                  {/* Admin Platform Shell Layout Routes */}
                  <Route
                    element={
                      <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/admin/users" element={<AdminUsersPage />} />
                    <Route path="/admin/system" element={<AdminSystemPage />} />
                    <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
                  </Route>

                  {/* Legacy route redirects & fallback */}
                  <Route
                    path="/financial-insights/anomalies"
                    element={<Navigate to="/anomalies" replace />}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </NotificationProvider>
        </CurrencyProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
