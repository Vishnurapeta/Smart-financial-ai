import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
  Mail,
  Zap,
  Moon,
  Clock,
  Shield,
  Check,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { AlertService } from '../services/alert.service.ts';
import { NotificationPreferences, ChannelPreference } from '../types/alert.ts';

const NOTIFICATION_TYPE_LABELS: Record<string, { title: string; desc: string }> = {
  BUDGET_THRESHOLD: {
    title: 'Budget Approaching Limit',
    desc: 'Alerts when spending reaches 80% of a category limit',
  },
  BUDGET_EXCEEDED: {
    title: 'Budget Exceeded',
    desc: 'Critical alert when spending exceeds 100% of budget',
  },
  RECURRING_PAYMENT_DUE: {
    title: 'Recurring Payment Reminders',
    desc: 'Reminders 3 days and 1 day before utility/bill due dates',
  },
  SUBSCRIPTION_RENEWAL: {
    title: 'Subscription Auto-Renewal',
    desc: 'Advance notice before recurring subscriptions renew',
  },
  ANOMALY_DETECTED: {
    title: 'Unusual Spending Anomalies',
    desc: 'AI-detected transaction deviations and spending spikes',
  },
  STOCK_ALERT: {
    title: 'Stock Market Price Alerts',
    desc: 'Configurable price threshold, % change, and volume alerts',
  },
  PORTFOLIO_UPDATE: {
    title: 'Portfolio Daily Performance',
    desc: 'End-of-day market summary and portfolio value changes',
  },
  MONTHLY_REPORT: {
    title: 'Monthly Financial Intelligence Report',
    desc: 'Comprehensive monthly income, expense & savings analysis',
  },
};

export const NotificationPreferencesPage: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        setLoading(true);
        const data = await AlertService.getPreferences();
        setPreferences(data);
      } catch (err) {
        console.error('Failed to load notification preferences', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const handleGlobalToggle = (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const handleChannelToggle = (
    typeKey: string,
    channel: 'inApp' | 'email' | 'socket',
  ) => {
    if (!preferences) return;
    const currentChannels = preferences.channels || {};
    const typePref: ChannelPreference = currentChannels[typeKey] || {
      inApp: true,
      email: true,
      socket: true,
    };

    setPreferences({
      ...preferences,
      channels: {
        ...currentChannels,
        [typeKey]: {
          ...typePref,
          [channel]: !typePref[channel],
        },
      },
    });
  };

  const handleSave = async () => {
    if (!preferences) return;
    try {
      setSaving(true);
      const updated = await AlertService.updatePreferences(preferences);
      setPreferences(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save notification preferences', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !preferences) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading preferences...</p>
        </div>
      </div>
    );
  }

  const quietHours = preferences.quietHours || {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'UTC',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              to="/notifications"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                Notification Preferences
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure delivery channels, quiet hours, and alert frequency thresholds.
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Notification preferences updated successfully across all channels!</span>
          </div>
        )}

        {/* Global Channel Toggles */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider text-xs">
            Global Channel Master Toggles
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Email Delivery</div>
                  <div className="text-[10px] text-slate-400">Send alerts to email address</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailAlerts}
                onChange={() => handleGlobalToggle('emailAlerts')}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Real-Time WebSockets</div>
                  <div className="text-[10px] text-slate-400">Instant in-app push & popups</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.pushAlerts}
                onChange={() => handleGlobalToggle('pushAlerts')}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-teal-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Stock Alerts</div>
                  <div className="text-[10px] text-slate-400">Market ticker thresholds</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.stockAlertsEnabled}
                onChange={() => handleGlobalToggle('stockAlertsEnabled')}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Quiet Hours Configuration */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" />
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Quiet Hours (Do Not Disturb)
                </h2>
                <p className="text-[11px] text-slate-400">
                  Delay non-urgent notifications during sleep or focus hours. Critical security alerts will always bypass.
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={quietHours.enabled}
              onChange={() =>
                setPreferences({
                  ...preferences,
                  quietHours: {
                    ...quietHours,
                    enabled: !quietHours.enabled,
                  },
                })
              }
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>

          {quietHours.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={quietHours.startTime}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: { ...quietHours, startTime: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={quietHours.endTime}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: { ...quietHours, endTime: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Timezone
                </label>
                <select
                  value={quietHours.timezone}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: { ...quietHours, timezone: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white cursor-pointer"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Cooldown & Rate Limiting Thresholds */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Cooldown & Frequency Throttling
              </h2>
              <p className="text-[11px] text-slate-400">
                Prevent alert fatigue by enforcing minimum spacing intervals between repeated triggers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Minimum Alert Cooldown
              </label>
              <select
                value={preferences.minCooldownMinutes}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    minCooldownMinutes: parseInt(e.target.value, 10),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white cursor-pointer"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (Standard)</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes (Conservative)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Max Notifications Per Hour ({preferences.maxNotificationsPerHour || 30})
              </label>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={preferences.maxNotificationsPerHour || 30}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    maxNotificationsPerHour: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer mt-2"
              />
            </div>
          </div>
        </div>

        {/* Detailed Channel Matrix Per Notification Type */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Granular Notification Type Delivery Matrix
            </h2>
            <p className="text-[11px] text-slate-400">
              Customize which channels receive each specific event category.
            </p>
          </div>

          <div className="divide-y divide-slate-800/80">
            {Object.entries(NOTIFICATION_TYPE_LABELS).map(([typeKey, info]) => {
              const chPref =
                preferences.channels?.[typeKey] || {
                  inApp: true,
                  email: true,
                  socket: true,
                };

              return (
                <div
                  key={typeKey}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <h3 className="text-xs font-semibold text-white">{info.title}</h3>
                    <p className="text-[10px] text-slate-400">{info.desc}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chPref.inApp}
                        onChange={() => handleChannelToggle(typeKey, 'inApp')}
                        className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                      />
                      <span className="text-[11px]">In-App</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chPref.socket}
                        onChange={() => handleChannelToggle(typeKey, 'socket')}
                        className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                      />
                      <span className="text-[11px]">Real-Time</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chPref.email}
                        onChange={() => handleChannelToggle(typeKey, 'email')}
                        className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                      />
                      <span className="text-[11px]">Email</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
