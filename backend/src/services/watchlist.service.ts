import { Types } from 'mongoose';
import { Watchlist, IWatchlist, IWatchlistSymbol } from '../models/watchlist.model.js';
import { MarketDataService } from './market-data/market-data.service.js';
import { MarketQuote } from './market-data/market-data.types.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface EnrichedWatchlistSymbol extends IWatchlistSymbol {
  quote?: MarketQuote | null;
}

export interface EnrichedWatchlist {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  symbols: EnrichedWatchlistSymbol[];
  createdAt: Date;
  updatedAt: Date;
}

export class WatchlistService {
  private static instance: WatchlistService;
  private marketDataService: MarketDataService;

  private constructor() {
    this.marketDataService = MarketDataService.getInstance();
  }

  public static getInstance(): WatchlistService {
    if (!WatchlistService.instance) {
      WatchlistService.instance = new WatchlistService();
    }
    return WatchlistService.instance;
  }

  /**
   * Enrich symbols with real-time market quotes (gracefully handling any unavailable quotes)
   */
  private async enrichSymbolsWithQuotes(
    symbols: IWatchlistSymbol[],
  ): Promise<EnrichedWatchlistSymbol[]> {
    if (!symbols || symbols.length === 0) {
      return [];
    }

    const enriched = await Promise.all(
      symbols.map(async (item) => {
        try {
          const quote = await this.marketDataService.getQuote(item.symbol);
          return {
            symbol: item.symbol,
            addedAt: item.addedAt,
            targetBuyPrice: item.targetBuyPrice,
            targetSellPrice: item.targetSellPrice,
            notes: item.notes,
            quote,
          };
        } catch (err) {
          logger.warn(
            { err, symbol: item.symbol },
            'Failed to fetch real-time quote for watchlist symbol',
          );
          return {
            symbol: item.symbol,
            addedAt: item.addedAt,
            targetBuyPrice: item.targetBuyPrice,
            targetSellPrice: item.targetSellPrice,
            notes: item.notes,
            quote: null,
          };
        }
      }),
    );

    return enriched;
  }

  /**
   * Format watchlist document into enriched DTO
   */
  private async formatWatchlist(doc: IWatchlist): Promise<EnrichedWatchlist> {
    const enrichedSymbols = await this.enrichSymbolsWithQuotes(doc.symbols);
    return {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      isDefault: doc.isDefault,
      symbols: enrichedSymbols,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Get all active watchlists for a user.
   * Auto-creates a default watchlist if the user has none.
   */
  async getUserWatchlists(userId: string): Promise<EnrichedWatchlist[]> {
    let watchlists = await Watchlist.find({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).sort({ isDefault: -1, createdAt: 1 });

    if (watchlists.length === 0) {
      // Auto-provision a default watchlist with benchmark tickers
      const defaultWatchlist = await Watchlist.create({
        userId: new Types.ObjectId(userId),
        name: 'My Watchlist',
        description: 'Default market monitoring watchlist',
        isDefault: true,
        symbols: [
          { symbol: 'AAPL', addedAt: new Date() },
          { symbol: 'MSFT', addedAt: new Date() },
          { symbol: 'NVDA', addedAt: new Date() },
          { symbol: 'SPY', addedAt: new Date() },
        ],
      });
      watchlists = [defaultWatchlist];
    }

    const enriched = await Promise.all(watchlists.map((wl) => this.formatWatchlist(wl)));
    return enriched;
  }

  /**
   * Get default or single watchlist for a user
   */
  async getDefaultWatchlist(userId: string): Promise<EnrichedWatchlist> {
    const defaultWl = await Watchlist.findOne({
      userId: new Types.ObjectId(userId),
      isDefault: true,
      isDeleted: false,
    });

    if (!defaultWl) {
      const all = await this.getUserWatchlists(userId);
      return all[0];
    }

    return this.formatWatchlist(defaultWl);
  }

  /**
   * Get specific watchlist by ID
   */
  async getWatchlistById(userId: string, watchlistId: string): Promise<EnrichedWatchlist> {
    if (!Types.ObjectId.isValid(watchlistId)) {
      throw new BadRequestError('Invalid watchlist ID format');
    }

    const doc = await Watchlist.findOne({
      _id: new Types.ObjectId(watchlistId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!doc) {
      throw new NotFoundError('Watchlist not found');
    }

    return this.formatWatchlist(doc);
  }

  /**
   * Create a new watchlist
   */
  async createWatchlist(
    userId: string,
    data: { name: string; description?: string; isDefault?: boolean; initialSymbols?: string[] },
  ): Promise<EnrichedWatchlist> {
    const isDefault = data.isDefault ?? false;

    if (isDefault) {
      // Unset previous defaults
      await Watchlist.updateMany(
        { userId: new Types.ObjectId(userId), isDefault: true },
        { $set: { isDefault: false } },
      );
    }

    const symbols: IWatchlistSymbol[] = (data.initialSymbols || []).map((sym) => ({
      symbol: sym.trim().toUpperCase(),
      addedAt: new Date(),
    }));

    const doc = await Watchlist.create({
      userId: new Types.ObjectId(userId),
      name: data.name.trim(),
      description: data.description?.trim() || '',
      isDefault,
      symbols,
    });

    return this.formatWatchlist(doc);
  }

  /**
   * Add a symbol to a watchlist
   */
  async addSymbol(
    userId: string,
    watchlistId: string,
    symbolData: {
      symbol: string;
      notes?: string;
      targetBuyPrice?: number;
      targetSellPrice?: number;
    },
  ): Promise<EnrichedWatchlist> {
    let doc: IWatchlist | null = null;

    if (watchlistId === 'default') {
      doc = await Watchlist.findOne({
        userId: new Types.ObjectId(userId),
        isDefault: true,
        isDeleted: false,
      });
      if (!doc) {
        doc = await Watchlist.findOne({
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        });
      }
    } else {
      if (!Types.ObjectId.isValid(watchlistId)) {
        throw new BadRequestError('Invalid watchlist ID format');
      }
      doc = await Watchlist.findOne({
        _id: new Types.ObjectId(watchlistId),
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });
    }

    if (!doc) {
      throw new NotFoundError('Watchlist not found');
    }

    const cleanSymbol = symbolData.symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      throw new BadRequestError('Symbol must not be empty');
    }

    const exists = doc.symbols.some((s) => s.symbol === cleanSymbol);
    if (exists) {
      throw new ConflictError(`Symbol ${cleanSymbol} is already in this watchlist`);
    }

    // Verify ticker exists by attempting to fetch real quote
    try {
      await this.marketDataService.getQuote(cleanSymbol);
    } catch (err) {
      logger.warn({ err, cleanSymbol }, 'Verification of symbol with market provider failed');
      // If ticker not found upstream, fail cleanly
      throw new BadRequestError(
        `Cannot add '${cleanSymbol}': symbol was not recognized by market provider`,
      );
    }

    doc.symbols.push({
      symbol: cleanSymbol,
      addedAt: new Date(),
      notes: symbolData.notes?.trim() || '',
      targetBuyPrice: symbolData.targetBuyPrice,
      targetSellPrice: symbolData.targetSellPrice,
    });

    await doc.save();
    return this.formatWatchlist(doc);
  }

  /**
   * Remove a symbol from a watchlist
   */
  async removeSymbol(
    userId: string,
    watchlistId: string,
    rawSymbol: string,
  ): Promise<EnrichedWatchlist> {
    const cleanSymbol = rawSymbol.trim().toUpperCase();

    let doc: IWatchlist | null = null;
    if (watchlistId === 'default') {
      doc = await Watchlist.findOne({
        userId: new Types.ObjectId(userId),
        isDefault: true,
        isDeleted: false,
      });
      if (!doc) {
        doc = await Watchlist.findOne({
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        });
      }
    } else {
      if (!Types.ObjectId.isValid(watchlistId)) {
        throw new BadRequestError('Invalid watchlist ID format');
      }
      doc = await Watchlist.findOne({
        _id: new Types.ObjectId(watchlistId),
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      });
    }

    if (!doc) {
      throw new NotFoundError('Watchlist not found');
    }

    const initialLength = doc.symbols.length;
    doc.symbols = doc.symbols.filter((s) => s.symbol !== cleanSymbol);

    if (doc.symbols.length === initialLength) {
      throw new NotFoundError(`Symbol ${cleanSymbol} not found in this watchlist`);
    }

    await doc.save();
    return this.formatWatchlist(doc);
  }

  /**
   * Delete a watchlist
   */
  async deleteWatchlist(userId: string, watchlistId: string): Promise<void> {
    if (!Types.ObjectId.isValid(watchlistId)) {
      throw new BadRequestError('Invalid watchlist ID format');
    }

    const doc = await Watchlist.findOne({
      _id: new Types.ObjectId(watchlistId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!doc) {
      throw new NotFoundError('Watchlist not found');
    }

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    await doc.save();
  }
}
