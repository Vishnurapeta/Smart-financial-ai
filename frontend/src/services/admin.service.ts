import { api } from './api.ts';
import {
  PlatformOverviewMetrics,
  SystemHealthReport,
  QueueJobCounts,
  FeatureMetrics,
  ApiTelemetrySummary,
  SecurityMetricsReport,
  AdminUserListItem,
  AdminUserDetails,
  AuditLogItem,
  AuditStats,
} from '../types/admin.ts';
import { RoleName } from '../types/auth.ts';

export interface AdminUserListResponse {
  success: boolean;
  data: {
    users: AdminUserListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface AdminAuditListResponse {
  success: boolean;
  data: {
    logs: AuditLogItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export class AdminService {
  /**
   * Get high-level platform overview metrics
   */
  public async getOverviewMetrics(): Promise<PlatformOverviewMetrics> {
    const res = await api.request<{ success: boolean; data: PlatformOverviewMetrics }>('/admin/metrics/overview');
    return res.data;
  }

  /**
   * Get system health report (Node memory, MongoDB ping, Redis, FastAPI ML)
   */
  public async getSystemHealth(): Promise<SystemHealthReport> {
    const res = await api.request<{ success: boolean; data: SystemHealthReport }>('/admin/system/health');
    return res.data;
  }

  /**
   * Get BullMQ queue depths and worker states
   */
  public async getQueueMetrics(): Promise<QueueJobCounts[]> {
    const res = await api.request<{ success: boolean; data: QueueJobCounts[] }>('/admin/queues');
    return res.data;
  }

  /**
   * Get subsystem feature metrics (ML, AI Assistant, Stock Market API, Notification Deliveries)
   */
  public async getFeatureMetrics(): Promise<FeatureMetrics> {
    const res = await api.request<{ success: boolean; data: FeatureMetrics }>('/admin/metrics/features');
    return res.data;
  }

  /**
   * Get API telemetry and error monitoring
   */
  public async getTelemetryMetrics(): Promise<ApiTelemetrySummary> {
    const res = await api.request<{ success: boolean; data: ApiTelemetrySummary }>('/admin/metrics/telemetry');
    return res.data;
  }

  /**
   * Get security metrics, MFA stats, and incident logs
   */
  public async getSecurityMetrics(): Promise<SecurityMetricsReport> {
    const res = await api.request<{ success: boolean; data: SecurityMetricsReport }>('/admin/metrics/security');
    return res.data;
  }

  /**
   * List users with least privilege projection and filters
   */
  public async listUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<AdminUserListResponse['data']> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await api.request<AdminUserListResponse>(`/admin/users${queryString}`);
    return res.data;
  }

  /**
   * Get user details (non-sensitive metadata & summary stats - No Transactions)
   */
  public async getUserDetails(id: string): Promise<AdminUserDetails> {
    const res = await api.request<{ success: boolean; data: AdminUserDetails }>(`/admin/users/${id}`);
    return res.data;
  }

  /**
   * Update user status (SUSPEND, REACTIVATE, LOCK, UNLOCK)
   */
  public async updateUserStatus(
    id: string,
    action: 'SUSPEND' | 'REACTIVATE' | 'LOCK' | 'UNLOCK',
    reason?: string,
  ): Promise<void> {
    await api.request(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ action, reason }),
    });
  }

  /**
   * Update user role
   */
  public async updateUserRole(id: string, role: RoleName): Promise<void> {
    await api.request(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  /**
   * Manually verify user email
   */
  public async verifyUserEmail(id: string): Promise<void> {
    await api.request(`/admin/users/${id}/verify-email`, {
      method: 'POST',
    });
  }

  /**
   * Trigger administrative password reset
   */
  public async triggerPasswordReset(id: string): Promise<{ resetToken: string; expiresAt: string }> {
    const res = await api.request<{ success: boolean; data: { resetToken: string; expiresAt: string } }>(
      `/admin/users/${id}/reset-password`,
      { method: 'POST' },
    );
    return res.data;
  }

  /**
   * List audit logs with pagination and filters
   */
  public async listAuditLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    actorRole?: string;
    status?: string;
    resource?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<AdminAuditListResponse['data']> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.action) query.set('action', params.action);
    if (params.actorRole) query.set('actorRole', params.actorRole);
    if (params.status) query.set('status', params.status);
    if (params.resource) query.set('resource', params.resource);
    if (params.search) query.set('search', params.search);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await api.request<AdminAuditListResponse>(`/admin/audit-logs${queryString}`);
    return res.data;
  }

  /**
   * Get audit statistics
   */
  public async getAuditStats(): Promise<AuditStats> {
    const res = await api.request<{ success: boolean; data: AuditStats }>('/admin/audit-logs/stats');
    return res.data;
  }
}

export const adminService = new AdminService();
