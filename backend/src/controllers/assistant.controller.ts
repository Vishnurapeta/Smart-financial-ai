import { Request, Response, NextFunction } from 'express';
import { AssistantService } from '../services/ai-assistant/assistant.service.js';

export class AssistantController {
  /** POST /api/v1/assistant/chat — Send a message */
  static async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { message, conversationId, context } = req.body as {
        message: string;
        conversationId?: string;
        context?: { lastIntent?: string; lastCategory?: string; lastPeriod?: any };
      };

      if (!message || !message.trim()) {
        res.status(400).json({ success: false, message: 'Message is required' });
        return;
      }

      if (message.trim().length > 2000) {
        res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters)' });
        return;
      }

      const result = await AssistantService.chat(userId, message.trim(), conversationId, context);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/assistant/context — Get live financial snapshot context */
  static async getFinancialContext(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const snapshot = await AssistantService.getFinancialContext(userId);
      res.status(200).json({ success: true, data: snapshot });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/assistant/conversations — List conversations */
  static async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const conversations = await AssistantService.listConversations(userId);
      res.status(200).json({ success: true, data: conversations });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/assistant/conversations/:id — Get single conversation */
  static async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const conversation = await AssistantService.getConversation(userId, id);
      res.status(200).json({ success: true, data: conversation });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/v1/assistant/conversations/:id — Delete conversation */
  static async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await AssistantService.deleteConversation(userId, id);
      res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/v1/assistant/conversations/:id/clear — Clear messages */
  static async clearConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await AssistantService.clearConversation(userId, id);
      res.status(200).json({ success: true, message: 'Conversation cleared successfully' });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/assistant/quick-actions — Get quick action prompts */
  static async getQuickActions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quickActions = AssistantService.getQuickActions();
      res.status(200).json({ success: true, data: quickActions });
    } catch (err) {
      next(err);
    }
  }
}
