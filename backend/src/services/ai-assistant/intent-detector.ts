/**
 * Intent Detector
 *
 * Classifies user messages into financial intents.
 * Deterministic pattern matching combined with natural language date parsing,
 * category detection, search extraction, and conversation context awareness.
 */

export type Intent =
  | 'TRANSACTION_LIST'
  | 'TRANSACTION_SEARCH'
  | 'TRANSACTION_FILTER'
  | 'SPENDING_SUMMARY'
  | 'EXPENSE_CATEGORY'
  | 'CATEGORY_BREAKDOWN'
  | 'LARGEST_EXPENSES'
  | 'RECENT_TRANSACTIONS'
  | 'INCOME_SUMMARY'
  | 'SAVINGS_RATE'
  | 'BUDGET_STATUS'
  | 'BUDGET_OVERSPENT'
  | 'NET_WORTH'
  | 'PORTFOLIO_SUMMARY'
  | 'GOAL_PROGRESS'
  | 'SUBSCRIPTIONS'
  | 'ANOMALY_SUMMARY'
  | 'EXPENSE_FORECAST'
  | 'FINANCIAL_SUMMARY'
  | 'GENERAL_FINANCIAL_QUERY'
  | 'OUT_OF_SCOPE';

export type PeriodHint =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'last_30_days'
  | 'current_month'
  | 'last_month'
  | 'month_before'
  | 'this_year'
  | 'last_year'
  | 'all_time';

export interface IntentResult {
  intent: Intent;
  confidence: 'high' | 'medium' | 'low';
  periodHint?: PeriodHint;
  category?: string;
  toolsNeeded: string[];
  toolParams: Record<string, unknown>;
}

// ─── Period Extraction ────────────────────────────────────────────────────────

const PERIOD_PATTERNS: Array<{ pattern: RegExp; value: PeriodHint }> = [
  { pattern: /last 7 days|past 7 days|past week|last seven days/i, value: 'last_7_days' },
  { pattern: /last 30 days|past 30 days|last thirty days/i, value: 'last_30_days' },
  { pattern: /\btoday\b/i, value: 'today' },
  { pattern: /\byesterday\b/i, value: 'yesterday' },
  { pattern: /this week|current week/i, value: 'this_week' },
  { pattern: /last week|previous week/i, value: 'last_week' },
  { pattern: /month before|two months ago|in august|for august|august 2026/i, value: 'month_before' },
  { pattern: /last month|previous month|in september|for september|september 2026/i, value: 'last_month' },
  { pattern: /this month|current month|in october|for october|october 2026/i, value: 'current_month' },
  { pattern: /this year|current year|in 2026|for 2026|ytd|year to date/i, value: 'this_year' },
  { pattern: /last year|in 2025|for 2025/i, value: 'last_year' },
  { pattern: /all time|overall|ever|historically/i, value: 'all_time' },
];

export function extractPeriod(text: string): PeriodHint | undefined {
  for (const { pattern, value } of PERIOD_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return undefined;
}

// ─── Category Extraction ──────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(food|dining|restaurant|restaurants|eating out|dinner|lunch|breakfast|cafe)\b/i, category: 'food' },
  { pattern: /\b(entertainment|movie|movies|cinema|theatre|film|leisure|games|gaming|fun)\b/i, category: 'entertainment' },
  { pattern: /\b(grocer(y|ies)|supermarket|provisions|veggies|vegetables)\b/i, category: 'groceries' },
  { pattern: /\b(rent|housing|house|apartment|flat|maintenance)\b/i, category: 'rent' },
  { pattern: /\b(transport(ation)?|fuel|petrol|diesel|cab|taxi|uber|ola|commute|metro|bus)\b/i, category: 'transport' },
  { pattern: /\b(travel|vacation|trip|flight|hotel|holiday)\b/i, category: 'travel' },
  { pattern: /\b(bill(s)?|utilit(y|ies)|electricity|power|water|internet|wifi|phone|recharge)\b/i, category: 'bills' },
  { pattern: /\b(health(care)?|medical|medicine|medicines|doctor|hospital|pharmacy)\b/i, category: 'healthcare' },
  { pattern: /\b(shopping|retail|clothes|clothing|shoes|amazon|flipkart)\b/i, category: 'shopping' },
  { pattern: /\b(education|learning|course(s)?|books|tuition)\b/i, category: 'education' },
  { pattern: /\b(subscription(s)?|software|saas)\b/i, category: 'subscriptions' },
];

export function extractCategory(text: string): string | undefined {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return undefined;
}

// ─── Main Intent Detection Class ──────────────────────────────────────────────

export class IntentDetector {
  static detect(
    userMessage: string,
    context?: { lastIntent?: string; lastCategory?: string; lastPeriod?: PeriodHint },
  ): IntentResult {
    const text = typeof userMessage === 'string' ? userMessage.toLowerCase().trim() : '';
    let periodHint = extractPeriod(text);
    const category = extractCategory(text);

    // 1. Follow-up Context Resolution
    const isFollowUpCategory = /(how much )?of that (was|went to)|what about (food|entertainment|rent|groceries|shopping)/i.test(text);
    const isFollowUpPeriod = /what about (last month|the month before|this month|yesterday|today|last 7 days|this year)/i.test(text);

    if (isFollowUpCategory && category) {
      const inheritedPeriod = context?.lastPeriod || 'current_month';
      return {
        intent: 'EXPENSE_CATEGORY',
        confidence: 'high',
        periodHint: inheritedPeriod,
        category,
        toolsNeeded: ['getCategoryExpense'],
        toolParams: { category, period: inheritedPeriod },
      };
    }

    if (isFollowUpPeriod && periodHint) {
      if (context?.lastIntent === 'EXPENSE_CATEGORY' && context.lastCategory) {
        return {
          intent: 'EXPENSE_CATEGORY',
          confidence: 'high',
          periodHint,
          category: context.lastCategory,
          toolsNeeded: ['getCategoryExpense'],
          toolParams: { category: context.lastCategory, period: periodHint },
        };
      }
      if (context?.lastIntent === 'SPENDING_SUMMARY') {
        return {
          intent: 'SPENDING_SUMMARY',
          confidence: 'high',
          periodHint,
          toolsNeeded: ['getSpendingSummary'],
          toolParams: { period: periodHint },
        };
      }
    }

    // Default period for period-sensitive intents
    if (!periodHint) {
      periodHint = 'current_month';
    }

    // ── 2. Amount-Based Transaction Filter ────────────────────────────────────
    // "Show transactions above ₹1000", "transactions over 1000", "transactions greater than 500"
    const aboveMatch =
      text.match(/(?:transaction|expense)s?\s*(?:that are\s*)?(?:above|greater than|more than|over|>|at least)\s*(?:₹|\$|€|£|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i) ||
      text.match(/(?:above|greater than|more than|over|>|at least)\s*(?:₹|\$|€|£|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:transaction|expense)s?/i);

    const belowMatch =
      text.match(/(?:transaction|expense)s?\s*(?:that are\s*)?(?:below|less than|under|<|at most)\s*(?:₹|\$|€|£|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i) ||
      text.match(/(?:below|less than|under|<|at most)\s*(?:₹|\$|€|£|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:transaction|expense)s?/i);

    if (aboveMatch || belowMatch) {
      const minAmount = aboveMatch ? parseFloat(aboveMatch[1]) : undefined;
      const maxAmount = belowMatch ? parseFloat(belowMatch[1]) : undefined;
      return {
        intent: 'TRANSACTION_FILTER',
        confidence: 'high',
        toolsNeeded: ['getTransactionsList'],
        toolParams: { minAmount, maxAmount },
      };
    }

    // ── 3. Merchant / Keyword Search ──────────────────────────────────────────
    // "Show my Netflix transactions", "Show Netflix transactions", "Netflix transactions", "show uber transactions"
    const searchMatch = text.match(/(?:show|list|get|find|view|display)?\s*(?:my\s*)?([a-z0-9_-]+)\s+(?:transaction|charge|record)s?\b/i);
    if (searchMatch) {
      const term = searchMatch[1].toLowerCase();
      const ignoreWords = [
        'all', 'my', 'the', 'any', 'recent', 'latest', 'new', 'old', 'each', 'every', 'other',
        'food', 'entertainment', 'travel', 'rent', 'groceries', 'transport', 'bills', 'healthcare',
        'shopping', 'education', 'subscription', 'subscriptions', 'expense', 'expenses', 'income',
      ];
      if (!ignoreWords.includes(term)) {
        return {
          intent: 'TRANSACTION_SEARCH',
          confidence: 'high',
          toolsNeeded: ['getTransactionsList'],
          toolParams: { search: term },
        };
      }
    }
    const searchForMatch = text.match(/(?:transaction|charge)s?\s+(?:for|at|with|by|from)\s+([a-z0-9_-]+)/i);
    if (searchForMatch) {
      const term = searchForMatch[1].toLowerCase();
      const ignoreWords = ['me', 'us', 'him', 'her', 'them', 'all', 'last', 'this', 'october', 'september', 'august', 'today', 'yesterday', 'week', 'month', 'year'];
      if (!ignoreWords.includes(term)) {
        return {
          intent: 'TRANSACTION_SEARCH',
          confidence: 'high',
          toolsNeeded: ['getTransactionsList'],
          toolParams: { search: term },
        };
      }
    }

    // ── 4. Category Transactions List vs Category Spending Total ──────────────
    // "Show my food expenses", "show food transactions", "list my food expenses", "show entertainment transactions"
    if (
      category &&
      /^(?:show|list|get|view|display|see|fetch)\b/i.test(text) &&
      !/(how much|total|sum|average)/i.test(text)
    ) {
      return {
        intent: 'TRANSACTION_LIST',
        confidence: 'high',
        category,
        periodHint,
        toolsNeeded: ['getTransactionsList'],
        toolParams: { category, period: periodHint },
      };
    }

    // ── 5. Date / Period-Filtered Transactions ────────────────────────────────
    // "Show my transactions from October", "Show transactions in October 2026", "Show my transactions from last week"
    if (
      /(?:show|list|get|view|display|fetch)?\s*(?:my\s*)?transactions?\s+(?:from|in|for|during)\s+/i.test(text) &&
      periodHint
    ) {
      return {
        intent: 'TRANSACTION_LIST',
        confidence: 'high',
        periodHint,
        toolsNeeded: ['getTransactionsList'],
        toolParams: { period: periodHint },
      };
    }

    // ── 6. Show All Transactions ──────────────────────────────────────────────
    // "Show my all transactions", "Show all my transactions", "Show my transactions", "Show all transactions", "List all transactions"
    if (
      /show\s+my\s+all\s+transactions/i.test(text) ||
      /show\s+all\s+my\s+transactions/i.test(text) ||
      /show\s+all\s+transactions/i.test(text) ||
      /show\s+my\s+transactions/i.test(text) ||
      /list\s+all\s+transactions/i.test(text) ||
      /list\s+my\s+transactions/i.test(text) ||
      /list\s+all\s+my\s+transactions/i.test(text) ||
      /all\s+transactions/i.test(text) ||
      /^(?:show|list|get|view|display|fetch)\s+(?:all\s+)?transactions\b/i.test(text) ||
      /^(?:show|list|get|view|display|fetch)\s+all\b/i.test(text) ||
      text === 'my transactions' ||
      text === 'transactions'
    ) {
      return {
        intent: 'TRANSACTION_LIST',
        confidence: 'high',
        toolsNeeded: ['getTransactionsList'],
        toolParams: { limit: 200 },
      };
    }

    // ── 7. Latest / Recent Transactions ───────────────────────────────────────
    // "Show my latest transactions", "show latest transactions", "show recent transactions", "recent transactions"
    if (/recent transaction|latest transaction|recent activity/i.test(text)) {
      return {
        intent: 'TRANSACTION_LIST',
        confidence: 'high',
        toolsNeeded: ['getTransactionsList'],
        toolParams: { limit: 10 },
      };
    }

    // ── 8. Specific Category Spending Total ───────────────────────────────────
    // "How much did I spend on food?", "How much did I spend on entertainment?", "food spending"
    if (category && /(how much (did I|have I) spend on|spending on|expense(s)? on|spent on)/i.test(text)) {
      return {
        intent: 'EXPENSE_CATEGORY',
        confidence: 'high',
        periodHint,
        category,
        toolsNeeded: ['getCategoryExpense'],
        toolParams: { category, period: periodHint },
      };
    }

    if (category && /spend|spent|expense|cost/i.test(text) && !/budget/i.test(text)) {
      return {
        intent: 'EXPENSE_CATEGORY',
        confidence: 'high',
        periodHint,
        category,
        toolsNeeded: ['getCategoryExpense'],
        toolParams: { category, period: periodHint },
      };
    }

    // ── 9. Largest / Biggest Expenses ─────────────────────────────────────────
    // "What is my biggest expense?", "What was my largest expense this year?"
    if (/biggest expense|largest expense|highest expense|most expensive|top expense/i.test(text)) {
      return {
        intent: 'LARGEST_EXPENSES',
        confidence: 'high',
        periodHint,
        toolsNeeded: ['getLargestExpenses'],
        toolParams: { period: periodHint, limit: 5 },
      };
    }

    // ── 10. Subscriptions ─────────────────────────────────────────────────────
    // "What subscriptions do I have?", "What are my subscriptions?", "active subscriptions"
    if (/subscription(s)?|recurring (expense|charge|cost|payment)/i.test(text)) {
      return {
        intent: 'SUBSCRIPTIONS',
        confidence: 'high',
        toolsNeeded: ['getSubscriptions'],
        toolParams: {},
      };
    }

    // ── 11. Budgets ───────────────────────────────────────────────────────────
    if (/which budget.*(exceed|over)|budget(s)?.*(exceeded|over budget)/i.test(text)) {
      return {
        intent: 'BUDGET_OVERSPENT',
        confidence: 'high',
        toolsNeeded: ['getBudgetStatus'],
        toolParams: {},
      };
    }

    if (/budget/i.test(text)) {
      return {
        intent: 'BUDGET_STATUS',
        confidence: 'high',
        toolsNeeded: ['getBudgetStatus'],
        toolParams: {},
      };
    }

    // ── 12. Savings & Savings Rate ────────────────────────────────────────────
    // "What is my net savings?", "How much did I save?", "What is my savings rate?"
    if (/savings rate|how much (did I|have I) save|net saving(s)?|my saving(s)?|what is my savings/i.test(text)) {
      return {
        intent: 'SAVINGS_RATE',
        confidence: 'high',
        periodHint,
        toolsNeeded: ['getSavingsRate'],
        toolParams: { period: periodHint },
      };
    }

    // ── 13. Net Worth & Wealth ────────────────────────────────────────────────
    // "What is my net worth?", "assets and liabilities"
    if (/net worth|total wealth|my assets|liabilit(y|ies)|what am I worth/i.test(text)) {
      return {
        intent: 'NET_WORTH',
        confidence: 'high',
        toolsNeeded: ['getNetWorth'],
        toolParams: {},
      };
    }

    // ── 14. Portfolio & Investments ───────────────────────────────────────────
    // "How is my portfolio doing?", "Show my portfolio", "my stocks", "investments"
    if (/portfolio|investment(s)?|my stocks|my holdings|how (is|are) my stock/i.test(text)) {
      return {
        intent: 'PORTFOLIO_SUMMARY',
        confidence: 'high',
        toolsNeeded: ['getPortfolioSummary'],
        toolParams: {},
      };
    }

    // ── 15. Financial Goals ───────────────────────────────────────────────────
    if (/goal(s)?|savings target/i.test(text)) {
      return {
        intent: 'GOAL_PROGRESS',
        confidence: 'high',
        toolsNeeded: ['getGoalProgress'],
        toolParams: {},
      };
    }

    // ── 16. Anomalies & Unusual Transactions ──────────────────────────────────
    if (/unusual|suspicious|anomal(y|ies)|irregular|flagged|abnormal/i.test(text)) {
      return {
        intent: 'ANOMALY_SUMMARY',
        confidence: 'high',
        toolsNeeded: ['getAnomalySummary'],
        toolParams: {},
      };
    }

    // ── 17. Financial Forecasting ─────────────────────────────────────────────
    if (/forecast|predict|projection|future expense|next month expense/i.test(text)) {
      return {
        intent: 'EXPENSE_FORECAST',
        confidence: 'high',
        toolsNeeded: ['getLatestForecast'],
        toolParams: { type: 'expense' },
      };
    }

    // ── 18. Category Breakdown ────────────────────────────────────────────────
    if (/where (am I|did I|do I) spend(ing)? the most|spending breakdown|category breakdown|spending by category/i.test(text)) {
      return {
        intent: 'CATEGORY_BREAKDOWN',
        confidence: 'high',
        periodHint,
        toolsNeeded: ['getCategoryBreakdown'],
        toolParams: { period: periodHint },
      };
    }

    // ── 19. Income Summary ────────────────────────────────────────────────────
    if (/how much (did I|have I) earn|my income|salary|earnings/i.test(text) && !/expense|spend/i.test(text)) {
      return {
        intent: 'INCOME_SUMMARY',
        confidence: 'high',
        periodHint,
        toolsNeeded: ['getSpendingSummary'],
        toolParams: { period: periodHint },
      };
    }

    // ── 20. Complete Financial Summary (STRICT ONLY on explicit request) ──────
    // "Give me my financial summary", "give me a financial summary", "give me a summary", "summarize my finances"
    if (
      /(?:give me (?:my |a )?)?financial summary\b/i.test(text) ||
      /(?:give me (?:my |a )?)?summary of (?:my )?finance/i.test(text) ||
      /(?:give me (?:a |my )?)?complete financial summary\b/i.test(text) ||
      /(?:give me (?:a |my )?)?summary\b/i.test(text) ||
      /summarize (?:my )?finances?\b/i.test(text) ||
      /financial (?:health|checkup|overview)\b/i.test(text)
    ) {
      return {
        intent: 'FINANCIAL_SUMMARY',
        confidence: 'high',
        toolsNeeded: ['getFinancialSummary'],
        toolParams: {},
      };
    }

    // ── 21. Total Expenses / General Spending Summary ─────────────────────────
    // "What are my total expenses?", "How much did I spend this month?", "How much did I spend last month?"
    if (/how much (did I|have I) spend|total expense(s)?|spending (this|last|past)|my spending|what are my expenses/i.test(text)) {
      return {
        intent: 'SPENDING_SUMMARY',
        confidence: 'high',
        periodHint,
        toolsNeeded: ['getSpendingSummary'],
        toolParams: { period: periodHint },
      };
    }

    // ── Default Fallback: Conversational Guidance (NEVER default to financial summary) ──
    return {
      intent: 'GENERAL_FINANCIAL_QUERY',
      confidence: 'low',
      periodHint,
      toolsNeeded: [],
      toolParams: {},
    };
  }
}
