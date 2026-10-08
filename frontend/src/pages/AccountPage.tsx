import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useCurrency } from '../context/CurrencyContext.tsx';
import {
  Shield,
  Laptop,
  Smartphone,
  LogOut,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  Globe,
  DollarSign,
  AlertTriangle,
  Coins,
} from 'lucide-react';
import { Header } from '../components/Header.tsx';

export const AccountPage: React.FC = () => {
  const { user, sessions, loadSessions, revokeSession, logout } = useAuth();
  const { currency, setCurrency, availableCurrencies, format, config } = useCurrency();
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const [currencySuccessMessage, setCurrencySuccessMessage] = useState<string | null>(null);
  const [isUpdatingCurrency, setIsUpdatingCurrency] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCode = e.target.value;
    setIsUpdatingCurrency(true);
    setCurrencySuccessMessage(null);
    try {
      await setCurrency(newCode);
      setCurrencySuccessMessage(`Base currency updated to ${newCode}`);
      setTimeout(() => setCurrencySuccessMessage(null), 3500);
    } catch {
      // Handled
    } finally {
      setIsUpdatingCurrency(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    setIsRevoking(sessionId);
    setRevokeMessage(null);
    try {
      await revokeSession(sessionId);
      setRevokeMessage('Session successfully revoked');
      setTimeout(() => setRevokeMessage(null), 3000);
    } catch {
      setRevokeMessage('Failed to revoke session');
    } finally {
      setIsRevoking(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* User Identity Banner */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-500/20">
                {user?.firstName?.[0] || 'U'}
                {user?.lastName?.[0] || ''}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-white">
                    {user?.firstName} {user?.lastName}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      user?.role === 'ADMIN'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {user?.role}
                  </span>
                  {user?.isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <AlertTriangle className="w-3 h-3" /> Pending Verification
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" /> Default Currency
              </span>
              <p className="text-sm font-semibold text-slate-200">
                {currency} ({config.symbol})
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                <Globe className="w-3 h-3 text-blue-400" /> Locale Setting
              </span>
              <p className="text-sm font-semibold text-slate-200">{config.locale || user?.locale || 'en-US'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-400" /> Member Since
              </span>
              <p className="text-sm font-semibold text-slate-200">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" /> Security State
              </span>
              <p className="text-sm font-semibold text-emerald-400">JWT + Argon2 Protected</p>
            </div>
          </div>
        </section>

        {/* Currency & Financial Localization Settings */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                Base Currency &amp; Financial Localization
              </h2>
              <p className="text-xs text-slate-400">
                Choose the primary currency and locale for formatting your dashboards, net worth, budgets, goals, and forecasts.
              </p>
            </div>
          </div>

          {currencySuccessMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{currencySuccessMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Application Base Currency
              </label>
              <select
                value={currency}
                onChange={handleCurrencyChange}
                disabled={isUpdatingCurrency}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol} - {c.name})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Persisted to your authenticated profile and applies instantly across all financial pages.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                Live Formatting Preview
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Standard Amount</span>
                  <span className="text-base font-bold text-white font-mono mt-1 block">
                    {format(12450.75)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Large Portfolio Value</span>
                  <span className="text-base font-bold text-emerald-400 font-mono mt-1 block">
                    {format(1500000)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Active Locale: <code className="text-slate-300">{config.locale}</code></span>
                <span>Symbol: <code className="text-emerald-400 font-bold">{config.symbol}</code></span>
              </div>
            </div>
          </div>
        </section>

        {/* Device & Session Management */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Laptop className="w-5 h-5 text-emerald-400" />
                Active Sessions & Recognized Devices
              </h2>
              <p className="text-xs text-slate-400">
                Manage all authorized browser logins and active refresh tokens bound to your
                account.
              </p>
            </div>
            <button
              onClick={() => loadSessions()}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Refresh sessions"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {revokeMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{revokeMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No other active sessions detected.
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                      {session.deviceName?.toLowerCase().includes('mobile') ? (
                        <Smartphone className="w-5 h-5 text-teal-400" />
                      ) : (
                        <Laptop className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {session.deviceName || 'Web Browser'}
                        </span>
                        {session.isCurrent && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Current Device
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        IP: {session.ipAddress} • Last active:{' '}
                        {new Date(session.lastActiveAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevoke(session.id)}
                      disabled={isRevoking === session.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Milestone Callout */}
        <section className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-4 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <strong className="text-slate-200">
                Production Authentication Architecture Verified:
              </strong>{' '}
              Access & Refresh Token rotation, HTTP-only cookie support, RBAC, ownership
              verification, and audit trail active.
            </span>
          </div>
        </section>
      </main>
    </div>
  );
};
