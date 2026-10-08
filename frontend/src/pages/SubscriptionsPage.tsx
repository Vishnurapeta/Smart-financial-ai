import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header.tsx';
import { SubscriptionModal } from '../components/recurring/SubscriptionModal.tsx';
import { SubscriptionDetailsModal } from '../components/recurring/SubscriptionDetailsModal.tsx';
import { RecurringService } from '../services/recurring.service.ts';
import { socketService } from '../services/socket.service.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import {
  BillReminder,
  CreateSubscriptionDTO,
  RecurringExpense,
  Subscription,
  SubscriptionDashboardData,
  UpdateSubscriptionDTO,
} from '../types/recurring.ts';
import {
  Sparkles,
  CreditCard,
  Calendar,
  AlertTriangle,
  Plus,
  Bell,
  CheckCircle2,
  TrendingUp,
  Clock,
  Tag,
  Pencil,
  Trash2,
  Layers,
  History,
} from 'lucide-react';

export const SubscriptionsPage: React.FC = () => {
  const { format } = useCurrency();
  const [activeTab, setActiveTab] = useState<'SUBSCRIPTIONS' | 'RECURRING_EXPENSES'>(
    'SUBSCRIPTIONS',
  );
  const [dashboard, setDashboard] = useState<SubscriptionDashboardData | null>(null);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<BillReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isTriggeringReminders, setIsTriggeringReminders] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubForEdit, setSelectedSubForEdit] = useState<Subscription | null>(null);
  const [selectedSubForDetails, setSelectedSubForDetails] = useState<Subscription | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashData, recData, billsData] = await Promise.all([
        RecurringService.getSubscriptionDashboard(),
        RecurringService.getRecurringExpenses({ limit: 100 }),
        RecurringService.getUpcomingBills(30),
      ]);
      setDashboard(dashData);
      setRecurringExpenses(recData.items);
      setUpcomingBills(billsData);
    } catch (err) {
      console.error('Failed to load recurring intelligence data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen to real-time sync events from transaction lifecycle
    const handleSync = () => {
      loadData();
    };

    socketService.on('subscription:changed', handleSync);
    socketService.on('recurring:changed', handleSync);

    return () => {
      socketService.off('subscription:changed', handleSync);
      socketService.off('recurring:changed', handleSync);
    };
  }, [loadData]);

  // Scan Historical Transactions
  const handleScanTransactions = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      const result = await RecurringService.detectRecurring();
      if (result.totalDetected > 0) {
        setScanMessage(
          `Scan completed — ${result.totalDetected} recurring patterns identified (${result.confirmedCount ?? result.subscriptionsCreated} confirmed subscriptions, ${result.possibleCount ?? 0} possible recurring expenses). Stale records reconciled.`,
        );
      } else {
        setScanMessage(
          'Scan completed — No recurring subscription patterns detected in your transaction ledger.',
        );
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pattern detection failed';
      setScanMessage(`Scan error: ${msg}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger Reminders
  const handleTriggerReminders = async () => {
    setIsTriggeringReminders(true);
    setReminderMessage(null);
    try {
      const res = await RecurringService.triggerBillReminders();
      if (res.triggeredReminders > 0) {
        setReminderMessage(
          `Dispatched ${res.triggeredReminders} new bill reminder notification(s) for upcoming & overdue payments.`,
        );
      } else {
        setReminderMessage(
          'All bills are up to date. No new reminders required for the next 3 days.',
        );
      }
      setTimeout(() => setReminderMessage(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch reminders';
      setReminderMessage(`Reminder error: ${msg}`);
    } finally {
      setIsTriggeringReminders(false);
    }
  };

  // Toggle Recurring Expense Active State
  const handleToggleRecurringActive = async (id: string, currentActive: boolean) => {
    try {
      await RecurringService.toggleRecurringActive(id, !currentActive);
      await loadData();
    } catch (err) {
      console.error('Failed to toggle recurring expense', err);
    }
  };

  // Delete Recurring Expense
  const handleDeleteRecurring = async (id: string) => {
    if (!window.confirm('Delete this recurring expense record?')) return;
    try {
      await RecurringService.deleteRecurringExpense(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete recurring expense', err);
    }
  };

  // Save Subscription (Create or Update)
  const handleSaveSubscription = async (dto: CreateSubscriptionDTO) => {
    if (selectedSubForEdit) {
      await RecurringService.updateSubscription(selectedSubForEdit._id, dto);
    } else {
      await RecurringService.createSubscription(dto);
    }
    await loadData();
  };

  // Update Subscription Status (e.g. Cancel or Keep Active)
  const handleUpdateSubStatus = async (id: string, updateDto: UpdateSubscriptionDTO) => {
    try {
      await RecurringService.updateSubscription(id, updateDto);
      await loadData();
    } catch (err) {
      console.error('Failed to update subscription status', err);
    }
  };

  // Delete Subscription
  const handleDeleteSubscription = async (id: string) => {
    if (!window.confirm('Remove this subscription from tracking?')) return;
    try {
      await RecurringService.deleteSubscription(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete subscription', err);
    }
  };

  const getCyclePeriod = (cycle: string) => {
    switch (cycle) {
      case 'ANNUALLY':
        return 'year';
      case 'SEMI_ANNUALLY':
        return '6 mos';
      case 'QUARTERLY':
        return 'quarter';
      case 'BIWEEKLY':
        return '2 weeks';
      case 'WEEKLY':
        return 'week';
      default:
        return 'month';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Top Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Subscription & Recurring Intelligence
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                Pattern AI
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Analyze historical transactions, detect recurring charges, project renewals, and track
              ledger payment history.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleScanTransactions}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning transaction history...' : 'Scan Historical Patterns'}</span>
            </button>

            <button
              onClick={handleTriggerReminders}
              disabled={isTriggeringReminders}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              title="Dispatches notifications for bills due in <= 3 days or overdue"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span>{isTriggeringReminders ? 'Checking...' : 'Trigger Reminders'}</span>
            </button>

            <button
              onClick={() => {
                setSelectedSubForEdit(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subscription</span>
            </button>
          </div>
        </div>

        {/* Scan / Reminder Feedback Banners */}
        {scanMessage && (
          <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-between text-indigo-300 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{scanMessage}</span>
            </div>
            <button
              onClick={() => setScanMessage(null)}
              className="text-xs text-indigo-400 hover:text-indigo-200 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {reminderMessage && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-amber-300 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{reminderMessage}</span>
            </div>
            <button
              onClick={() => setReminderMessage(null)}
              className="text-xs text-amber-400 hover:text-amber-200 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Subscription Intelligence Dashboard KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Monthly Subscriptions</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-white">
                {format(dashboard?.monthlySubscriptionCost || 0, {
                  currency: dashboard?.defaultCurrency,
                })}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">/ month</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Total normalized monthly recurring cost
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Annualized Run Rate</span>
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-white">
                {format(dashboard?.annualizedSubscriptionCost || 0, {
                  currency: dashboard?.defaultCurrency,
                })}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">/ year</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Estimated 12-month recurring cash outflow
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Active Subscriptions</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-white">
                {dashboard?.activeSubscriptions || 0}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">
                of {dashboard?.subscriptionCount || 0} detected
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Confirmed recurring services</p>
          </div>

          <div
            className={`p-5 rounded-2xl border shadow-lg ${
              (dashboard?.possibleRecurringCount || 0) > 0
                ? 'bg-indigo-950/20 border-indigo-500/30'
                : (dashboard?.possiblyInactiveSubscriptions || 0) > 0
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-300">
                {(dashboard?.possibleRecurringCount || 0) > 0
                  ? 'Possible Recurring'
                  : 'Possibly Inactive'}
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-white">
                {(dashboard?.possibleRecurringCount || 0) > 0
                  ? dashboard?.possibleRecurringCount
                  : dashboard?.possiblyInactiveSubscriptions || 0}
              </span>
              <span className="text-xs text-indigo-300/80 ml-1.5">
                {(dashboard?.possibleRecurringCount || 0) > 0
                  ? 'needs more history'
                  : 'flagged by pattern AI'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {(dashboard?.possibleRecurringCount || 0) > 0
                ? 'Single transaction or emerging pattern'
                : 'Billing cycle elapsed without charge'}
            </p>
          </div>
        </div>

        {/* Possible Recurring Expenses Section (Emerging Evidence) */}
        {dashboard && (dashboard.possibleRecurringExpenses?.length || 0) > 0 && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-indigo-200">
                      Possible Recurring Expenses ({dashboard.possibleRecurringExpenses!.length})
                    </h3>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Emerging Intelligence
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    SmartFin detected single transactions or emerging recurring patterns in your ledger.
                    These are tracked until recurring intervals can be statistically confirmed by additional billing history.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {dashboard.possibleRecurringExpenses!.map((item) => (
                <div
                  key={item._id}
                  className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-white text-sm">{item.name}</span>
                      <span className="text-indigo-300 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20 text-[11px]">
                        {format(item.amount, { currency: item.currency })} / {getCyclePeriod(item.billingCycle)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap my-2">
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.source || 'AI_DETECTED'}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        LOW CONFIDENCE
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {item.transactionCount || 1} TRANSACTION
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1 leading-normal">
                      <strong>Status:</strong> {item.inactivityEvidence || 'Needs more history to confirm recurring frequency.'}
                    </p>
                    {item.lastTransactionDate && (
                      <p className="text-slate-500 text-[10px] mt-1">
                        Last payment: {new Date(item.lastTransactionDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                    <button
                      onClick={() => setSelectedSubForDetails(item)}
                      className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold cursor-pointer"
                    >
                      View Evidence
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteSubscription(item._id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction Evidence Alert: Possibly Inactive Subscriptions */}
        {dashboard && dashboard.possiblyInactiveList.length > 0 && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-200">
                  Transaction-Based Inactivity Alert ({dashboard.possiblyInactiveList.length}{' '}
                  services)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  SmartFin flags these subscriptions as <strong>possibly inactive</strong> because
                  regular billing intervals have elapsed without matching transactions in the ledger.
                  Review the transaction evidence below:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {dashboard.possiblyInactiveList.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-sm">{item.name}</span>
                      <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-[10px]">
                        {format(item.amount, { currency: item.currency })} /{' '}
                        {getCyclePeriod(item.billingCycle)}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-normal">
                      <strong>Evidence:</strong> {item.inactivityEvidence}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                    <button
                      onClick={() =>
                        handleUpdateSubStatus(item.id, {
                          status: 'CANCELLED',
                          isPossiblyInactive: false,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Mark as Cancelled
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateSubStatus(item.id, {
                          status: 'ACTIVE',
                          isPossiblyInactive: false,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Keep Active
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Bill Reminders Timeline */}
        {upcomingBills.length > 0 && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Upcoming Due Dates & Reminders (Next 30 Days)
                </h3>
              </div>
              <span className="text-xs text-slate-400">{upcomingBills.length} upcoming</span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {upcomingBills.map((bill) => (
                <div
                  key={bill.id}
                  className="min-w-[200px] p-3 rounded-xl bg-slate-950 border border-slate-800/80 shrink-0 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white truncate max-w-[120px]">
                      {bill.merchant}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        bill.urgency === 'OVERDUE'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : bill.urgency === 'DUE_TODAY'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : bill.urgency === 'DUE_SOON'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {bill.urgency.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-200">
                    {format(bill.amount, { currency: bill.currency })}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>{new Date(bill.dueDate).toLocaleDateString()}</span>
                    <span
                      className={
                        bill.urgency === 'OVERDUE'
                          ? 'text-rose-400 font-bold'
                          : bill.urgency === 'DUE_TODAY'
                            ? 'text-amber-400 font-bold'
                            : ''
                      }
                    >
                      {bill.daysRemaining === 0
                        ? 'Today'
                        : bill.daysRemaining < 0
                          ? `${Math.abs(bill.daysRemaining)}d overdue`
                          : `in ${bill.daysRemaining}d`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('SUBSCRIPTIONS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SUBSCRIPTIONS'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Subscriptions ({dashboard?.allSubscriptions.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('RECURRING_EXPENSES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'RECURRING_EXPENSES'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>All Recurring Expenses ({recurringExpenses.length})</span>
          </button>
        </div>

        {/* TAB 1: SUBSCRIPTIONS VIEW */}
        {activeTab === 'SUBSCRIPTIONS' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                Loading subscriptions from database...
              </div>
            ) : !dashboard || dashboard.allSubscriptions.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-3">
                <CreditCard className="w-8 h-8 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">No subscriptions detected yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click &ldquo;Scan Historical Patterns&rdquo; to automatically detect subscriptions
                  from your real transactions ledger or add one manually.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard.allSubscriptions.map((sub) => {
                  const cyclePeriod = getCyclePeriod(sub.billingCycle);

                  const statusBadgeClass =
                    sub.status === 'PAID'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : sub.status === 'DUE_TODAY'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : sub.status === 'DUE_SOON'
                          ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          : sub.status === 'OVERDUE'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : sub.status === 'POSSIBLY_INACTIVE'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : sub.status === 'CANCELLED'
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

                  const confidenceLevel = sub.confidenceLevel || 'HIGH';
                  const confidenceBadgeClass =
                    confidenceLevel === 'HIGH'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : confidenceLevel === 'MEDIUM'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                  return (
                    <div
                      key={sub._id}
                      className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4 shadow-lg group"
                    >
                      <div>
                        {/* Top status & cycle badge */}
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {sub.billingCycle}
                          </span>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                sub.source === 'MANUAL'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              }`}
                            >
                              {sub.source === 'MANUAL' ? 'MANUAL' : 'AI DETECTED'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceBadgeClass}`}
                            >
                              {confidenceLevel}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass}`}
                            >
                              {sub.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Title & Merchant */}
                        <h4 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {sub.name}
                        </h4>
                        <p className="text-xs text-slate-400">{sub.merchant}</p>

                        {/* Price History Spikes Alert */}
                        {sub.priceChangeAlert && (
                          <div className="mt-2.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Price change detected from previous billing!</span>
                          </div>
                        )}

                        {/* Inactivity warning */}
                        {sub.isPossiblyInactive && (
                          <div className="mt-2.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-tight">
                            ⚠️ Possibly inactive: billing interval elapsed without new charges.
                          </div>
                        )}

                        {/* Plan Tier */}
                        {sub.planTier && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                            <Tag className="w-3.5 h-3.5 text-slate-500" />
                            <span>Plan: {sub.planTier}</span>
                          </div>
                        )}

                        {/* Amount */}
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white">
                            {format(sub.amount, { currency: sub.currency })}
                          </span>
                          <span className="text-xs text-slate-400">/{cyclePeriod}</span>
                        </div>

                        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>Next: {new Date(sub.renewalDate).toLocaleDateString()}</span>
                          </div>
                          {sub.lastTransactionDate && (
                            <span className="text-[10px] text-slate-500">
                              Last: {new Date(sub.lastTransactionDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Actions */}
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                        <button
                          onClick={() => setSelectedSubForDetails(sub)}
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>View History</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedSubForEdit(sub);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Subscription"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubscription(sub._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Subscription"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ALL RECURRING EXPENSES VIEW */}
        {activeTab === 'RECURRING_EXPENSES' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                Loading recurring expenses...
              </div>
            ) : recurringExpenses.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-3">
                <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">No recurring expenses found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Scan your transaction history to detect monthly utilities, EMIs, and periodic
                  recurring commitments.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                      <tr>
                        <th className="py-3 px-4">Merchant / Commitment</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Frequency</th>
                        <th className="py-3 px-4">Expected Amount</th>
                        <th className="py-3 px-4">Next Due Date</th>
                        <th className="py-3 px-4">Pattern Confidence</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {recurringExpenses.map((rec) => (
                        <tr key={rec._id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{rec.merchant}</div>
                            {rec.description && (
                              <div className="text-[11px] text-slate-400">{rec.description}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                rec.recurringType === 'SUBSCRIPTION'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : rec.recurringType === 'EMI'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    : rec.recurringType === 'UTILITY'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {rec.recurringType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-medium">{rec.frequency}</td>
                          <td className="py-3 px-4 font-bold text-white">
                            {format(rec.expectedAmount, { currency: rec.currency })}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {new Date(rec.nextDueDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  (rec.confidenceLevel || 'HIGH') === 'HIGH'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : (rec.confidenceLevel || 'HIGH') === 'MEDIUM'
                                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {rec.confidenceLevel || 'HIGH'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {Math.round(rec.confidence * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleRecurringActive(rec._id, rec.isActive)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                rec.isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              {rec.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteRecurring(rec._id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Subscription Create / Edit Modal */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveSubscription}
        initialSubscription={selectedSubForEdit}
      />

      {/* Subscription Details & Authentic Payment History Modal */}
      <SubscriptionDetailsModal
        isOpen={Boolean(selectedSubForDetails)}
        onClose={() => setSelectedSubForDetails(null)}
        subscription={selectedSubForDetails}
        onEdit={(sub) => {
          setSelectedSubForEdit(sub);
          setIsModalOpen(true);
        }}
      />
    </div>
  );
};
