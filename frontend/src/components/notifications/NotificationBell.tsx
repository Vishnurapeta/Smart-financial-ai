import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Settings,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Clock,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext.tsx';
import { AppNotification } from '../../types/alert.ts';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    unreadCount,
    notifications,
    isSocketConnected,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayedNotifications = (
    filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications
  ).slice(0, 5);

  const getIcon = (type?: string, severity?: string) => {
    if (severity === 'CRITICAL' || severity === 'ALERT') {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    switch (type) {
      case 'BUDGET_THRESHOLD':
      case 'BUDGET_EXCEEDED':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'RECURRING_PAYMENT_DUE':
        return <CreditCard className="w-4 h-4 text-sky-400" />;
      case 'SUBSCRIPTION_RENEWAL':
        return <RefreshCw className="w-4 h-4 text-indigo-400" />;
      case 'ANOMALY_DETECTED':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'STOCK_ALERT':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead && notif._id) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all cursor-pointer group"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4 transition-transform group-hover:scale-110" />

        {/* Unread Badge with pulsing effect */}
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[9px] font-bold text-white items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          </>
        )}

        {/* Live WebSocket Connection indicator */}
        <span
          className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
            isSocketConnected ? 'bg-emerald-400' : 'bg-slate-500'
          }`}
          title={isSocketConnected ? 'Real-time WebSocket Connected' : 'Connecting to real-time service'}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1 text-[10px] text-slate-400 mr-1"
                title={isSocketConnected ? 'Real-time WebSocket active' : 'Offline'}
              >
                {isSocketConnected ? (
                  <Wifi className="w-3 h-3 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3 h-3 text-slate-500" />
                )}
                <span className="hidden sm:inline">{isSocketConnected ? 'Live' : 'Polling'}</span>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-[10px] font-medium text-emerald-400 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {displayedNotifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-2 text-slate-500">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-slate-300">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Budget alerts, stock targets & reminders will appear here in real time.
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 flex items-start gap-3 hover:bg-slate-800/50 transition-colors cursor-pointer group ${
                    !notif.isRead ? 'bg-slate-800/25' : ''
                  }`}
                >
                  <div className="p-2 rounded-lg bg-slate-800/80 shrink-0 mt-0.5">
                    {getIcon(notif.type, notif.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          !notif.isRead ? 'font-semibold text-white' : 'font-medium text-slate-300'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-1.5">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                      {notif.actionUrl && (
                        <span className="text-emerald-400 group-hover:underline flex items-center gap-0.5">
                          <span>View</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1"
            >
              View all notifications →
            </Link>

            <Link
              to="/settings/notifications"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Notification Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
