import { Request, Response, NextFunction } from 'express';
import { WatchlistService } from '../services/watchlist.service.js';

export class WatchlistController {
  private watchlistService: WatchlistService;

  constructor() {
    this.watchlistService = WatchlistService.getInstance();
  }

  getWatchlists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const watchlists = await this.watchlistService.getUserWatchlists(userId);
      res.status(200).json({
        success: true,
        data: watchlists,
      });
    } catch (err) {
      next(err);
    }
  };

  getWatchlistById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const watchlist = await this.watchlistService.getWatchlistById(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: watchlist,
      });
    } catch (err) {
      next(err);
    }
  };

  createWatchlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const watchlist = await this.watchlistService.createWatchlist(userId, req.body);
      res.status(201).json({
        success: true,
        data: watchlist,
      });
    } catch (err) {
      next(err);
    }
  };

  addSymbol = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const watchlist = await this.watchlistService.addSymbol(userId, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: watchlist,
      });
    } catch (err) {
      next(err);
    }
  };

  removeSymbol = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const watchlist = await this.watchlistService.removeSymbol(
        userId,
        req.params.id,
        req.params.symbol,
      );
      res.status(200).json({
        success: true,
        data: watchlist,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteWatchlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.watchlistService.deleteWatchlist(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Watchlist deleted successfully' },
      });
    } catch (err) {
      next(err);
    }
  };
}
