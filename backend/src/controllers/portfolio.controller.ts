import { Request, Response, NextFunction } from 'express';
import { PortfolioService } from '../services/portfolio.service.js';

export class PortfolioController {
  private portfolioService: PortfolioService;

  constructor() {
    this.portfolioService = PortfolioService.getInstance();
  }

  getPortfolios = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const portfolios = await this.portfolioService.getUserPortfolios(userId);
      res.status(200).json({
        success: true,
        data: portfolios,
      });
    } catch (err) {
      next(err);
    }
  };

  getPortfolioById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const portfolio = await this.portfolioService.getPortfolioById(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: portfolio,
      });
    } catch (err) {
      next(err);
    }
  };

  createPortfolio = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const portfolio = await this.portfolioService.createPortfolio(userId, req.body);
      res.status(201).json({
        success: true,
        data: portfolio,
      });
    } catch (err) {
      next(err);
    }
  };

  updatePortfolio = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const portfolio = await this.portfolioService.updatePortfolio(userId, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: portfolio,
      });
    } catch (err) {
      next(err);
    }
  };

  deletePortfolio = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.portfolioService.deletePortfolio(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Portfolio deleted successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  addHolding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const holding = await this.portfolioService.addHolding(userId, req.params.id, req.body);
      res.status(201).json({
        success: true,
        data: holding,
      });
    } catch (err) {
      next(err);
    }
  };

  editHolding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const holding = await this.portfolioService.editHolding(
        userId,
        req.params.id,
        req.params.holdingId,
        req.body,
      );
      res.status(200).json({
        success: true,
        data: holding,
      });
    } catch (err) {
      next(err);
    }
  };

  removeHolding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.portfolioService.removeHolding(userId, req.params.id, req.params.holdingId);
      res.status(200).json({
        success: true,
        data: { message: 'Holding removed successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const dashboard = await this.portfolioService.getPortfolioDashboard(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (err) {
      next(err);
    }
  };
}
