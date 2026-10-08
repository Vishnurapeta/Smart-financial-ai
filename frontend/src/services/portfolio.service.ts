import { api } from './api.ts';
import {
  PortfolioSummary,
  PortfolioDashboard,
  HoldingDto,
  CreatePortfolioPayload,
  AddHoldingPayload,
  EditHoldingPayload,
} from '../types/portfolio.ts';

export class PortfolioService {
  /**
   * Get all portfolios for the current authenticated user.
   * Auto-provisions a default portfolio if none exist.
   */
  static async getPortfolios(): Promise<PortfolioSummary[]> {
    const res = await api.request<{
      success: boolean;
      data: PortfolioSummary[];
    }>('/portfolios');
    return res.data;
  }

  /**
   * Get a specific portfolio by ID with live marked-to-market summaries.
   */
  static async getPortfolioById(id: string): Promise<PortfolioSummary> {
    const res = await api.request<{
      success: boolean;
      data: PortfolioSummary;
    }>(`/portfolios/${encodeURIComponent(id)}`);
    return res.data;
  }

  /**
   * Create a new investment portfolio.
   */
  static async createPortfolio(payload: CreatePortfolioPayload): Promise<PortfolioSummary> {
    const res = await api.request<{
      success: boolean;
      data: PortfolioSummary;
    }>('/portfolios', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Update portfolio metadata (name, description, cash balance, benchmark, etc.)
   */
  static async updatePortfolio(
    id: string,
    payload: Partial<CreatePortfolioPayload>,
  ): Promise<PortfolioSummary> {
    const res = await api.request<{
      success: boolean;
      data: PortfolioSummary;
    }>(`/portfolios/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Soft-delete a portfolio.
   */
  static async deletePortfolio(id: string): Promise<void> {
    await api.request<{
      success: boolean;
      data: { message: string };
    }>(`/portfolios/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get full real-time dashboard data for a portfolio:
   * Marked-to-market holdings, asset allocation, sector allocation,
   * performance highlights (best/worst performer), and predictive forecasts.
   */
  static async getDashboard(id: string): Promise<PortfolioDashboard> {
    const res = await api.request<{
      success: boolean;
      data: PortfolioDashboard;
    }>(`/portfolios/${encodeURIComponent(id)}/dashboard`);
    return res.data;
  }

  /**
   * Add a new holding lot or position to the portfolio.
   * Automatically recalculates weighted average buy price if ticker exists.
   */
  static async addHolding(portfolioId: string, payload: AddHoldingPayload): Promise<HoldingDto> {
    const res = await api.request<{
      success: boolean;
      data: HoldingDto;
    }>(`/portfolios/${encodeURIComponent(portfolioId)}/holdings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Edit an existing holding (quantity, average buy price, sector, notes).
   */
  static async editHolding(
    portfolioId: string,
    holdingId: string,
    payload: EditHoldingPayload,
  ): Promise<HoldingDto> {
    const res = await api.request<{
      success: boolean;
      data: HoldingDto;
    }>(`/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Remove a holding position and its lots from the portfolio.
   */
  static async removeHolding(portfolioId: string, holdingId: string): Promise<void> {
    await api.request<{
      success: boolean;
      data: { message: string };
    }>(`/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}`, {
      method: 'DELETE',
    });
  }
}
