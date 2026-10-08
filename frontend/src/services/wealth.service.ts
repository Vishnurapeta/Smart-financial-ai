import { api } from './api.ts';
import {
  FinancialGoal,
  GoalsSummary,
  CreateGoalDTO,
  UpdateGoalDTO,
  ContributeGoalDTO,
  Asset,
  AssetSummary,
  CreateAssetDTO,
  UpdateAssetDTO,
  Liability,
  LiabilitySummary,
  CreateLiabilityDTO,
  UpdateLiabilityDTO,
  NetWorthOverview,
  NetWorthHistory,
  NetWorthSnapshot,
  CreateSnapshotDTO,
} from '../types/wealth.ts';

export class WealthService {
  // ==========================================
  // FINANCIAL GOALS
  // ==========================================

  static async getGoals(
    category?: string,
    status?: string,
    search?: string,
  ): Promise<FinancialGoal[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    if (search) params.append('search', search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{
      success: boolean;
      data: { goals: FinancialGoal[] };
    }>(`/goals${qs}`);

    return res.data.goals;
  }

  static async getGoalsSummary(): Promise<GoalsSummary> {
    const res = await api.request<{
      success: boolean;
      data: GoalsSummary;
    }>('/goals/summary');

    return res.data;
  }

  static async getGoalById(id: string): Promise<FinancialGoal> {
    const res = await api.request<{
      success: boolean;
      data: { goal: FinancialGoal };
    }>(`/goals/${id}`);

    return res.data.goal;
  }

  static async createGoal(payload: CreateGoalDTO): Promise<FinancialGoal> {
    const res = await api.request<{
      success: boolean;
      data: { goal: FinancialGoal };
    }>('/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return res.data.goal;
  }

  static async updateGoal(id: string, payload: UpdateGoalDTO): Promise<FinancialGoal> {
    const res = await api.request<{
      success: boolean;
      data: { goal: FinancialGoal };
    }>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return res.data.goal;
  }

  static async contributeToGoal(id: string, payload: ContributeGoalDTO): Promise<FinancialGoal> {
    const res = await api.request<{
      success: boolean;
      data: { goal: FinancialGoal };
    }>(`/goals/${id}/contribute`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return res.data.goal;
  }

  static async deleteGoal(id: string): Promise<void> {
    await api.request(`/goals/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // ASSETS
  // ==========================================

  static async getAssets(type?: string, search?: string): Promise<Asset[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (search) params.append('search', search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{
      success: boolean;
      data: { assets: Asset[] };
    }>(`/assets${qs}`);

    return res.data.assets;
  }

  static async getAssetsSummary(): Promise<AssetSummary> {
    const res = await api.request<{
      success: boolean;
      data: { summary: AssetSummary };
    }>('/assets/summary');

    return res.data.summary;
  }

  static async createAsset(payload: CreateAssetDTO): Promise<Asset> {
    const res = await api.request<{
      success: boolean;
      data: { asset: Asset };
    }>('/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return res.data.asset;
  }

  static async updateAsset(id: string, payload: UpdateAssetDTO): Promise<Asset> {
    const res = await api.request<{
      success: boolean;
      data: { asset: Asset };
    }>(`/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return res.data.asset;
  }

  static async deleteAsset(id: string): Promise<void> {
    await api.request(`/assets/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // LIABILITIES
  // ==========================================

  static async getLiabilities(type?: string, search?: string): Promise<Liability[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (search) params.append('search', search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.request<{
      success: boolean;
      data: { liabilities: Liability[] };
    }>(`/liabilities${qs}`);

    return res.data.liabilities;
  }

  static async getLiabilitiesSummary(): Promise<LiabilitySummary> {
    const res = await api.request<{
      success: boolean;
      data: { summary: LiabilitySummary };
    }>('/liabilities/summary');

    return res.data.summary;
  }

  static async createLiability(payload: CreateLiabilityDTO): Promise<Liability> {
    const res = await api.request<{
      success: boolean;
      data: { liability: Liability };
    }>('/liabilities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return res.data.liability;
  }

  static async updateLiability(id: string, payload: UpdateLiabilityDTO): Promise<Liability> {
    const res = await api.request<{
      success: boolean;
      data: { liability: Liability };
    }>(`/liabilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return res.data.liability;
  }

  static async deleteLiability(id: string): Promise<void> {
    await api.request(`/liabilities/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // NET WORTH & SNAPSHOTS
  // ==========================================

  static async getNetWorth(): Promise<NetWorthOverview> {
    const res = await api.request<{
      success: boolean;
      data: NetWorthOverview;
    }>('/net-worth');

    return res.data;
  }

  static async getNetWorthHistory(): Promise<NetWorthHistory> {
    const res = await api.request<{
      success: boolean;
      data: NetWorthHistory;
    }>('/net-worth/history');

    return res.data;
  }

  static async createSnapshot(payload?: CreateSnapshotDTO): Promise<NetWorthSnapshot> {
    const res = await api.request<{
      success: boolean;
      data: { snapshot: NetWorthSnapshot };
    }>('/net-worth/snapshot', {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : JSON.stringify({}),
    });

    return res.data.snapshot;
  }

  static async deleteSnapshot(id: string): Promise<void> {
    await api.request(`/net-worth/snapshot/${id}`, {
      method: 'DELETE',
    });
  }
}
