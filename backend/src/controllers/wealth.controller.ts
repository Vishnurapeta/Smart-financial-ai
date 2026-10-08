import { Request, Response, NextFunction } from 'express';
import { WealthService } from '../services/wealth.service.js';
import { AssetType } from '../models/asset.model.js';
import { LiabilityType } from '../models/liability.model.js';

export class WealthController {
  // ==========================================
  // ASSETS
  // ==========================================

  static async createAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const asset = await WealthService.createAsset(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Asset created successfully',
        data: { asset },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { type, search } = req.query;
      const assets = await WealthService.getAssets(userId, {
        type: type as AssetType,
        search: search as string,
      });
      res.status(200).json({
        success: true,
        data: { assets },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAssetById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const asset = await WealthService.getAssetById(userId, id);
      res.status(200).json({
        success: true,
        data: { asset },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const asset = await WealthService.updateAsset(userId, id, req.body);
      res.status(200).json({
        success: true,
        message: 'Asset updated successfully',
        data: { asset },
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await WealthService.deleteAsset(userId, id);
      res.status(200).json({
        success: true,
        message: 'Asset deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAssetsSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const summary = await WealthService.getAssetsSummary(userId);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // LIABILITIES
  // ==========================================

  static async createLiability(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const liability = await WealthService.createLiability(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Liability created successfully',
        data: { liability },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLiabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { type, search } = req.query;
      const liabilities = await WealthService.getLiabilities(userId, {
        type: type as LiabilityType,
        search: search as string,
      });
      res.status(200).json({
        success: true,
        data: { liabilities },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLiabilityById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const liability = await WealthService.getLiabilityById(userId, id);
      res.status(200).json({
        success: true,
        data: { liability },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateLiability(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const liability = await WealthService.updateLiability(userId, id, req.body);
      res.status(200).json({
        success: true,
        message: 'Liability updated successfully',
        data: { liability },
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteLiability(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await WealthService.deleteLiability(userId, id);
      res.status(200).json({
        success: true,
        message: 'Liability deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLiabilitiesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const summary = await WealthService.getLiabilitiesSummary(userId);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // NET WORTH & HISTORICAL SNAPSHOTS
  // ==========================================

  static async getNetWorth(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const netWorth = await WealthService.getCurrentNetWorth(userId);
      res.status(200).json({
        success: true,
        data: netWorth,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const snapshot = await WealthService.createSnapshot(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Net-worth snapshot recorded successfully',
        data: { snapshot },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const history = await WealthService.getNetWorthHistory(userId);
      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await WealthService.deleteSnapshot(userId, id);
      res.status(200).json({
        success: true,
        message: 'Net-worth snapshot deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
