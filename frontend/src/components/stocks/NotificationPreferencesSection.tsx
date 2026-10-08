import React, { useState } from 'react';
import { NotificationPreferences } from '../../types/alert.ts';
import { AlertService } from '../../services/alert.service.ts';
import { Settings, ShieldCheck, Mail, Bell, Clock, Loader2, CheckCircle2 } from 'lucide-react';

interface NotificationPreferencesSectionProps {
  preferences: NotificationPreferences;
  onPreferencesChange: (preferences: NotificationPreferences) => void;
}

export const NotificationPreferencesSection: React.FC<NotificationPreferencesSectionProps> = ({
  preferences,
  onPreferencesChange,
}) => {
  const [stockAlertsEnabled, setStockAlertsEnabled] = useState<boolean>(
    preferences.stockAlertsEnabled ?? true,
  );
  const [pushAlerts, setPushAlerts] = useState<boolean>(preferences.pushAlerts ?? true);
  const [emailAlerts, setEmailAlerts] = useState<boolean>(preferences.emailAlerts ?? true);
  const [minCooldownMinutes, setMinCooldownMinutes] = useState<number>(
    preferences.minCooldownMinutes ?? 60,
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSavedSuccess(false);
      const updated = await AlertService.updatePreferences({
        stockAlertsEnabled,
        pushAlerts,
        emailAlerts,
        minCooldownMinutes,
      });
      onPreferencesChange(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update preferences', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Notification & Alert Preferences</h3>
          <p className="text-xs text-slate-400">
            Configure delivery channels, frequency caps, and anti-spam threshold controls
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Notification preferences updated successfully.</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="p-6 sm:p-8 bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-6"
      >
        <div className="space-y-4">
          {/* Stock Alerts Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Stock Market Alerts Dispatch</h4>
                <p className="text-[11px] text-slate-400">
                  Allow BullMQ background worker to evaluate threshold rules and record triggers
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStockAlertsEnabled(!stockAlertsEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                stockAlertsEnabled ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                  stockAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* In-app Push */}
          <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">In-App Alert Banners</h4>
                <p className="text-[11px] text-slate-400">
                  Show notification bell badges and realtime popup toasts on the dashboard
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPushAlerts(!pushAlerts)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                pushAlerts ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                  pushAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Email Alerts */}
          <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Email Dispatch Digest</h4>
                <p className="text-[11px] text-slate-400">
                  Send critical price breakthrough updates to your registered account email
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEmailAlerts(!emailAlerts)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                emailAlerts ? 'bg-indigo-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                  emailAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Minimum Cooldown Window */}
          <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <label className="text-xs font-bold text-white">
                Global Anti-Spam Minimum Cooldown Cap
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              Regardless of individual rule configurations, suppress re-triggering notifications for
              the same asset until this duration expires.
            </p>
            <select
              value={minCooldownMinutes}
              onChange={(e) => setMinCooldownMinutes(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
            >
              <option value={15}>15 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={60}>1 Hour (Recommended)</option>
              <option value={240}>4 Hours</option>
              <option value={1440}>24 Hours (Once per day)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold hover:from-emerald-400 hover:to-teal-300 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
