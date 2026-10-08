import { api } from './api.ts';
import {
  Watchlist,
  CreateWatchlistPayload,
  AddWatchlistSymbolPayload,
} from '../types/watchlist.ts';

export class WatchlistService {
  /**
   * Get all user watchlists populated with real-time quotes & daily change
   */
  static async getWatchlists(): Promise<Watchlist[]> {
    const res = await api.request<{ success: boolean; data: Watchlist[] }>('/watchlists');
    return res.data;
  }

  /**
   * Get specific watchlist by ID
   */
  static async getWatchlist(id: string): Promise<Watchlist> {
    const res = await api.request<{ success: boolean; data: Watchlist }>(`/watchlists/${id}`);
    return res.data;
  }

  /**
   * Create a new watchlist
   */
  static async createWatchlist(payload: CreateWatchlistPayload): Promise<Watchlist> {
    const res = await api.request<{ success: boolean; data: Watchlist }>('/watchlists', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Add a symbol to a watchlist
   */
  static async addSymbol(
    watchlistId: string,
    payload: AddWatchlistSymbolPayload,
  ): Promise<Watchlist> {
    const res = await api.request<{ success: boolean; data: Watchlist }>(
      `/watchlists/${watchlistId}/symbols`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return res.data;
  }

  /**
   * Remove a symbol from a watchlist
   */
  static async removeSymbol(watchlistId: string, symbol: string): Promise<Watchlist> {
    const res = await api.request<{ success: boolean; data: Watchlist }>(
      `/watchlists/${watchlistId}/symbols/${symbol}`,
      {
        method: 'DELETE',
      },
    );
    return res.data;
  }

  /**
   * Delete a watchlist
   */
  static async deleteWatchlist(id: string): Promise<void> {
    await api.request(`/watchlists/${id}`, {
      method: 'DELETE',
    });
  }
}
