import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  ShieldAlert,
  Sparkles,
  Trash2,
  Check,
  Sliders,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.tsx';
import { AlertService } from '../services/alert.service.ts';
import { AppNotification } from '../types/alert.ts';

export const NotificationsPage: React.FC = () => {
  const {
    unreadCount,
    isSocketConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'BUDGET' | 'BILLS' | 'STOCKS' | 'ANOMALIES' | 'SYSTEM'>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testForm, setTestForm] = useState({
    title: 'Test Portfolio Milestone Reached',
    message: 'Your total portfolio net worth has crossed $100,000 threshold!',
    type: 'PORTFOLIO_UPDATE',
    severity: 'INFO',
    actionUrl: '/portfolio',
  });
  const [testSending, setTestSending] = useState(false);

  const fetchPageNotifications = async () => {
    try {
      setLoading(true);
      const res = await AlertService.getNotifications({ limit: 100 });
      setNotifications(res.notifications);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageNotifications();
  }, []);

  const handleSendTestAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTestSending(true);
      await AlertService.sendTestNotification(testForm);
      setIsTestModalOpen(false);
      // Wait a moment for socket or backend dispatch
      setTimeout(() => {
        fetchPageNotifications();
      }, 500);
    } catch (err) {
      console.error('Failed to trigger test notification', err);
    } finally {
      setTestSending(false);
    }
  };

  // Filter logic
  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'UNREAD' && notif.isRead) return false;
    if (activeTab === 'BUDGET' && notif.type !== 'BUDGET_THRESHOLD' && notif.type !== 'BUDGET_EXCEEDED') return false;
    if (activeTab === 'BILLS' && notif.type !== 'RECURRING_PAYMENT_DUE' && notif.type !== 'SUBSCRIPTION_RENEWAL' && notif.type !== 'BILL_DUE') return false;
    if (activeTab === 'STOCKS' && notif.type !== 'STOCK_ALERT') return false;
    if (activeTab === 'ANOMALIES' && notif.type !== 'ANOMALY_DETECTED') return false;
    if (activeTab === 'SYSTEM' && notif.type !== 'SYSTEM' && notif.type !== 'MONTHLY_REPORT' && notif.type !== 'PORTFOLIO_UPDATE') return false;

    if (selectedSeverity !== 'ALL' && notif.severity !== selectedSeverity) return false;

    return true;
  });

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            CRITICAL
          </span>
        );
      case 'ALERT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            ALERT
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            WARNING
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
            INFO
          </span>
        );
    }
  };

  const getBorderColor = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-l-rose-500 border-l-4';
      case 'ALERT':
        return 'border-l-rose-400 border-l-4';
      case 'WARNING':
        return 'border-l-amber-400 border-l-4';
      case 'INFO':
      default:
        return 'border-l-emerald-500 border-l-4';
    }
  };

  const getTypeIcon = (type?: string, severity?: string) => {
    if (severity === 'CRITICAL' || severity === 'ALERT') {
      return <ShieldAlert className="w-5 h-5 text-rose-400" />;
    }
    switch (type) {
      case 'BUDGET_THRESHOLD':
      case 'BUDGET_EXCEEDED':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'RECURRING_PAYMENT_DUE':
        return <CreditCard className="w-5 h-5 text-sky-400" />;
      case 'SUBSCRIPTION_RENEWAL':
        return <RefreshCw className="w-5 h-5 text-indigo-400" />;
      case 'ANOMALY_DETECTED':
        return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      case 'STOCK_ALERT':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Enterprise Alerts
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Event-Driven Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Notification & Alert Center
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time multi-channel delivery across in-app, WebSockets, and email with intelligent deduplication.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsTestModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Test Alert</span>
            </button>

            <Link
              to="/settings/notifications"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </Link>
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-xs text-slate-400 font-medium">Total Received</span>
            <div className="text-2xl font-bold text-white mt-1">{notifications.length}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-xs text-slate-400 font-medium">Unread</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{unreadCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-xs text-slate-400 font-medium">Real-time WebSocket</span>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isSocketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="text-xs font-semibold text-slate-200">
                {isSocketConnected ? 'Active (Live)' : 'Reconnecting'}
              </span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-xs text-slate-400 font-medium">Delivery Channels</span>
            <div className="text-xs font-semibold text-slate-300 mt-2 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-400">In-App</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-sky-400">Socket.IO</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-indigo-400">Email</span>
            </div>
          </div>
        </div>

        {/* Filter and Tab Navigation */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-2 rounded-2xl bg-slate-900/80 border border-slate-800">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'UNREAD', label: `Unread (${unreadCount})` },
              { id: 'BUDGET', label: 'Budgets' },
              { id: 'BILLS', label: 'Bills & Subscriptions' },
              { id: 'STOCKS', label: 'Stocks' },
              { id: 'ANOMALIES', label: 'Anomalies' },
              { id: 'SYSTEM', label: 'System' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Severity & Actions */}
          <div className="flex items-center gap-2 px-1">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="ALERT">Alerts</option>
              <option value="WARNING">Warnings</option>
              <option value="INFO">Informational</option>
            </select>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 text-xs font-medium text-emerald-400 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}

            <button
              onClick={fetchPageNotifications}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
              <p className="text-xs">Loading enterprise notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-20 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 p-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">No notifications found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No alerts matching the selected filter criteria. Real-time notifications will automatically stream here.
              </p>
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700 transition-colors"
              >
                Trigger a Test Alert
              </button>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const borderClass = getBorderColor(notif.severity);
              return (
                <div
                  key={notif._id}
                  className={`p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all ${borderClass} ${
                    !notif.isRead ? 'shadow-lg shadow-emerald-500/5' : 'opacity-85'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-800/90 shrink-0 mt-0.5 border border-slate-700/40">
                        {getTypeIcon(notif.type, notif.severity)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-sm tracking-tight ${
                              !notif.isRead ? 'font-bold text-white' : 'font-medium text-slate-300'
                            }`}
                          >
                            {notif.title}
                          </h3>

                          {getSeverityBadge(notif.severity)}

                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          )}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                          {notif.message}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400">
                          <span>{new Date(notif.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span className="text-slate-400 uppercase font-mono text-[10px]">
                            {notif.type?.replace(/_/g, ' ')}
                          </span>
                          {notif.channels && notif.channels.length > 0 && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                {notif.channels.map((ch) => (
                                  <span
                                    key={ch}
                                    className="px-1.5 py-0.2 rounded bg-slate-800/80 text-[9px] text-slate-400 border border-slate-700/50"
                                  >
                                    {ch}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {notif.actionUrl && (
                        <button
                          onClick={() => {
                            if (!notif.isRead && notif._id) markAsRead(notif._id);
                            navigate(notif.actionUrl!);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      {!notif.isRead && (
                        <button
                          onClick={() => notif._id && markAsRead(notif._id)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700/60 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => notif._id && deleteNotification(notif._id)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Test Alert Modal */}
        {isTestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Trigger Test Enterprise Alert</h3>
                </div>
                <button
                  onClick={() => setIsTestModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendTestAlert} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Notification Type
                  </label>
                  <select
                    value={testForm.type}
                    onChange={(e) => setTestForm({ ...testForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  >
                    <option value="BUDGET_THRESHOLD">BUDGET_THRESHOLD</option>
                    <option value="BUDGET_EXCEEDED">BUDGET_EXCEEDED</option>
                    <option value="STOCK_ALERT">STOCK_ALERT</option>
                    <option value="RECURRING_PAYMENT_DUE">RECURRING_PAYMENT_DUE</option>
                    <option value="SUBSCRIPTION_RENEWAL">SUBSCRIPTION_RENEWAL</option>
                    <option value="ANOMALY_DETECTED">ANOMALY_DETECTED</option>
                    <option value="PORTFOLIO_UPDATE">PORTFOLIO_UPDATE</option>
                    <option value="MONTHLY_REPORT">MONTHLY_REPORT</option>
                    <option value="SYSTEM">SYSTEM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Severity
                  </label>
                  <select
                    value={testForm.severity}
                    onChange={(e) => setTestForm({ ...testForm, severity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  >
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ALERT">ALERT</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={testForm.title}
                    onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Message
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={testForm.message}
                    onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Action URL
                  </label>
                  <input
                    type="text"
                    value={testForm.actionUrl}
                    onChange={(e) => setTestForm({ ...testForm, actionUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTestModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={testSending}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    {testSending ? 'Dispatching...' : 'Dispatch Alert'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
