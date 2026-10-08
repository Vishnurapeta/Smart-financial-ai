import { api } from './api.ts';
import type {
  ChatResponse,
  ConversationListItem,
  Conversation,
  QuickAction,
  LiveFinancialSnapshot,
} from '../types/assistant.ts';

export class AssistantService {
  static async chat(
    message: string,
    conversationId?: string,
    context?: { lastIntent?: string; lastCategory?: string; lastPeriod?: string },
  ): Promise<ChatResponse> {
    const res = await api.request<{ success: boolean; data: ChatResponse }>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId, context }),
    });
    return res.data;
  }

  static async getFinancialContext(): Promise<LiveFinancialSnapshot> {
    const res = await api.request<{ success: boolean; data: LiveFinancialSnapshot }>('/assistant/context');
    return res.data;
  }

  static async listConversations(): Promise<ConversationListItem[]> {
    const res = await api.request<{ success: boolean; data: ConversationListItem[] }>('/assistant/conversations');
    return res.data;
  }

  static async getConversation(id: string): Promise<Conversation> {
    const res = await api.request<{ success: boolean; data: Conversation }>(`/assistant/conversations/${id}`);
    return res.data;
  }

  static async deleteConversation(id: string): Promise<void> {
    await api.request(`/assistant/conversations/${id}`, { method: 'DELETE' });
  }

  static async clearConversation(id: string): Promise<void> {
    await api.request(`/assistant/conversations/${id}/clear`, { method: 'POST' });
  }

  static async getQuickActions(): Promise<QuickAction[]> {
    const res = await api.request<{ success: boolean; data: QuickAction[] }>('/assistant/quick-actions');
    return res.data;
  }
}
