import React, { useState } from 'react';
import { StockAlert, StockAlertType } from '../../types/alert.ts';
import { AlertService } from '../../services/alert.service.ts';
import {
  Bell,
  Plus,
  Play,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Loader2,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface AlertsManagerSectionProps {
  alerts: StockAlert[];
  onAlertsChange: (alerts: StockAlert[]) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (alert: StockAlert) => void;
}

export const AlertsManagerSection: React.FC<AlertsManagerSectionProps> = ({
  alerts,
  onAlertsChange,
  onOpenCreateModal,
  onOpenEditModal,
}) => {
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

  const handleToggleActive = async (alert: StockAlert) => {
    try {
      const updated = await AlertService.updateAlert(alert._id, {
        isActive: !alert.isActive,
      });
      const updatedList = alerts.map((a) => (a._id === updated._id ? updated : a));
      onAlertsChange(updatedList);
    } catch (err) {
      console.error('Failed to toggle alert status', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await AlertService.deleteAlert(id);
      onAlertsChange(alerts.filter((a) => a._id !== id));
    } catch (err) {
      console.error('Failed to delete alert', err);
    }
  };

  const handleEvaluateNow = async () => {
    try {
      setEvaluating(true);
      setEvalMessage(null);
      const res = await AlertService.evaluateAlerts();
      setEvalMessage(
        `Evaluation complete: ${res.totalEvaluated} alert rule${res.totalEvaluated === 1 ? '' : 's'} evaluated, ${res.totalTriggered} new notification${res.totalTriggered === 1 ? '' : 's'} dispatched (anti-spam cooldown deduplication active).`,
      );

      // Refresh alerts list
      const freshAlerts = await AlertService.getAlerts();
      onAlertsChange(freshAlerts);
    } catch (err: unknown) {
      setEvalMessage(
        err instanceof Error ? err.message : 'Evaluation trigger failed. Check backend worker.',
      );
    } finally {
      setEvaluating(false);
    }
  };

  const getAlertIcon = (type: StockAlertType) => {
    switch (type) {
      case 'PRICE_ABOVE':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'PRICE_BELOW':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      case 'PERCENT_CHANGE_UP':
        return <Activity className="w-4 h-4 text-teal-400" />;
      case 'PERCENT_CHANGE_DOWN':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'VOLUME_ABOVE':
        return <DollarSign className="w-4 h-4 text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-emerald-400" />;
    }
  };

  const formatThreshold = (alert: StockAlert) => {
    if (alert.alertType.includes('PERCENT')) {
      return `${alert.threshold > 0 ? '+' : ''}${alert.threshold}%`;
    }
    if (alert.alertType === 'VOLUME_ABOVE') {
      return `${(alert.threshold / 1_000_000).toFixed(1)}M shares`;
    }
    return `$${alert.threshold.toFixed(2)}`;
  };

  const activeCount = alerts.filter((a) => a.isActive).length;
  const triggeredCount = alerts.filter((a) => a.isTriggered).length;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Stock Alert Triggers</h3>
            <p className="text-xs text-slate-400">
              {activeCount} active • {triggeredCount} historical triggers • Redis/BullMQ evaluation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEvaluateNow}
            disabled={evaluating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
            title="Evaluate active rules against real-time market quotes"
          >
            {evaluating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            )}
            Evaluate Rules
          </button>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold hover:from-emerald-400 hover:to-teal-300 transition shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>
      </div>

      {evalMessage && (
        <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{evalMessage}</span>
        </div>
      )}

      {/* Alerts Grid */}
      {alerts.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No active stock alerts</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Set price floors, ceiling breakout targets, percentage spikes, or abnormal volume alerts
            to receive immediate informational notifications.
          </p>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            Create First Alert
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className={`bg-slate-900/60 border rounded-3xl p-5 transition space-y-4 relative overflow-hidden ${
                alert.isActive
                  ? 'border-slate-800/80 hover:border-slate-700'
                  : 'border-slate-800/40 opacity-60'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                    {getAlertIcon(alert.alertType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base font-mono">
                        {alert.symbol}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          alert.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {alert.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {alert.alertType.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenEditModal(alert)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                    title="Edit Rule"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(alert._id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title="Delete Alert"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Threshold Target */}
              <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                    Trigger Threshold
                  </span>
                  <span className="text-xl font-black text-white font-mono">
                    {formatThreshold(alert)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-400 font-mono">
                  <span className="text-[10px] text-slate-500 block">Trigger Count</span>
                  <span className="text-slate-300 font-semibold">{alert.triggerCount} times</span>
                </div>
              </div>

              {/* Anti-Spam Cooldown & Notes */}
              <div className="space-y-1 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>
                    Cooldown Deduplication:{' '}
                    <strong className="text-slate-200">{alert.cooldownMinutes}m</strong>
                  </span>
                </div>
                {alert.lastTriggeredAt && (
                  <p className="text-[10px] text-slate-500">
                    Last triggered: {new Date(alert.lastTriggeredAt).toLocaleString()}
                  </p>
                )}
                {alert.notes && (
                  <p className="italic text-slate-400 pt-1 line-clamp-1">"{alert.notes}"</p>
                )}
              </div>

              {/* Active Toggle */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Rule Enabled</span>
                <button
                  onClick={() => handleToggleActive(alert)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    alert.isActive ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                      alert.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
