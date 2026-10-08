import { api } from './api.ts';
import {
  BillReminder,
  CreateSubscriptionDTO,
  RecurringExpense,
  RecurringFrequency,
  RecurringType,
  Subscription,
  SubscriptionBillingCycle,
  SubscriptionDashboardData,
  SubscriptionStatus,
  UpdateSubscriptionDTO,
} from '../types/recurring.ts';

export class RecurringService {
  /**
   * Run historical transaction pattern detection
   */
  static async detectRecurring(): Promise<{
    totalDetected: number;
    confirmedCount?: number;
    possibleCount?: number;
    recurringCreated: number;
    recurringUpdated: number;
    subscriptionsCreated: number;
  }> {
    const response = await api.request<{
      success: boolean;
      data: {
        totalDetected: number;
        confirmedCount?: number;
        possibleCount?: number;
        recurringCreated: number;
        recurringUpdated: number;
        subscriptionsCreated: number;
      };
    }>('/recurring/detect', {
      method: 'POST',
    });
    return response.data;
  }

  /**
   * Get paginated recurring expenses
   */
  static async getRecurringExpenses(
    params: {
      isActive?: boolean;
      frequency?: RecurringFrequency;
      recurringType?: RecurringType;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    items: RecurringExpense[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params.frequency) query.set('frequency', params.frequency);
    if (params.recurringType) query.set('recurringType', params.recurringType);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const response = await api.request<{
      success: boolean;
      data: {
        items: RecurringExpense[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>(`/recurring?${query.toString()}`);
    return response.data;
  }

  /**
   * Get subscription intelligence dashboard metrics
   */
  static async getSubscriptionDashboard(): Promise<SubscriptionDashboardData> {
    const response = await api.request<{
      success: boolean;
      data: SubscriptionDashboardData;
    }>('/subscriptions/dashboard');
    return response.data;
  }

  /**
   * Get subscriptions list
   */
  static async getSubscriptions(
    params: {
      status?: SubscriptionStatus;
      billingCycle?: SubscriptionBillingCycle;
      isPossiblyInactive?: boolean;
      search?: string;
    } = {},
  ): Promise<{ items: Subscription[] }> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.billingCycle) query.set('billingCycle', params.billingCycle);
    if (params.isPossiblyInactive !== undefined) {
      query.set('isPossiblyInactive', String(params.isPossiblyInactive));
    }
    if (params.search) query.set('search', params.search);

    const response = await api.request<{
      success: boolean;
      data: { items: Subscription[] };
    }>(`/subscriptions?${query.toString()}`);
    return response.data;
  }

  /**
   * Create subscription
   */
  static async createSubscription(dto: CreateSubscriptionDTO): Promise<Subscription> {
    const response = await api.request<{
      success: boolean;
      data: { item: Subscription };
    }>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return response.data.item;
  }

  /**
   * Update subscription
   */
  static async updateSubscription(id: string, dto: UpdateSubscriptionDTO): Promise<Subscription> {
    const response = await api.request<{
      success: boolean;
      data: { item: Subscription };
    }>(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    return response.data.item;
  }

  /**
   * Delete subscription
   */
  static async deleteSubscription(id: string): Promise<void> {
    await api.request(`/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get subscription details and authentic matched transactions history
   */
  static async getSubscriptionHistory(id: string): Promise<{
    subscription: Subscription;
    transactions: import('../types/recurring.ts').MatchedTransaction[];
  }> {
    const response = await api.request<{
      success: boolean;
      data: {
        subscription: Subscription;
        transactions: import('../types/recurring.ts').MatchedTransaction[];
      };
    }>(`/subscriptions/${id}/history`);
    return response.data;
  }

  /**
   * Toggle recurring expense active status
   */
  static async toggleRecurringActive(id: string, isActive: boolean): Promise<RecurringExpense> {
    const response = await api.request<{
      success: boolean;
      data: { item: RecurringExpense };
    }>(`/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    });
    return response.data.item;
  }

  /**
   * Delete recurring expense
   */
  static async deleteRecurringExpense(id: string): Promise<void> {
    await api.request(`/recurring/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get upcoming bill reminders
   */
  static async getUpcomingBills(days = 14): Promise<BillReminder[]> {
    const response = await api.request<{
      success: boolean;
      data: { bills: BillReminder[] };
    }>(`/recurring/reminders/upcoming?days=${days}`);
    return response.data.bills;
  }

  /**
   * Trigger bill reminder notifications
   */
  static async triggerBillReminders(): Promise<{
    triggeredReminders: number;
    totalUpcomingBills: number;
  }> {
    const response = await api.request<{
      success: boolean;
      data: { triggeredReminders: number; totalUpcomingBills: number };
    }>('/recurring/reminders/trigger', {
      method: 'POST',
    });
    return response.data;
  }
}
