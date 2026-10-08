import React from 'react';
import { AppNotification } from '../../types/alert.ts';
import { AlertService } from '../../services/alert.service.ts';
import { Bell, CheckCheck, Check, Clock, ExternalLink } from 'lucide-react';

interface AlertHistorySectionProps {
  notifications: AppNotification[];
  onNotificationsChange: (notifications: AppNotification[]) => void;
  onInspectSymbol: (symbol: string) => void;
}

export const AlertHistorySection: React.FC<AlertHistorySectionProps> = ({
  notifications,
  onNotificationsChange,
  onInspectSymbol,
}) => {
  const handleMarkAsRead = async (id: string) => {
    try {
      const updated = await AlertService.markAsRead(id);
      onNotificationsChange(notifications.map((n) => (n._id === updated._id ? updated : n)));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await AlertService.markAllAsRead();
      onNotificationsChange(notifications.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Alert Trigger History</h3>
            <p className="text-xs text-slate-400">
              {unreadCount} unread • Informational market movement notifications
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-xs font-semibold transition"
          >
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No alert notifications yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            When your configured price, movement, or volume conditions trigger, informational
            reports will be archived here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const meta = notif.metadata || {};
            const symbol = (meta.symbol as string) || '';

            return (
              <div
                key={notif._id}
                className={`p-5 rounded-3xl border transition space-y-3 relative ${
                  notif.isRead
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                    : 'bg-slate-900/80 border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                      <h4 className="text-sm font-bold text-white">{notif.title}</h4>
                      {symbol && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {symbol}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {symbol && (
                      <button
                        onClick={() => onInspectSymbol(symbol)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    )}
                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notif._id)}
                        title="Mark as read"
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer metadata & timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-3">
                    {meta.currentPrice !== undefined && (
                      <span>
                        Market Price:{' '}
                        <strong className="text-slate-300">
                          ${Number(meta.currentPrice).toFixed(2)}
                        </strong>
                      </span>
                    )}
                    {meta.changePercent !== undefined && (
                      <span
                        className={
                          Number(meta.changePercent) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {Number(meta.changePercent) >= 0 ? '+' : ''}
                        {Number(meta.changePercent).toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(notif.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
