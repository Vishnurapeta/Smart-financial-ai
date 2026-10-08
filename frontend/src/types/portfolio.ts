export interface PortfolioSummary {
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
  createdAt: string;
  updatedAt: string;
}

export interface HoldingDto {
  id: string;
  symbol: string;
  name: string;
  assetType: 'EQUITY' | 'ETF' | 'MUTUAL_FUND' | 'CRYPTO' | 'BOND' | 'OTHER';
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
  lastUpdated: string;
  predictionForecast?: {
    predictedReturn: number;
    predictedValue: number;
    horizon: string;
    confidenceScore?: number;
    model: string;
  } | null;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
}

export interface PortfolioDashboard {
  summary: PortfolioSummary;
  holdings: HoldingDto[];
  allocation: { symbol: string; name: string; value: number; percentage: number }[];
  sectorAllocation: SectorAllocation[];
  performance: {
    bestPerformer: HoldingDto | null;
    worstPerformer: HoldingDto | null;
    topAllocations: HoldingDto[];
  };
}

export interface CreatePortfolioPayload {
  name: string;
  description?: string;
  baseCurrency?: string;
  cashBalance?: number;
  isDefault?: boolean;
  benchmarkSymbol?: string;
}

export interface AddHoldingPayload {
  symbol: string;
  quantity: number;
  buyPrice: number;
  buyDate?: string;
  assetType?: string;
  fees?: number;
  sector?: string;
  notes?: string;
}

export interface EditHoldingPayload {
  quantity?: number;
  averageBuyPrice?: number;
  sector?: string;
  notes?: string;
}
