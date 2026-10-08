export interface StructuredMetric {
  label: string;
  value: string;
  subtext?: string;
  type?: 'positive' | 'negative' | 'neutral';
}

export interface StructuredTable {
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface StructuredAssistantData {
  type: 'summary' | 'transactions' | 'budgets' | 'portfolio' | 'goals' | 'subscriptions' | 'netWorth' | 'category' | 'anomalies';
  title?: string;
  periodLabel?: string;
  metrics?: StructuredMetric[];
  table?: StructuredTable;
  sourceBadge?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  isGrounded?: boolean;
  toolsUsed?: string[];
  structuredData?: StructuredAssistantData;
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  suggestedFollowUps: string[];
}

export interface ConversationListItem {
  id: string;
  title: string;
  lastMessage: string;
  lastActivityAt: string;
  messageCount: number;
}

export interface Conversation {
  _id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
  category: string;
}

export interface LiveFinancialSnapshot {
  periodLabel: string;
  income: number;
  expenses: number;
  netSavings: number;
  savingsRate: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  portfolioValue: number;
  portfolioInvested: number;
  portfolioPnL: number;
  portfolioReturnPercent: number;
  activeBudgetsCount: number;
  overspentBudgetsCount: number;
  activeSubscriptionsCount: number;
  monthlySubscriptionCost: number;
  connected: boolean;
}

// Local UI message type (includes pending/error states & structured data)
export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  isGrounded?: boolean;
  toolsUsed?: string[];
  structuredData?: StructuredAssistantData;
  isPending?: boolean;
  isError?: boolean;
}
