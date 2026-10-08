import { useState, useCallback, useRef, useEffect } from 'react';
import { AssistantService } from '../services/assistant.service.ts';
import type { UIMessage, ConversationListItem, QuickAction, LiveFinancialSnapshot } from '../types/assistant.ts';

export function useAssistant() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<LiveFinancialSnapshot | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<boolean>(false);

  const refreshSnapshot = useCallback(async () => {
    try {
      setIsSnapshotLoading(true);
      const data = await AssistantService.getFinancialContext();
      setSnapshot(data);
    } catch (err) {
      console.error('Failed to load live financial context:', err);
    } finally {
      setIsSnapshotLoading(false);
    }
  }, []);

  // Load quick actions, conversations, and live snapshot on mount
  useEffect(() => {
    AssistantService.getQuickActions().then(setQuickActions).catch(console.error);
    AssistantService.listConversations().then(setConversations).catch(console.error);
    refreshSnapshot();
  }, [refreshSnapshot]);

  const sendMessage = useCallback(
    async (userMessage: string, overrideConvId?: string) => {
      if (!userMessage.trim() || isLoading) return;
      abortRef.current = false;

      const userMsgId = `user-${Date.now()}`;
      const pendingId = `pending-${Date.now()}`;

      const userMsg: UIMessage = {
        id: userMsgId,
        role: 'user',
        content: userMessage.trim(),
        timestamp: new Date().toISOString(),
      };

      const pendingMsg: UIMessage = {
        id: pendingId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isPending: true,
      };

      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await AssistantService.chat(userMessage.trim(), overrideConvId || conversationId);

        if (abortRef.current) return;

        setConversationId(response.conversationId);
        setSuggestedFollowUps(response.suggestedFollowUps || []);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: response.message.content,
                  timestamp: response.message.timestamp,
                  intent: response.message.intent,
                  isGrounded: response.message.isGrounded,
                  toolsUsed: response.message.toolsUsed,
                  structuredData: response.message.structuredData,
                  isPending: false,
                }
              : m,
          ),
        );

        // Refresh conversation list & snapshot
        AssistantService.listConversations().then(setConversations).catch(console.error);
      } catch (err) {
        if (abortRef.current) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to get response. Please try again.';
        setError(errorMessage);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  id: `error-${Date.now()}`,
                  role: 'assistant',
                  content: `❌ ${errorMessage}`,
                  timestamp: new Date().toISOString(),
                  isError: true,
                  isPending: false,
                }
              : m,
          ),
        );
      } finally {
        if (!abortRef.current) setIsLoading(false);
      }
    },
    [isLoading, conversationId],
  );

  const loadConversation = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const conv = await AssistantService.getConversation(id);
      setConversationId(id);
      setMessages(
        conv.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m, i) => ({
            id: `loaded-${i}-${Date.now()}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp,
            intent: m.intent,
            isGrounded: m.isGrounded,
            toolsUsed: m.toolsUsed,
            structuredData: m.structuredData,
          })),
      );
      setSuggestedFollowUps([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    abortRef.current = true;
    setMessages([]);
    setConversationId(undefined);
    setSuggestedFollowUps([]);
    setError(null);
    setTimeout(() => {
      abortRef.current = false;
    }, 100);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await AssistantService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) startNewConversation();
    },
    [conversationId, startNewConversation],
  );

  const clearConversation = useCallback(async () => {
    if (!conversationId) return;
    await AssistantService.clearConversation(conversationId);
    setMessages([]);
    setSuggestedFollowUps([]);
  }, [conversationId]);

  return {
    messages,
    isLoading,
    conversationId,
    conversations,
    quickActions,
    suggestedFollowUps,
    snapshot,
    isSnapshotLoading,
    refreshSnapshot,
    error,
    sendMessage,
    loadConversation,
    startNewConversation,
    deleteConversation,
    clearConversation,
  };
}
