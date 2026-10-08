import { Types } from 'mongoose';
import { Asset, AssetType, IAsset } from '../models/asset.model.js';
import { ILiability, Liability, LiabilityType } from '../models/liability.model.js';
import { INetWorthSnapshot, NetWorthSnapshot } from '../models/net-worth-snapshot.model.js';
import { NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/security.util.js';

export interface AssetBreakdown {
  cash: number;
  bankBalance: number;
  investments: number;
  otherAssets: number;
  totalAssets: number;
  liquidAssets: number;
}

export interface LiabilityBreakdown {
  loans: number;
  creditCardDebt: number;
  otherLiabilities: number;
  totalLiabilities: number;
  totalMonthlyMinimumPayment: number;
}

export interface NetWorthOverview {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  currency: string;
  assetBreakdown: AssetBreakdown;
  liabilityBreakdown: LiabilityBreakdown;
  debtToAssetRatio: number;
  liquidityRatio: number;
  lastUpdated: Date;
}

export class WealthService {
  // ==========================================
  // ASSETS
  // ==========================================

  static async createAsset(userId: string, data: Partial<IAsset>) {
    return Asset.create({
      ...data,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
  }

  static async getAssets(userId: string, filters: { type?: AssetType; search?: string } = {}) {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    };
    if (filters.type) query.type = filters.type;
    if (filters.search) {
      const escaped = escapeRegex(filters.search.trim());
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { institutionName: { $regex: escaped, $options: 'i' } },
      ];
    }
    return Asset.find(query).sort({ currentValue: -1 });
  }

  static async getAssetById(userId: string, id: string) {
    const asset = await Asset.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
    if (!asset) throw new NotFoundError('Asset not found');
    return asset;
  }

  static async updateAsset(userId: string, id: string, data: Partial<IAsset>) {
    const asset = await this.getAssetById(userId, id);
    Object.assign(asset, data);
    return asset.save();
  }

  static async deleteAsset(userId: string, id: string) {
    const asset = await this.getAssetById(userId, id);
    asset.isDeleted = true;
    asset.deletedAt = new Date();
    await asset.save();
  }

  static async getAssetsSummary(userId: string): Promise<AssetBreakdown> {
    const assets = await Asset.find({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    let cash = 0;
    let bankBalance = 0;
    let investments = 0;
    let otherAssets = 0;
    let liquidAssets = 0;

    for (const a of assets) {
      const val = a.currentValue || 0;
      if (a.isLiquid) liquidAssets += val;

      switch (a.type) {
        case AssetType.CASH:
          cash += val;
          break;
        case AssetType.BANK_ACCOUNT:
          bankBalance += val;
          break;
        case AssetType.INVESTMENT:
        case AssetType.CRYPTO:
        case AssetType.PRECIOUS_METALS:
          investments += val;
          break;
        default:
          otherAssets += val;
      }
    }

    const totalAssets = cash + bankBalance + investments + otherAssets;

    return {
      cash: Math.round(cash * 100) / 100,
      bankBalance: Math.round(bankBalance * 100) / 100,
      investments: Math.round(investments * 100) / 100,
      otherAssets: Math.round(otherAssets * 100) / 100,
      totalAssets: Math.round(totalAssets * 100) / 100,
      liquidAssets: Math.round(liquidAssets * 100) / 100,
    };
  }

  // ==========================================
  // LIABILITIES
  // ==========================================

  static async createLiability(userId: string, data: Partial<ILiability>) {
    return Liability.create({
      ...data,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
  }

  static async getLiabilities(
    userId: string,
    filters: { type?: LiabilityType; search?: string } = {},
  ) {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    };
    if (filters.type) query.type = filters.type;
    if (filters.search) {
      const escaped = escapeRegex(filters.search.trim());
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { lender: { $regex: escaped, $options: 'i' } },
      ];
    }
    return Liability.find(query).sort({ currentBalance: -1 });
  }

  static async getLiabilityById(userId: string, id: string) {
    const liability = await Liability.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
    if (!liability) throw new NotFoundError('Liability not found');
    return liability;
  }

  static async updateLiability(userId: string, id: string, data: Partial<ILiability>) {
    const liability = await this.getLiabilityById(userId, id);
    Object.assign(liability, data);
    return liability.save();
  }

  static async deleteLiability(userId: string, id: string) {
    const liability = await this.getLiabilityById(userId, id);
    liability.isDeleted = true;
    liability.deletedAt = new Date();
    await liability.save();
  }

  static async getLiabilitiesSummary(userId: string): Promise<LiabilityBreakdown> {
    const liabilities = await Liability.find({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    let loans = 0;
    let creditCardDebt = 0;
    let otherLiabilities = 0;
    let totalMonthlyMinimumPayment = 0;

    for (const l of liabilities) {
      const bal = l.currentBalance || 0;
      totalMonthlyMinimumPayment += l.minimumPaymentMonthly || 0;

      switch (l.type) {
        case LiabilityType.CREDIT_CARD:
          creditCardDebt += bal;
          break;
        case LiabilityType.MORTGAGE:
        case LiabilityType.AUTO_LOAN:
        case LiabilityType.STUDENT_LOAN:
        case LiabilityType.PERSONAL_LOAN:
          loans += bal;
          break;
        default:
          otherLiabilities += bal;
      }
    }

    const totalLiabilities = loans + creditCardDebt + otherLiabilities;

    return {
      loans: Math.round(loans * 100) / 100,
      creditCardDebt: Math.round(creditCardDebt * 100) / 100,
      otherLiabilities: Math.round(otherLiabilities * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      totalMonthlyMinimumPayment: Math.round(totalMonthlyMinimumPayment * 100) / 100,
    };
  }

  // ==========================================
  // NET WORTH & HISTORICAL SNAPSHOTS
  // ==========================================

  /**
   * Calculate current net worth based on real database records
   * Net worth = Assets - Liabilities
   */
  static async getCurrentNetWorth(userId: string): Promise<NetWorthOverview> {
    const [assetSummary, liabilitySummary] = await Promise.all([
      this.getAssetsSummary(userId),
      this.getLiabilitiesSummary(userId),
    ]);

    const netWorth =
      Math.round((assetSummary.totalAssets - liabilitySummary.totalLiabilities) * 100) / 100;

    const debtToAssetRatio =
      assetSummary.totalAssets > 0
        ? Math.round((liabilitySummary.totalLiabilities / assetSummary.totalAssets) * 10000) / 100
        : 0;

    const liquidityRatio =
      assetSummary.totalAssets > 0
        ? Math.round((assetSummary.liquidAssets / assetSummary.totalAssets) * 10000) / 100
        : 0;

    return {
      totalAssets: assetSummary.totalAssets,
      totalLiabilities: liabilitySummary.totalLiabilities,
      netWorth,
      currency: 'USD',
      assetBreakdown: assetSummary,
      liabilityBreakdown: liabilitySummary,
      debtToAssetRatio,
      liquidityRatio,
      lastUpdated: new Date(),
    };
  }

  /**
   * Create historical net-worth snapshot
   */
  static async createSnapshot(
    userId: string,
    options: {
      date?: string | Date;
      notes?: string;
      source?: 'MANUAL' | 'AUTO_SCHEDULE' | 'SYSTEM';
    } = {},
  ): Promise<INetWorthSnapshot> {
    const currentOverview = await this.getCurrentNetWorth(userId);
    const snapshotDate = options.date ? new Date(options.date) : new Date();

    return NetWorthSnapshot.create({
      userId: new Types.ObjectId(userId),
      date: snapshotDate,
      totalAssets: currentOverview.totalAssets,
      totalLiabilities: currentOverview.totalLiabilities,
      netWorth: currentOverview.netWorth,
      currency: currentOverview.currency,
      assetBreakdown: {
        cash: currentOverview.assetBreakdown.cash,
        bankBalance: currentOverview.assetBreakdown.bankBalance,
        investments: currentOverview.assetBreakdown.investments,
        otherAssets: currentOverview.assetBreakdown.otherAssets,
      },
      liabilityBreakdown: {
        loans: currentOverview.liabilityBreakdown.loans,
        creditCardDebt: currentOverview.liabilityBreakdown.creditCardDebt,
        otherLiabilities: currentOverview.liabilityBreakdown.otherLiabilities,
      },
      source: options.source || 'MANUAL',
      notes: options.notes || '',
    });
  }

  /**
   * Get historical net-worth time series
   */
  static async getNetWorthHistory(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    let snapshots = await NetWorthSnapshot.find({
      userId: userObjectId,
    }).sort({ date: 1 });

    // If no snapshot exists yet, create an initial snapshot automatically
    if (snapshots.length === 0) {
      const initial = await this.createSnapshot(userId, {
        source: 'SYSTEM',
        notes: 'Initial automated net-worth baseline',
      });
      snapshots = [initial as unknown as (typeof snapshots)[0]];
    }

    const current = await this.getCurrentNetWorth(userId);

    // Calculate growth metrics
    const oldest = snapshots[0];
    const latest = snapshots[snapshots.length - 1];

    const netWorthChange = Math.round((current.netWorth - oldest.netWorth) * 100) / 100;
    const percentageChange =
      oldest.netWorth !== 0
        ? Math.round(((current.netWorth - oldest.netWorth) / Math.abs(oldest.netWorth)) * 10000) /
          100
        : 0;

    return {
      current,
      snapshots,
      totalSnapshots: snapshots.length,
      oldestNetWorth: oldest.netWorth,
      latestNetWorth: latest.netWorth,
      netWorthChange,
      percentageChange,
    };
  }

  static async deleteSnapshot(userId: string, id: string) {
    const snapshot = await NetWorthSnapshot.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    if (!snapshot) throw new NotFoundError('Net-worth snapshot not found');
    await NetWorthSnapshot.deleteOne({ _id: snapshot._id });
  }
}
