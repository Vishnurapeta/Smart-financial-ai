import { Types } from 'mongoose';
import crypto from 'crypto';
import { Portfolio, IPortfolio } from '../models/portfolio.model.js';
import { Holding, IHolding, HoldingAssetType } from '../models/holding.model.js';
import { StockPrediction, PredictionHorizon } from '../models/stock-prediction.model.js';
import { MarketDataService } from './market-data/market-data.service.js';
import { MarketQuote } from './market-data/market-data.types.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const KNOWN_SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology',
  MSFT: 'Technology',
  NVDA: 'Semiconductors',
  GOOGL: 'Communication Services',
  GOOG: 'Communication Services',
  AMZN: 'Consumer Cyclical',
  TSLA: 'Automotive & Clean Energy',
  META: 'Communication Services',
  SPY: 'Index ETF',
  QQQ: 'Technology ETF',
  JPM: 'Financial Services',
  V: 'Financial Technology',
  UNH: 'Healthcare',
  JNJ: 'Healthcare',
  XOM: 'Energy',
  PG: 'Consumer Defensive',
  AMD: 'Semiconductors',
  NFLX: 'Entertainment & Media',
};

export interface EnrichedHoldingDto {
  id: string;
  symbol: string;
  name: string;
  assetType: HoldingAssetType;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  investedValue: number;
  currentMarketValue: number;
  unrealizedPnL: number;
  returnPercentage: number;
  allocationPercentage: number;
  allocationWithCashPercentage: number;
  sector: string;
  currency: string;
  dailyChange: number;
  dailyChangePercent: number;
  lotsCount: number;
  notes?: string;
  lastUpdated: Date;
  predictionForecast?: {
    predictedReturn: number;
    predictedValue: number;
    horizon: string;
    confidenceScore?: number;
    model: string;
  } | null;
}

export interface PortfolioSummaryDto {
  id: string;
  name: string;
  description: string;
  baseCurrency: string;
  cashBalance: number;
  isDefault: boolean;
  benchmarkSymbol: string;
  totalInvested: number;
  currentValue: number;
  totalUnrealizedPnL: number;
  returnPercentage: number;
  totalNetValue: number;
  holdingsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SectorAllocationDto {
  sector: string;
  value: number;
  percentage: number;
}

export interface PortfolioDashboardDto {
  summary: PortfolioSummaryDto;
  holdings: EnrichedHoldingDto[];
  allocation: { symbol: string; name: string; value: number; percentage: number }[];
  sectorAllocation: SectorAllocationDto[];
  performance: {
    bestPerformer: EnrichedHoldingDto | null;
    worstPerformer: EnrichedHoldingDto | null;
    topAllocations: EnrichedHoldingDto[];
  };
}

export interface CreatePortfolioDto {
  name: string;
  description?: string;
  baseCurrency?: string;
  cashBalance?: number;
  isDefault?: boolean;
  benchmarkSymbol?: string;
}

export interface UpdatePortfolioDto {
  name?: string;
  description?: string;
  cashBalance?: number;
  isDefault?: boolean;
  benchmarkSymbol?: string;
}

export interface AddHoldingDto {
  symbol: string;
  quantity: number;
  buyPrice: number;
  buyDate?: Date | string;
  assetType?: HoldingAssetType;
  fees?: number;
  sector?: string;
  notes?: string;
}

export interface EditHoldingDto {
  quantity?: number;
  averageBuyPrice?: number;
  sector?: string;
  notes?: string;
  assetType?: HoldingAssetType;
}

export class PortfolioService {
  private static instance: PortfolioService;
  private marketDataService: MarketDataService;

  private constructor() {
    this.marketDataService = MarketDataService.getInstance();
  }

  public static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  /**
   * Resolve default sector for ticker symbol
   */
  private resolveSector(symbol: string, providedSector?: string): string {
    if (providedSector && providedSector.trim().length > 0) {
      return providedSector.trim();
    }
    const clean = symbol.toUpperCase();
    return KNOWN_SECTOR_MAP[clean] || 'Technology / General';
  }

  /**
   * Get all portfolios for a user.
   * Auto-provisions default portfolio if user has none.
   */
  async getUserPortfolios(userId: string): Promise<PortfolioSummaryDto[]> {
    let portfolios = await Portfolio.find({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).sort({ isDefault: -1, createdAt: 1 });

    if (portfolios.length === 0) {
      const defaultPortfolio = await Portfolio.create({
        userId: new Types.ObjectId(userId),
        name: 'Main Investment Portfolio',
        description: 'Core equity and asset holdings portfolio',
        baseCurrency: 'USD',
        cashBalance: 0,
        isDefault: true,
        benchmarkSymbol: 'SPY',
      });
      portfolios = [defaultPortfolio];
    }

    const summaries = await Promise.all(portfolios.map((p) => this.calculatePortfolioSummary(p)));
    return summaries;
  }

  /**
   * Get portfolio by ID with ownership verification
   */
  async getPortfolioById(userId: string, portfolioId: string): Promise<IPortfolio> {
    if (!Types.ObjectId.isValid(portfolioId)) {
      throw new BadRequestError('Invalid portfolio ID format');
    }

    const doc = await Portfolio.findOne({
      _id: new Types.ObjectId(portfolioId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!doc) {
      throw new NotFoundError('Portfolio not found');
    }

    return doc;
  }

  /**
   * Create a new investment portfolio
   */
  async createPortfolio(userId: string, data: CreatePortfolioDto): Promise<PortfolioSummaryDto> {
    const isDefault = data.isDefault ?? false;

    if (isDefault) {
      await Portfolio.updateMany(
        { userId: new Types.ObjectId(userId), isDefault: true },
        { $set: { isDefault: false } },
      );
    }

    const doc = await Portfolio.create({
      userId: new Types.ObjectId(userId),
      name: data.name.trim(),
      description: data.description?.trim() || '',
      baseCurrency: (data.baseCurrency || 'USD').toUpperCase().trim(),
      cashBalance: Math.max(0, data.cashBalance || 0),
      isDefault,
      benchmarkSymbol: (data.benchmarkSymbol || 'SPY').toUpperCase().trim(),
    });

    return this.calculatePortfolioSummary(doc);
  }

  /**
   * Update an existing portfolio
   */
  async updatePortfolio(
    userId: string,
    portfolioId: string,
    data: UpdatePortfolioDto,
  ): Promise<PortfolioSummaryDto> {
    const doc = await this.getPortfolioById(userId, portfolioId);

    if (data.name !== undefined) doc.name = data.name.trim();
    if (data.description !== undefined) doc.description = data.description.trim();
    if (data.cashBalance !== undefined) doc.cashBalance = Math.max(0, data.cashBalance);
    if (data.benchmarkSymbol !== undefined)
      doc.benchmarkSymbol = data.benchmarkSymbol.toUpperCase().trim();

    if (data.isDefault) {
      await Portfolio.updateMany(
        { userId: new Types.ObjectId(userId), isDefault: true, _id: { $ne: doc._id } },
        { $set: { isDefault: false } },
      );
      doc.isDefault = true;
    }

    await doc.save();
    return this.calculatePortfolioSummary(doc);
  }

  /**
   * Soft-delete portfolio and all its holdings
   */
  async deletePortfolio(userId: string, portfolioId: string): Promise<void> {
    const doc = await this.getPortfolioById(userId, portfolioId);
    doc.isDeleted = true;
    doc.deletedAt = new Date();
    await doc.save();

    await Holding.updateMany(
      { portfolioId: doc._id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
  }

  /**
   * Add a holding (or add a lot to an existing holding with weighted average buy price recalculation)
   */
  async addHolding(
    userId: string,
    portfolioId: string,
    data: AddHoldingDto,
  ): Promise<EnrichedHoldingDto> {
    const portfolio = await this.getPortfolioById(userId, portfolioId);
    const cleanSymbol = data.symbol.trim().toUpperCase();

    if (!cleanSymbol) {
      throw new BadRequestError('Symbol is required');
    }
    if (isNaN(data.quantity) || data.quantity <= 0) {
      throw new BadRequestError('Quantity must be greater than zero');
    }
    if (isNaN(data.buyPrice) || data.buyPrice <= 0) {
      throw new BadRequestError('Buy price must be greater than zero');
    }

    // Verify ticker exists using live market data provider (no hardcoded/fake prices)
    let quote: MarketQuote;
    try {
      quote = await this.marketDataService.getQuote(cleanSymbol);
    } catch (err) {
      logger.warn({ err, cleanSymbol }, 'Market provider validation failed for holding symbol');
      throw new BadRequestError(`Cannot add holding: symbol '${cleanSymbol}' was not recognized by market provider`);
    }

    const currentPrice = quote.currentPrice ?? (quote as unknown as { price: number }).price;
    const lotBuyDate = data.buyDate ? new Date(data.buyDate) : new Date();
    const newLot = {
      lotId: crypto.randomUUID(),
      quantity: data.quantity,
      buyPrice: data.buyPrice,
      buyDate: lotBuyDate,
      fees: data.fees || 0,
      status: 'OPEN' as const,
    };

    // Check if this symbol is already held in the portfolio
    let holding = await Holding.findOne({
      portfolioId: portfolio._id,
      userId: new Types.ObjectId(userId),
      symbol: cleanSymbol,
      isDeleted: false,
    });

    if (holding) {
      // Recalculate weighted average buy price
      const existingCost = holding.quantity * holding.averageBuyPrice;
      const additionalCost = data.quantity * data.buyPrice;
      const newTotalQuantity = holding.quantity + data.quantity;
      const newAverageBuyPrice = Math.round(((existingCost + additionalCost) / newTotalQuantity) * 100) / 100;

      holding.quantity = newTotalQuantity;
      holding.averageBuyPrice = newAverageBuyPrice;
      holding.currentPrice = currentPrice;
      holding.lastPriceUpdatedAt = new Date();
      holding.lots.push(newLot);
      if (data.sector) holding.sector = data.sector.trim();
      if (data.notes) holding.notes = data.notes.trim();

      await holding.save();
    } else {
      holding = await Holding.create({
        portfolioId: portfolio._id,
        userId: new Types.ObjectId(userId),
        symbol: cleanSymbol,
        assetType: data.assetType || HoldingAssetType.EQUITY,
        quantity: data.quantity,
        averageBuyPrice: data.buyPrice,
        currentPrice,
        sector: this.resolveSector(cleanSymbol, data.sector),
        notes: data.notes?.trim() || '',
        currency: quote.currency || portfolio.baseCurrency,
        lots: [newLot],
        lastPriceUpdatedAt: new Date(),
      });
    }

    // Return enriched holding
    const allHoldings = await Holding.find({ portfolioId: portfolio._id, isDeleted: false });
    const totalMarketValue = allHoldings.reduce((sum, h) => sum + h.quantity * currentPrice, 0);

    return this.enrichHolding(holding, quote, totalMarketValue, totalMarketValue + portfolio.cashBalance);
  }

  /**
   * Edit holding (adjust quantity, average buy price, sector, or notes)
   */
  async editHolding(
    userId: string,
    portfolioId: string,
    holdingId: string,
    data: EditHoldingDto,
  ): Promise<EnrichedHoldingDto> {
    const portfolio = await this.getPortfolioById(userId, portfolioId);

    if (!Types.ObjectId.isValid(holdingId)) {
      throw new BadRequestError('Invalid holding ID format');
    }

    const holding = await Holding.findOne({
      _id: new Types.ObjectId(holdingId),
      portfolioId: portfolio._id,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!holding) {
      throw new NotFoundError('Holding not found in this portfolio');
    }

    if (data.quantity !== undefined) {
      if (isNaN(data.quantity) || data.quantity <= 0) {
        throw new BadRequestError('Quantity must be greater than zero');
      }
      holding.quantity = data.quantity;
    }

    if (data.averageBuyPrice !== undefined) {
      if (isNaN(data.averageBuyPrice) || data.averageBuyPrice <= 0) {
        throw new BadRequestError('Average buy price must be greater than zero');
      }
      holding.averageBuyPrice = data.averageBuyPrice;
    }

    if (data.sector !== undefined) holding.sector = data.sector.trim();
    if (data.notes !== undefined) holding.notes = data.notes.trim();
    if (data.assetType !== undefined) holding.assetType = data.assetType;

    // Refresh live quote
    let quote: MarketQuote;
    try {
      quote = await this.marketDataService.getQuote(holding.symbol);
      holding.currentPrice = quote.currentPrice ?? (quote as unknown as { price: number }).price;
      holding.lastPriceUpdatedAt = new Date();
    } catch {
      // Keep existing current price if quote fetch fails
      quote = {
        symbol: holding.symbol,
        name: holding.symbol,
        currentPrice: holding.currentPrice,
        previousClose: holding.currentPrice,
        change: 0,
        changePercent: 0,
        open: holding.currentPrice,
        high: holding.currentPrice,
        low: holding.currentPrice,
        volume: 0,
        currency: holding.currency,
        timestamp: new Date(),
        provider: 'cached',
      };
    }

    await holding.save();

    const allHoldings = await Holding.find({ portfolioId: portfolio._id, isDeleted: false });
    const totalMarketValue = allHoldings.reduce(
      (sum, h) => sum + h.quantity * (h._id.equals(holding._id) ? holding.currentPrice : h.currentPrice),
      0,
    );

    return this.enrichHolding(holding, quote, totalMarketValue, totalMarketValue + portfolio.cashBalance);
  }

  /**
   * Remove holding from portfolio
   */
  async removeHolding(userId: string, portfolioId: string, holdingId: string): Promise<void> {
    const portfolio = await this.getPortfolioById(userId, portfolioId);

    if (!Types.ObjectId.isValid(holdingId)) {
      throw new BadRequestError('Invalid holding ID format');
    }

    const holding = await Holding.findOne({
      _id: new Types.ObjectId(holdingId),
      portfolioId: portfolio._id,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!holding) {
      throw new NotFoundError('Holding not found in this portfolio');
    }

    holding.isDeleted = true;
    holding.deletedAt = new Date();
    await holding.save();
  }

  /**
   * Enrich raw holding with live quote data, marked-to-market calculations, and future prediction forecast
   */
  private async enrichHolding(
    holding: IHolding,
    quote: MarketQuote,
    totalPortfolioMarketValue: number,
    totalNetValueWithCash: number,
    preloadedPrediction?: {
      predictedReturn: number;
      predictedValue: number;
      horizon: string;
      confidenceScore?: number;
      model: string;
    } | null,
  ): Promise<EnrichedHoldingDto> {
    const currentPrice = quote.currentPrice ?? (quote as unknown as { price: number }).price;
    const investedValue = Math.round(holding.quantity * holding.averageBuyPrice * 100) / 100;
    const currentMarketValue = Math.round(holding.quantity * currentPrice * 100) / 100;
    const unrealizedPnL = Math.round((currentMarketValue - investedValue) * 100) / 100;
    const returnPercentage =
      investedValue > 0 ? Math.round(((currentMarketValue - investedValue) / investedValue) * 10000) / 100 : 0;

    const allocationPercentage =
      totalPortfolioMarketValue > 0
        ? Math.round((currentMarketValue / totalPortfolioMarketValue) * 10000) / 100
        : 0;

    const allocationWithCashPercentage =
      totalNetValueWithCash > 0
        ? Math.round((currentMarketValue / totalNetValueWithCash) * 10000) / 100
        : 0;

    // Look up future stock prediction if not already preloaded in batch
    let predictionForecast = preloadedPrediction !== undefined ? preloadedPrediction : null;
    if (predictionForecast === null && preloadedPrediction === undefined) {
      try {
        const pred = await StockPrediction.findOne({
          symbol: holding.symbol,
          isDeleted: false,
        }).sort({ predictionTimestamp: -1 });

        if (pred) {
          predictionForecast = {
            predictedReturn: pred.predictedReturn,
            predictedValue: pred.predictedValue,
            horizon: pred.predictionHorizon || PredictionHorizon.THIRTY_DAYS,
            confidenceScore: pred.evaluationMetrics?.confidenceScore,
            model: pred.model,
          };
        }
      } catch (err) {
        logger.debug({ err, symbol: holding.symbol }, 'Failed to query stock prediction forecast');
      }
    }

    return {
      id: holding._id.toString(),
      symbol: holding.symbol,
      name: quote.name || holding.symbol,
      assetType: holding.assetType,
      quantity: holding.quantity,
      averageBuyPrice: holding.averageBuyPrice,
      currentPrice,
      investedValue,
      currentMarketValue,
      unrealizedPnL,
      returnPercentage,
      allocationPercentage,
      allocationWithCashPercentage,
      sector: holding.sector || this.resolveSector(holding.symbol),
      currency: holding.currency,
      dailyChange: quote.change,
      dailyChangePercent: quote.changePercent,
      lotsCount: holding.lots ? holding.lots.length : 1,
      notes: holding.notes,
      lastUpdated: holding.updatedAt || new Date(),
      predictionForecast,
    };
  }

  /**
   * Calculate summary metrics for a portfolio
   */
  private async calculatePortfolioSummary(portfolio: IPortfolio): Promise<PortfolioSummaryDto> {
    const holdings = await Holding.find({
      portfolioId: portfolio._id,
      isDeleted: false,
    });

    let totalInvested = 0;
    let currentValue = 0;

    // Calculate metrics using live prices
    await Promise.all(
      holdings.map(async (h) => {
        let price = h.currentPrice;
        try {
          const q = await this.marketDataService.getQuote(h.symbol);
          price = q.currentPrice ?? (q as unknown as { price: number }).price;
        } catch {
          // Use last stored price
        }
        totalInvested += h.quantity * h.averageBuyPrice;
        currentValue += h.quantity * price;
      }),
    );

    totalInvested = Math.round(totalInvested * 100) / 100;
    currentValue = Math.round(currentValue * 100) / 100;
    const totalUnrealizedPnL = Math.round((currentValue - totalInvested) * 100) / 100;
    const returnPercentage =
      totalInvested > 0 ? Math.round(((currentValue - totalInvested) / totalInvested) * 10000) / 100 : 0;
    const totalNetValue = Math.round((currentValue + portfolio.cashBalance) * 100) / 100;

    return {
      id: portfolio._id.toString(),
      name: portfolio.name,
      description: portfolio.description,
      baseCurrency: portfolio.baseCurrency,
      cashBalance: portfolio.cashBalance,
      isDefault: portfolio.isDefault,
      benchmarkSymbol: portfolio.benchmarkSymbol,
      totalInvested,
      currentValue,
      totalUnrealizedPnL,
      returnPercentage,
      totalNetValue,
      holdingsCount: holdings.length,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }

  /**
   * Get complete portfolio dashboard with live marked-to-market holdings,
   * asset allocation breakdown, and sector distribution.
   */
  async getPortfolioDashboard(userId: string, portfolioId: string): Promise<PortfolioDashboardDto> {
    const portfolio = await this.getPortfolioById(userId, portfolioId);
    const holdings = await Holding.find({
      portfolioId: portfolio._id,
      isDeleted: false,
    });

    // 1. Fetch live quotes for all holdings concurrently
    const quotesMap = new Map<string, MarketQuote>();
    await Promise.all(
      holdings.map(async (h) => {
        try {
          const q = await this.marketDataService.getQuote(h.symbol);
          quotesMap.set(h.symbol, q);
        } catch {
          quotesMap.set(h.symbol, {
            symbol: h.symbol,
            name: h.symbol,
            currentPrice: h.currentPrice,
            previousClose: h.currentPrice,
            change: 0,
            changePercent: 0,
            open: h.currentPrice,
            high: h.currentPrice,
            low: h.currentPrice,
            volume: 0,
            currency: h.currency,
            timestamp: new Date(),
            provider: 'cached',
          });
        }
      }),
    );

    // 2. Compute total values
    let totalInvested = 0;
    let totalMarketValue = 0;

    for (const h of holdings) {
      const q = quotesMap.get(h.symbol)!;
      const price = q.currentPrice ?? (q as unknown as { price: number }).price;
      totalInvested += h.quantity * h.averageBuyPrice;
      totalMarketValue += h.quantity * price;
    }

    totalInvested = Math.round(totalInvested * 100) / 100;
    totalMarketValue = Math.round(totalMarketValue * 100) / 100;
    const totalUnrealizedPnL = Math.round((totalMarketValue - totalInvested) * 100) / 100;
    const returnPercentage =
      totalInvested > 0 ? Math.round(((totalMarketValue - totalInvested) / totalInvested) * 10000) / 100 : 0;
    const totalNetValueWithCash = Math.round((totalMarketValue + portfolio.cashBalance) * 100) / 100;

    // 2.5 Batch fetch latest stock predictions for all unique holding symbols (Eliminates N+1 query pattern)
    const uniqueSymbols = Array.from(new Set(holdings.map((h) => h.symbol)));
    const predictionMap = new Map<string, {
      predictedReturn: number;
      predictedValue: number;
      horizon: string;
      confidenceScore?: number;
      model: string;
    }>();

    if (uniqueSymbols.length > 0) {
      try {
        const latestPredictions = await StockPrediction.aggregate([
          { $match: { symbol: { $in: uniqueSymbols }, isDeleted: false } },
          { $sort: { predictionTimestamp: -1 } },
          {
            $group: {
              _id: '$symbol',
              latest: { $first: '$$ROOT' },
            },
          },
        ]);

        for (const item of latestPredictions) {
          if (item.latest) {
            predictionMap.set(item._id, {
              predictedReturn: item.latest.predictedReturn,
              predictedValue: item.latest.predictedValue,
              horizon: item.latest.predictionHorizon || PredictionHorizon.THIRTY_DAYS,
              confidenceScore: item.latest.evaluationMetrics?.confidenceScore,
              model: item.latest.model,
            });
          }
        }
      } catch (err) {
        logger.debug({ err }, 'Failed to batch-query stock predictions for portfolio');
      }
    }

    // 3. Enrich holdings with pre-fetched predictions
    const enrichedHoldings = await Promise.all(
      holdings.map((h) =>
        this.enrichHolding(
          h,
          quotesMap.get(h.symbol)!,
          totalMarketValue,
          totalNetValueWithCash,
          predictionMap.get(h.symbol) || null,
        ),
      ),
    );

    // 4. Asset Allocation by holding
    const allocation = enrichedHoldings
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
        value: h.currentMarketValue,
        percentage: h.allocationPercentage,
      }))
      .sort((a, b) => b.value - a.value);

    // 5. Sector Allocation Breakdown
    const sectorTotals = new Map<string, number>();
    for (const h of enrichedHoldings) {
      const existing = sectorTotals.get(h.sector) || 0;
      sectorTotals.set(h.sector, existing + h.currentMarketValue);
    }

    const sectorAllocation: SectorAllocationDto[] = Array.from(sectorTotals.entries())
      .map(([sector, val]) => ({
        sector,
        value: Math.round(val * 100) / 100,
        percentage:
          totalMarketValue > 0 ? Math.round((val / totalMarketValue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // 6. Performance highlights
    const sortedByReturn = [...enrichedHoldings].sort((a, b) => b.returnPercentage - a.returnPercentage);
    const bestPerformer = sortedByReturn.length > 0 ? sortedByReturn[0] : null;
    const worstPerformer = sortedByReturn.length > 1 ? sortedByReturn[sortedByReturn.length - 1] : null;
    const topAllocations = [...enrichedHoldings].sort((a, b) => b.currentMarketValue - a.currentMarketValue).slice(0, 5);

    const summary: PortfolioSummaryDto = {
      id: portfolio._id.toString(),
      name: portfolio.name,
      description: portfolio.description,
      baseCurrency: portfolio.baseCurrency,
      cashBalance: portfolio.cashBalance,
      isDefault: portfolio.isDefault,
      benchmarkSymbol: portfolio.benchmarkSymbol,
      totalInvested,
      currentValue: totalMarketValue,
      totalUnrealizedPnL,
      returnPercentage,
      totalNetValue: totalNetValueWithCash,
      holdingsCount: holdings.length,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };

    return {
      summary,
      holdings: enrichedHoldings,
      allocation,
      sectorAllocation,
      performance: {
        bestPerformer,
        worstPerformer,
        topAllocations,
      },
    };
  }
}
