import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Bell,
  TrendingUp,
  CreditCard,
  RefreshCw,
  X,
  ExternalLink,
} from 'lucide-react';
import { useNotifications, ToastItem } from '../../context/NotificationContext.tsx';
import { NotificationSeverity } from '../../types/alert.ts';

export const NotificationToaster: React.FC = () => {
  const { toasts, removeToast, markAsRead } = useNotifications();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  const getIcon = (type?: string, severity?: string) => {
    if (severity === 'CRITICAL' || severity === 'ALERT') {
      return <AlertTriangle className="w-5 h-5 text-rose-400" />;
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
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'STOCK_ALERT':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'PORTFOLIO_UPDATE':
      case 'MONTHLY_REPORT':
        return <CheckCircle className="w-5 h-5 text-teal-400" />;
      default:
        return <Bell className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getBorderColor = (severity?: NotificationSeverity | string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-rose-500/80 shadow-rose-500/20';
      case 'ALERT':
        return 'border-rose-500/50 shadow-rose-500/10';
      case 'WARNING':
        return 'border-amber-500/50 shadow-amber-500/10';
      case 'INFO':
      default:
        return 'border-emerald-500/40 shadow-emerald-500/10';
    }
  };

  const handleActionClick = (toast: ToastItem) => {
    if (toast.notification._id) {
      markAsRead(toast.notification._id);
    }
    removeToast(toast.id);
    if (toast.notification.actionUrl) {
      navigate(toast.notification.actionUrl);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const notif = toast.notification;
        const borderStyle = getBorderColor(notif.severity);

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-slate-900/95 backdrop-blur-md border shadow-xl transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-bottom-5 ${borderStyle}`}
          >
            <div className="p-2 rounded-lg bg-slate-800/80 shrink-0 mt-0.5">
              {getIcon(notif.type, notif.severity)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <h4 className="text-xs font-semibold text-slate-100 truncate">{notif.title}</h4>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-2">
                {notif.message}
              </p>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-400 font-medium">Just now</span>
                {notif.actionUrl ? (
                  <button
                    onClick={() => handleActionClick(toast)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (notif._id) markAsRead(notif._id);
                      removeToast(toast.id);
                    }}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
