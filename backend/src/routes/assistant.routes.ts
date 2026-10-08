import { Router } from 'express';
import { AssistantController } from '../controllers/assistant.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { aiAssistantRateLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

// All assistant endpoints require authentication
router.use(authenticate);

// Quick actions (public within auth) — no rate limiting needed
router.get('/quick-actions', AssistantController.getQuickActions);

// Live financial snapshot context for assistant side panel
router.get('/context', AssistantController.getFinancialContext);

// Chat endpoint (protected with AI rate limiting to prevent LLM abuse)
router.post('/chat', aiAssistantRateLimiter, AssistantController.chat);

// Conversation management
router.get('/conversations', AssistantController.listConversations);
router.get('/conversations/:id', AssistantController.getConversation);
router.delete('/conversations/:id', AssistantController.deleteConversation);
router.post('/conversations/:id/clear', AssistantController.clearConversation);

export const assistantRoutes = router;
