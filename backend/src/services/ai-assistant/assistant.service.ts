/**
 * Assistant Service — AI Financial Assistant Orchestrator
 *
 * Architecture:
 * 1. Intent Detection with date & category understanding + conversation context
 * 2. Validated tool dispatch scoped strictly to authenticated userId
 * 3. Grounded response formatting with real DB metrics
 * 4. Structured data generation for rich UI widgets (cards, tables)
 * 5. Persistent conversation history & live financial snapshot context
 */

import { Types } from 'mongoose';
import { Conversation, IConversation } from './conversation.model.js';
import { IntentDetector, IntentResult, PeriodHint } from './intent-detector.js';
import { ToolRegistry, ToolResult } from './tools/tool-registry.js';
import { User } from '../../models/user.model.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  isGrounded?: boolean;
  toolsUsed?: string[];
  structuredData?: StructuredAssistantData;
}

export interface StructuredAssistantData {
  type: 'summary' | 'transactions' | 'budgets' | 'portfolio' | 'goals' | 'subscriptions' | 'netWorth' | 'category' | 'anomalies';
  title?: string;
  periodLabel?: string;
  metrics?: Array<{ label: string; value: string; subtext?: string; type?: 'positive' | 'negative' | 'neutral' }>;
  table?: {
    headers: string[];
    rows: Array<Array<string | number>>;
  };
  sourceBadge?: string;
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

// ─── Currency Formatter ───────────────────────────────────────────────────────

export function getCurrencySymbol(code = 'INR'): string {
  switch (code.toUpperCase()) {
    case 'INR': return '₹';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'CAD': return 'CA$';
    case 'AUD': return 'A$';
    default: return `${code} `;
  }
}

export function formatCurrency(val: number, currencyCode = 'INR'): string {
  if (typeof val !== 'number' || isNaN(val)) return `${getCurrencySymbol(currencyCode)}0.00`;
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const locale = currencyCode.toUpperCase() === 'INR' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${isNeg ? '-' : ''}${getCurrencySymbol(currencyCode)}${formatted}`;
}

// ─── Grounded Response Builder ────────────────────────────────────────────────

function buildGroundedResponse(
  intentResult: IntentResult,
  toolResults: ToolResult[],
  currency = 'INR',
): { text: string; structuredData?: StructuredAssistantData } {
  const { intent } = intentResult;

  // Conversational Guidance when no specific tool is triggered
  if (intent === 'GENERAL_FINANCIAL_QUERY') {
    return {
      text: `I'm your SMARTFIN AI Financial Assistant. I can analyze your actual financial records:\n\n• **Transactions:** "Show my all transactions", "Show my latest transactions", "Show my Netflix transactions", or "Show transactions above ₹1000"\n• **Expenses & Spending:** "What are my total expenses?" or "How much did I spend on food?"\n• **Savings & Budgets:** "What is my net savings?" or "Am I within my budget?"\n• **Wealth & Portfolio:** "What is my net worth?" or "How is my portfolio doing?"\n• **Full Summary:** "Give me my financial summary"`,
    };
  }

  const firstResult = toolResults[0];

  if (!firstResult?.success || !firstResult.data) {
    return {
      text: "I couldn't find any matching records in your current financial data.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = firstResult.data as any;

  switch (intent) {
    // 1. Transaction Listing (All, Search, Amount Filter, Recent)
    case 'TRANSACTION_LIST':
    case 'TRANSACTION_SEARCH':
    case 'TRANSACTION_FILTER':
    case 'RECENT_TRANSACTIONS': {
      const txs = data.transactions || [];
      if (!data.hasData || txs.length === 0) {
        return {
          text: "I couldn't find any matching transactions in your current financial data.",
          structuredData: {
            type: 'transactions',
            title: 'Transactions',
            metrics: [{ label: 'Matching Transactions', value: '0', type: 'neutral' }],
            sourceBadge: 'Queried from your live database ledger',
          },
        };
      }

      let headerText = 'Here are your transactions:';
      if (data.search) {
        headerText = `Here are your transactions matching **"${data.search}"**:`;
      } else if (data.minAmount !== undefined && data.maxAmount !== undefined) {
        headerText = `Here are your transactions between **${formatCurrency(data.minAmount, currency)}** and **${formatCurrency(data.maxAmount, currency)}**:`;
      } else if (data.minAmount !== undefined) {
        headerText = `Here are your transactions above **${formatCurrency(data.minAmount, currency)}**:`;
      } else if (data.maxAmount !== undefined) {
        headerText = `Here are your transactions below **${formatCurrency(data.maxAmount, currency)}**:`;
      } else if (data.category) {
        headerText = `Here are your **${data.category}** transactions:`;
      } else if (data.period) {
        headerText = `Here are your transactions for **${data.period}**:`;
      } else if (intent === 'RECENT_TRANSACTIONS' || (intentResult.toolParams as any)?.limit === 10) {
        headerText = `Here are your **${txs.length} latest transactions**:`;
      }

      const lines: string[] = [headerText, ''];

      txs.forEach((t: any, idx: number) => {
        lines.push(
          `${idx + 1}. **${t.merchant}** — ${formatCurrency(t.amount, currency)}`,
          `   Category: ${t.category}`,
          `   Date: ${t.date}`,
          `   Type: ${t.type}`,
          `   Payment: ${t.paymentMethod}`,
          '',
        );
      });

      const tableRows = txs.map((t: any) => [
        t.date,
        t.merchant,
        t.category,
        t.type,
        formatCurrency(t.amount, currency),
        t.paymentMethod,
      ]);

      return {
        text: lines.join('\n').trim(),
        structuredData: {
          type: 'transactions',
          title: headerText.replace(/\*\*/g, ''),
          table: { headers: ['Date', 'Merchant', 'Category', 'Type', 'Amount', 'Payment'], rows: tableRows },
          sourceBadge: `Retrieved ${txs.length} records from your live transaction database`,
        },
      };
    }

    // 2. Specific Category Spending (e.g. food, entertainment, rent)
    case 'EXPENSE_CATEGORY': {
      if (!data.hasData || data.totalSpent === 0) {
        return {
          text: `You have no recorded expenses for **${data.categoryName}** during **${data.period}**.`,
          structuredData: {
            type: 'category',
            title: `${data.categoryName} Spending`,
            periodLabel: data.period,
            metrics: [
              { label: 'Total Spent', value: `${getCurrencySymbol(currency)}0.00`, type: 'neutral' },
              { label: 'Transactions', value: '0', type: 'neutral' },
            ],
            sourceBadge: `Based on your transaction records for ${data.period}`,
          },
        };
      }

      const lines = [
        `You spent **${formatCurrency(data.totalSpent, currency)}** on **${data.categoryName}** across **${data.transactionCount}** transaction${data.transactionCount === 1 ? '' : 's'} during **${data.period}**.`,
        ``,
        `- 💸 **Total Spent:** ${formatCurrency(data.totalSpent, currency)}`,
        `- 🔢 **Transaction Count:** ${data.transactionCount}`,
        `- 📊 **Average per Transaction:** ${formatCurrency(data.averageSpent, currency)}`,
      ];

      if (data.largestTransaction) {
        lines.push(`- 📌 **Largest Transaction:** ${formatCurrency(data.largestTransaction.amount, currency)} (${data.largestTransaction.merchant}) on ${data.largestTransaction.date}`);
      }

      const tableRows = (data.transactions || []).map((t: any) => [t.date, t.merchant, formatCurrency(t.amount, currency)]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'category',
          title: `${data.categoryName} Expenses`,
          periodLabel: data.period,
          metrics: [
            { label: 'Total Spent', value: formatCurrency(data.totalSpent, currency), type: 'negative' },
            { label: 'Transactions', value: String(data.transactionCount), type: 'neutral' },
            { label: 'Average', value: formatCurrency(data.averageSpent, currency), type: 'neutral' },
          ],
          table: tableRows.length > 0 ? { headers: ['Date', 'Merchant', 'Amount'], rows: tableRows } : undefined,
          sourceBadge: `Based on ${data.transactionCount} transactions from ${data.period}`,
        },
      };
    }

    // 3. Spending Summary (e.g. "How much did I spend this month?", "What are my total expenses?")
    case 'SPENDING_SUMMARY': {
      if (!data.hasData || data.transactionCount === 0) {
        return {
          text: `You don't have any transactions recorded for **${data.period}**.`,
          structuredData: {
            type: 'summary',
            title: `Spending Summary – ${data.period}`,
            periodLabel: data.period,
            metrics: [
              { label: 'Total Expenses', value: `${getCurrencySymbol(currency)}0.00`, type: 'neutral' },
              { label: 'Transactions', value: '0', type: 'neutral' },
            ],
            sourceBadge: `Based on your records for ${data.period}`,
          },
        };
      }

      const lines = [
        `You spent **${formatCurrency(data.totalExpense, currency)}** during **${data.period}** across **${data.expenseCount}** expense transaction${data.expenseCount === 1 ? '' : 's'}.`,
        ``,
        `- 💸 **Total Expenses:** ${formatCurrency(data.totalExpense, currency)}`,
        `- 💰 **Total Income:** ${formatCurrency(data.totalIncome, currency)}`,
        `- 📈 **Net Savings:** ${formatCurrency(data.netCashFlow, currency)} (${data.netCashFlow >= 0 ? 'Positive ✅' : 'Deficit ⚠️'})`,
        `- 📊 **Savings Rate:** ${data.savingsRate}`,
        `- 🔢 **Total Transactions:** ${data.transactionCount}`,
      ];

      if (data.largestExpense) {
        lines.push(`- 📌 **Largest Expense:** ${formatCurrency(data.largestExpense.amount, currency)} (${data.largestExpense.merchant} – ${data.largestExpense.category}) on ${data.largestExpense.date}`);
      }

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'summary',
          title: `Spending Overview – ${data.period}`,
          periodLabel: data.period,
          metrics: [
            { label: 'Total Spent', value: formatCurrency(data.totalExpense, currency), type: 'negative' },
            { label: 'Income', value: formatCurrency(data.totalIncome, currency), type: 'positive' },
            { label: 'Net Savings', value: formatCurrency(data.netCashFlow, currency), type: data.netCashFlow >= 0 ? 'positive' : 'negative' },
            { label: 'Savings Rate', value: data.savingsRate, type: 'neutral' },
          ],
          sourceBadge: `Based on ${data.transactionCount} transactions during ${data.period}`,
        },
      };
    }

    // 4. Largest Expenses
    case 'LARGEST_EXPENSES': {
      const txs = data.transactions || [];
      if (txs.length === 0) {
        return { text: `No expense transactions found for **${data.period}**.` };
      }

      const top = txs[0];
      const lines = [
        `Your largest expense during **${data.period}** was **${formatCurrency(top.amount, currency)}** for **${top.merchant}** _(${top.category})_ on ${top.date}.`,
        ``,
        `**Top Expenses in this period:**`,
      ];

      txs.forEach((t: any, idx: number) => {
        lines.push(`${idx + 1}. **${formatCurrency(t.amount, currency)}** — ${t.merchant} _(${t.category})_ on ${t.date}`);
      });

      const tableRows = txs.map((t: any) => [t.date, t.merchant, t.category, formatCurrency(t.amount, currency)]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'transactions',
          title: `Largest Expenses – ${data.period}`,
          periodLabel: data.period,
          metrics: [
            { label: 'Largest Expense', value: formatCurrency(top.amount, currency), subtext: top.merchant, type: 'negative' },
          ],
          table: { headers: ['Date', 'Merchant', 'Category', 'Amount'], rows: tableRows },
          sourceBadge: `Based on top transactions for ${data.period}`,
        },
      };
    }

    // 5. Savings and Savings Rate
    case 'SAVINGS_RATE': {
      const lines = [
        `Your income during **${data.period}** is **${formatCurrency(data.income, currency)}** and your expenses are **${formatCurrency(data.expenses, currency)}**, giving you net savings of **${formatCurrency(data.netSavings, currency)}** (Savings Rate: **${data.savingsRate}**).`,
        ``,
        `- 💰 **Total Income:** ${formatCurrency(data.income, currency)}`,
        `- 💸 **Total Expenses:** ${formatCurrency(data.expenses, currency)}`,
        `- 📈 **Net Savings:** ${formatCurrency(data.netSavings, currency)}`,
        `- 🎯 **Savings Rate:** ${data.savingsRate}`,
      ];

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'summary',
          title: `Savings & Rate – ${data.period}`,
          periodLabel: data.period,
          metrics: [
            { label: 'Net Savings', value: formatCurrency(data.netSavings, currency), type: data.netSavings >= 0 ? 'positive' : 'negative' },
            { label: 'Savings Rate', value: data.savingsRate, type: 'neutral' },
            { label: 'Total Inflow', value: formatCurrency(data.income, currency), type: 'positive' },
            { label: 'Total Outflow', value: formatCurrency(data.expenses, currency), type: 'negative' },
          ],
          sourceBadge: `Calculated from verified income and expense records`,
        },
      };
    }

    // 6. Budgets & Overspent Budgets
    case 'BUDGET_STATUS':
    case 'BUDGET_OVERSPENT': {
      const budgets = data.budgets || [];
      if (budgets.length === 0) {
        return { text: "You don't have any budget records in your account. You can create budgets in the Budgets section." };
      }

      const overspent = budgets.filter((b: any) => b.status === 'OVERSPENT');
      const warning = budgets.filter((b: any) => b.status === 'WARNING');
      const onTrack = budgets.filter((b: any) => b.status === 'ON_TRACK');

      let intro = '';
      if (intent === 'BUDGET_OVERSPENT') {
        if (overspent.length === 0) {
          intro = `Great news! You are currently **within all ${budgets.length}** of your budgets. None are exceeded.`;
        } else {
          intro = `You are exceeding **${overspent.length}** of your ${budgets.length} budgets:`;
        }
      } else {
        intro = `You're currently within **${budgets.length - overspent.length} of your ${budgets.length} budgets**.`;
      }

      const lines = [
        intro,
        ``,
        `- 📋 **Total Budget Limit:** ${formatCurrency(data.totalBudgeted, currency)}`,
        `- 💸 **Total Amount Spent:** ${formatCurrency(data.totalSpent, currency)}`,
        `- ✅ **On Track:** ${onTrack.length} budgets`,
        `- 🟡 **Warning (≥80%):** ${warning.length} budgets`,
        `- 🔴 **Exceeded:** ${overspent.length} budgets`,
        ``,
        `**Detailed Budgets:**`,
      ];

      for (const b of budgets) {
        const icon = b.status === 'OVERSPENT' ? '🔴' : b.status === 'WARNING' ? '🟡' : '✅';
        lines.push(`${icon} **${b.name}** (${b.category}): Limit ${formatCurrency(b.budgetLimit, currency)} | Spent ${formatCurrency(b.spent, currency)} (${b.utilization}%) | Remaining ${formatCurrency(b.remaining, currency)}`);
      }

      const tableRows = budgets.map((b: any) => [
        b.name,
        b.category,
        formatCurrency(b.budgetLimit, currency),
        formatCurrency(b.spent, currency),
        formatCurrency(b.remaining, currency),
        `${b.utilization}%`,
        b.status,
      ]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'budgets',
          title: 'Budget Utilization Status',
          metrics: [
            { label: 'Active Budgets', value: String(budgets.length), type: 'neutral' },
            { label: 'Exceeded', value: String(overspent.length), type: overspent.length > 0 ? 'negative' : 'positive' },
            { label: 'Total Limit', value: formatCurrency(data.totalBudgeted, currency), type: 'neutral' },
            { label: 'Total Spent', value: formatCurrency(data.totalSpent, currency), type: 'negative' },
          ],
          table: { headers: ['Budget', 'Category', 'Limit', 'Spent', 'Remaining', 'Utilization', 'Status'], rows: tableRows },
          sourceBadge: 'Derived from live budget limits and recorded spending',
        },
      };
    }

    // 7. Net Worth
    case 'NET_WORTH': {
      const netWorthPositive = data.netWorth >= 0;
      const lines = [
        `Your current net worth is **${formatCurrency(data.netWorth, currency)}**.`,
        ``,
        `- 🏦 **Total Assets:** ${formatCurrency(data.totalAssets, currency)} (${data.assetsCount} asset${data.assetsCount === 1 ? '' : 's'})`,
        `- 📉 **Total Liabilities:** ${formatCurrency(data.totalLiabilities, currency)} (${data.liabilitiesCount} liabilit${data.liabilitiesCount === 1 ? 'y' : 'ies'})`,
        `- ${netWorthPositive ? '✅' : '⚠️'} **Net Worth:** ${formatCurrency(data.netWorth, currency)}`,
        `- 📊 **Debt-to-Asset Ratio:** ${data.debtToAssetRatio}`,
      ];

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'netWorth',
          title: 'Net Worth Statement',
          metrics: [
            { label: 'Net Worth', value: formatCurrency(data.netWorth, currency), type: netWorthPositive ? 'positive' : 'negative' },
            { label: 'Total Assets', value: formatCurrency(data.totalAssets, currency), type: 'positive' },
            { label: 'Total Liabilities', value: formatCurrency(data.totalLiabilities, currency), type: 'negative' },
            { label: 'Debt Ratio', value: data.debtToAssetRatio, type: 'neutral' },
          ],
          sourceBadge: 'Calculated directly as Assets minus Liabilities',
        },
      };
    }

    // 8. Portfolio / Investments
    case 'PORTFOLIO_SUMMARY': {
      const holdings = data.holdings || [];
      if (holdings.length === 0) {
        return { text: "You don't currently have any investment holdings recorded in your portfolio." };
      }

      const pnlSign = data.totalPnL >= 0 ? '+' : '';
      const lines = [
        `Your portfolio is currently worth **${formatCurrency(data.currentMarketValue, currency)}** against **${formatCurrency(data.totalInvested, currency)}** invested, giving you an unrealized profit/loss of **${pnlSign}${formatCurrency(data.totalPnL, currency)}** (${pnlSign}${data.returnPercent}%).`,
        ``,
        `- 💼 **Current Market Value:** ${formatCurrency(data.currentMarketValue, currency)}`,
        `- 💵 **Total Invested:** ${formatCurrency(data.totalInvested, currency)}`,
        `- ${data.totalPnL >= 0 ? '📈' : '📉'} **Unrealized P&L:** ${pnlSign}${formatCurrency(data.totalPnL, currency)} (${pnlSign}${data.returnPercent}%)`,
        `- 📂 **Holdings Count:** ${holdings.length}`,
        ``,
        `**Current Holdings:**`,
      ];

      for (const h of holdings) {
        const sign = h.unrealizedPnL >= 0 ? '+' : '';
        lines.push(`- **${h.symbol}**: ${h.quantity} shares | Buy: ${formatCurrency(h.buyPrice, currency)} | Current: ${formatCurrency(h.currentPrice, currency)} | Value: ${formatCurrency(h.currentValue, currency)} | P&L: ${sign}${formatCurrency(h.unrealizedPnL, currency)} (${sign}${h.returnPercent}%)`);
      }

      const tableRows = holdings.map((h: any) => [
        h.symbol,
        h.quantity,
        formatCurrency(h.buyPrice, currency),
        formatCurrency(h.currentPrice, currency),
        formatCurrency(h.investedAmount, currency),
        formatCurrency(h.currentValue, currency),
        `${h.unrealizedPnL >= 0 ? '+' : ''}${formatCurrency(h.unrealizedPnL, currency)}`,
        `${h.unrealizedPnL >= 0 ? '+' : ''}${h.returnPercent}%`,
      ]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'portfolio',
          title: 'Investment Portfolio Snapshot',
          metrics: [
            { label: 'Current Value', value: formatCurrency(data.currentMarketValue, currency), type: 'positive' },
            { label: 'Total Invested', value: formatCurrency(data.totalInvested, currency), type: 'neutral' },
            { label: 'Total P&L', value: `${pnlSign}${formatCurrency(data.totalPnL, currency)}`, type: data.totalPnL >= 0 ? 'positive' : 'negative' },
            { label: 'Return', value: `${pnlSign}${data.returnPercent}%`, type: data.totalPnL >= 0 ? 'positive' : 'negative' },
          ],
          table: { headers: ['Symbol', 'Qty', 'Buy Price', 'Current Price', 'Invested', 'Value', 'P&L', 'Return %'], rows: tableRows },
          sourceBadge: 'Current Portfolio Snapshot from mark-to-market position records',
        },
      };
    }

    // 9. Goals
    case 'GOAL_PROGRESS': {
      const goals = data.goals || [];
      if (goals.length === 0) {
        return { text: "You don't have any financial goals configured yet. You can set up new goals in the Financial Goals section." };
      }

      const lines = [
        `You currently have **${data.totalGoals} financial goal${data.totalGoals === 1 ? '' : 's'}** (${data.achievedGoals} achieved).`,
        ``,
        `**Goal Progress:**`,
      ];

      for (const g of goals) {
        const icon = g.progress >= 100 ? '🏆' : '🎯';
        lines.push(`${icon} **${g.title}** (${g.category}): Saved ${formatCurrency(g.currentAmount, currency)} of ${formatCurrency(g.targetAmount, currency)} (${g.progress}%) | Remaining: ${formatCurrency(g.remainingAmount, currency)} | Target Date: ${g.targetDate}`);
      }

      const tableRows = goals.map((g: any) => [
        g.title,
        formatCurrency(g.targetAmount, currency),
        formatCurrency(g.currentAmount, currency),
        formatCurrency(g.remainingAmount, currency),
        `${g.progress}%`,
        g.targetDate,
        g.status,
      ]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'goals',
          title: 'Financial Goals Tracker',
          metrics: [
            { label: 'Total Goals', value: String(data.totalGoals), type: 'neutral' },
            { label: 'Achieved', value: String(data.achievedGoals), type: 'positive' },
          ],
          table: { headers: ['Goal', 'Target', 'Saved', 'Remaining', 'Progress', 'Target Date', 'Status'], rows: tableRows },
          sourceBadge: 'Fetched from verified Financial Goal records',
        },
      };
    }

    // 10. Subscriptions
    case 'SUBSCRIPTIONS': {
      const subs = data.subscriptions || [];
      if (subs.length === 0) {
        return { text: "You don't currently have any active subscription records." };
      }

      const lines = [
        `You currently have **${data.activeSubscriptions} active subscription${data.activeSubscriptions === 1 ? '' : 's'}** with an estimated monthly recurring cost of **${formatCurrency(data.monthlyCost, currency)}** (Annual: **${formatCurrency(data.annualCost, currency)}**).`,
        ``,
        `- 🔄 **Monthly Recurring Cost:** ${formatCurrency(data.monthlyCost, currency)}`,
        `- 📅 **Estimated Annual Cost:** ${formatCurrency(data.annualCost, currency)}`,
        `- 📦 **Active Subscriptions:** ${data.activeSubscriptions}`,
        ``,
        `**Subscriptions List:**`,
      ];

      for (const s of subs) {
        lines.push(`- **${s.name}**: ${formatCurrency(s.amount, currency)} (${s.billingCycle}) | Next Renewal: ${s.renewalDate} | Status: ${s.status}`);
      }

      const tableRows = subs.map((s: any) => [
        s.name,
        formatCurrency(s.amount, currency),
        s.billingCycle,
        s.renewalDate,
        s.status,
      ]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'subscriptions',
          title: 'Recurring Subscriptions',
          metrics: [
            { label: 'Active Subs', value: String(data.activeSubscriptions), type: 'neutral' },
            { label: 'Monthly Outflow', value: formatCurrency(data.monthlyCost, currency), type: 'negative' },
            { label: 'Annual Estimate', value: formatCurrency(data.annualCost, currency), type: 'neutral' },
          ],
          table: { headers: ['Subscription', 'Amount', 'Cycle', 'Next Renewal', 'Status'], rows: tableRows },
          sourceBadge: 'Derived from tracked subscription agreements',
        },
      };
    }

    // 11. Category Breakdown
    case 'CATEGORY_BREAKDOWN': {
      const categories = data.categories || [];
      if (categories.length === 0) {
        return { text: `No expense categories recorded for **${data.period}**.` };
      }

      const top = categories[0];
      const lines = [
        `During **${data.period}**, your total spending was **${formatCurrency(data.totalExpense, currency)}**. You spent the most on **${top.name}** (${formatCurrency(top.amount, currency)}, ${top.percentage}% of total).`,
        ``,
        `**Category Breakdown:**`,
      ];

      for (const c of categories) {
        lines.push(`- **${c.name}**: ${formatCurrency(c.amount, currency)} (${c.percentage}%) across ${c.transactionCount} transactions`);
      }

      const tableRows = categories.map((c: any) => [
        c.name,
        formatCurrency(c.amount, currency),
        `${c.percentage}%`,
        c.transactionCount,
      ]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'category',
          title: `Category Spending – ${data.period}`,
          periodLabel: data.period,
          metrics: [
            { label: 'Total Spending', value: formatCurrency(data.totalExpense, currency), type: 'negative' },
            { label: 'Top Category', value: top.name, subtext: `${formatCurrency(top.amount, currency)} (${top.percentage}%)`, type: 'neutral' },
          ],
          table: { headers: ['Category', 'Amount', 'Share', 'Transactions'], rows: tableRows },
          sourceBadge: `Categorized spending across ${data.period}`,
        },
      };
    }

    // 12. Anomalies
    case 'ANOMALY_SUMMARY': {
      const anomalies = data.anomalies || [];
      if (anomalies.length === 0) {
        return {
          text: `Zero unusual spending anomalies detected. All your spending patterns appear consistent with your normal financial baseline.`,
          structuredData: {
            type: 'anomalies',
            title: 'Spending Anomaly Scan',
            metrics: [
              { label: 'Anomalies Detected', value: '0', subtext: 'Healthy baseline', type: 'positive' },
            ],
            sourceBadge: 'ML Anomaly Detection Service scan completed',
          },
        };
      }

      const lines = [
        `Detected **${anomalies.length} unusual spending event${anomalies.length === 1 ? '' : 's'}**:`,
        ``,
      ];

      for (const a of anomalies) {
        const icon = a.severity === 'HIGH' ? '🔴' : '🟡';
        lines.push(`${icon} **${a.date}** — ${a.merchant} (${a.category}): ${formatCurrency(a.amount, currency)} [Severity: ${a.severity}]`);
        lines.push(`   _${a.reason}_`);
      }

      const tableRows = anomalies.map((a: any) => [
        a.date,
        a.merchant,
        formatCurrency(a.amount, currency),
        a.category,
        a.severity,
        a.reason,
      ]);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'anomalies',
          title: 'Flagged Spending Anomalies',
          table: { headers: ['Date', 'Merchant', 'Amount', 'Category', 'Severity', 'Reason'], rows: tableRows },
          sourceBadge: 'Derived from statistical and isolation forest anomaly detectors',
        },
      };
    }

    // 13. Financial Forecasting
    case 'EXPENSE_FORECAST': {
      if (!data.hasData) {
        return { text: data.message || 'No machine learning forecasts available at this time.' };
      }

      const lines = [
        `**Statistical Expense Forecast** _(Model: ${data.modelName})_`,
        ``,
        `- 📅 **Period:** ${data.period}`,
        `- 🔮 **Projected Expenses:** ${formatCurrency(data.predictedExpense, currency)}`,
      ];

      if (data.projectedCashFlow !== undefined) {
        lines.push(`- 📊 **Projected Net Cash Flow:** ${formatCurrency(data.projectedCashFlow, currency)}`);
      }
      lines.push(``, `_Note: Forecasts are machine learning statistical predictions and do not represent guaranteed outcomes._`);

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'summary',
          title: 'Financial Forecast',
          metrics: [
            { label: 'Projected Expenses', value: formatCurrency(data.predictedExpense, currency), subtext: data.period, type: 'neutral' },
            { label: 'Projected Cash Flow', value: data.projectedCashFlow !== undefined ? formatCurrency(data.projectedCashFlow, currency) : 'N/A', type: 'neutral' },
          ],
          sourceBadge: 'Generated by SMARTFIN Machine Learning Forecasting Engine',
        },
      };
    }

    // 14. Complete Financial Summary (ONLY on explicit request)
    case 'FINANCIAL_SUMMARY': {
      const s = data.spending;
      const b = data.budget;
      const nw = data.netWorth;
      const p = data.portfolio;
      const subs = data.subscriptions;

      const lines = [
        `**SMARTFIN AI Complete Financial Summary**`,
        ``,
        `**Cash Flow (${s?.period || 'Current Month'}):**`,
        `- 💰 **Income:** ${s ? formatCurrency(s.totalIncome, currency) : 'N/A'}`,
        `- 💸 **Expenses:** ${s ? formatCurrency(s.totalExpense, currency) : 'N/A'}`,
        `- 📈 **Net Savings:** ${s ? formatCurrency(s.netCashFlow, currency) : 'N/A'} (${s?.savingsRate || 'N/A'})`,
        ``,
        `**Wealth & Investments:**`,
        `- 🏦 **Net Worth:** ${nw ? formatCurrency(nw.netWorth, currency) : 'N/A'} (Assets: ${nw ? formatCurrency(nw.totalAssets, currency) : 'N/A'}, Liabilities: ${nw ? formatCurrency(nw.totalLiabilities, currency) : 'N/A'})`,
        `- 💼 **Portfolio Value:** ${p ? formatCurrency(p.currentMarketValue, currency) : 'N/A'} (Invested: ${p ? formatCurrency(p.totalInvested, currency) : 'N/A'}, P&L: ${p ? `${p.totalPnL >= 0 ? '+' : ''}${formatCurrency(p.totalPnL, currency)} (${p.returnPercent}%)` : 'N/A'})`,
        ``,
        `**Obligations & Budgets:**`,
        `- 📋 **Budget Status:** ${b ? `${b.totalBudgets - b.overspentCount}/${b.totalBudgets} budgets healthy` : 'N/A'}`,
        `- 🔄 **Subscriptions:** ${subs ? `${subs.activeSubscriptions} active (${formatCurrency(subs.monthlyCost, currency)}/month)` : 'N/A'}`,
      ];

      return {
        text: lines.join('\n'),
        structuredData: {
          type: 'summary',
          title: 'Complete Financial Summary',
          metrics: [
            { label: 'Income', value: s ? formatCurrency(s.totalIncome, currency) : `${getCurrencySymbol(currency)}0.00`, type: 'positive' },
            { label: 'Expenses', value: s ? formatCurrency(s.totalExpense, currency) : `${getCurrencySymbol(currency)}0.00`, type: 'negative' },
            { label: 'Net Savings', value: s ? formatCurrency(s.netCashFlow, currency) : `${getCurrencySymbol(currency)}0.00`, type: s && s.netCashFlow >= 0 ? 'positive' : 'negative' },
            { label: 'Net Worth', value: nw ? formatCurrency(nw.netWorth, currency) : `${getCurrencySymbol(currency)}0.00`, type: 'positive' },
          ],
          sourceBadge: 'Comprehensive multi-module aggregation across all application databases',
        },
      };
    }

    // Default Fallback
    default: {
      return {
        text: `I'm your SMARTFIN AI Financial Assistant. I answer questions using your actual live financial records.\n\nYou can ask me to:\n• **Show transactions:** "Show my all transactions", "Show my Netflix transactions", or "Show transactions above ₹1000"\n• **Check spending:** "What are my total expenses?" or "How much did I spend on food?"\n• **Review savings & budgets:** "What is my net savings?" or "Am I within my budget?"\n• **Track wealth & portfolio:** "What is my net worth?" or "How is my portfolio doing?"\n• **Full summary:** "Give me my financial summary"`,
      };
    }
  }
}

function buildSuggestedFollowUps(intentResult: IntentResult): string[] {
  switch (intentResult.intent) {
    case 'TRANSACTION_LIST':
    case 'TRANSACTION_SEARCH':
    case 'TRANSACTION_FILTER':
      return ['What was my biggest expense?', 'What are my total expenses?', 'How much did I spend on food?', 'Give me my financial summary'];
    case 'SPENDING_SUMMARY':
      return ['How much of that was food?', 'Where am I spending the most?', 'What about last month?', 'Am I within my budget?'];
    case 'EXPENSE_CATEGORY':
      return ['What about last month?', 'What was my biggest expense?', 'Show my food expenses'];
    case 'LARGEST_EXPENSES':
      return ['Show my all transactions', 'How much did I spend this month?', 'Am I over budget?'];
    case 'SAVINGS_RATE':
      return ['What are my total expenses?', 'Compare to last month', 'What is my net worth?'];
    case 'BUDGET_STATUS':
    case 'BUDGET_OVERSPENT':
      return ['Which budget is exceeded?', 'How much did I spend on food?', 'Give me my financial summary'];
    case 'NET_WORTH':
      return ['How is my portfolio doing?', 'What are my goals?', 'Give me my financial summary'];
    case 'PORTFOLIO_SUMMARY':
      return ['What is my net worth?', 'Show my recent transactions', 'Give me my financial summary'];
    case 'SUBSCRIPTIONS':
      return ['How much did I spend this month?', 'Am I over budget?', 'Give me my financial summary'];
    case 'RECENT_TRANSACTIONS':
      return ['Show my all transactions', 'What was my biggest expense?', 'How much did I spend on food?'];
    case 'ANOMALY_SUMMARY':
      return ['Show my all transactions', 'How much did I spend this month?'];
    default:
      return ['Show my all transactions', 'What are my total expenses?', 'How much did I spend on food?', 'Give me my financial summary'];
  }
}

export class AssistantService {
  /**
   * Main conversational interaction
   */
  static async chat(
    userId: string,
    message: string,
    conversationId?: string,
    context?: { lastIntent?: string; lastCategory?: string; lastPeriod?: PeriodHint },
  ): Promise<ChatResponse> {
    const userObjectId = new Types.ObjectId(userId);

    // 1. Retrieve or initialize conversation
    let conversation: IConversation;
    if (conversationId && Types.ObjectId.isValid(conversationId)) {
      const existing = await Conversation.findOne({
        _id: conversationId,
        userId: userObjectId,
        isDeleted: false,
      });
      if (!existing) throw new NotFoundError('Conversation not found');
      conversation = existing;
    } else {
      conversation = await Conversation.create({
        userId: userObjectId,
        title: message.slice(0, 60) + (message.length > 60 ? '...' : ''),
        messages: [],
      });
    }

    // Context from previous messages if not explicitly supplied
    let lastIntent = context?.lastIntent;
    let lastCategory = context?.lastCategory;
    let lastPeriod = context?.lastPeriod;

    if (!lastIntent && conversation.messages.length > 0) {
      const lastUserMsg = conversation.messages.filter((m) => m.role === 'user').slice(-1)[0];
      if (lastUserMsg) {
        lastIntent = lastUserMsg.intent;
      }
    }

    // 2. Detect Intent with Context Awareness
    const intentResult = IntentDetector.detect(message, { lastIntent, lastCategory, lastPeriod });

    // 3. Append User Message
    conversation.messages.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      intent: intentResult.intent,
    });

    logger.info({ userId, intent: intentResult.intent, confidence: intentResult.confidence }, '[AIAssistant] Intent detected');

    // 4. Dispatch Backend Data Tools
    const toolResults: ToolResult[] = [];
    const toolCalls: Array<{ toolName: string; params: Record<string, unknown>; success: boolean; dataSnapshot?: unknown }> = [];

    for (const toolName of intentResult.toolsNeeded) {
      const res = await ToolRegistry.dispatch(toolName, userId, intentResult.toolParams);
      toolResults.push(res);
      toolCalls.push({
        toolName,
        params: intentResult.toolParams,
        success: res.success,
        dataSnapshot: res.data,
      });
    }

    // Fetch user currency from user profile
    const userDoc = await User.findById(userId).select('defaultCurrency').lean();
    const userCurrency = (userDoc as any)?.defaultCurrency || 'INR';

    // 5. Construct Grounded Response
    const { text, structuredData } = buildGroundedResponse(intentResult, toolResults, userCurrency);
    const suggestedFollowUps = buildSuggestedFollowUps(intentResult);
    const isGrounded = toolResults.length > 0 && toolResults.some((r) => r.success);

    // 6. Persist Assistant Message
    conversation.messages.push({
      role: 'assistant',
      content: text,
      timestamp: new Date(),
      toolCalls,
      intent: intentResult.intent,
      isGrounded,
    });

    conversation.lastActivityAt = new Date();
    await conversation.save();

    return {
      conversationId: conversation._id.toString(),
      message: {
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString(),
        intent: intentResult.intent,
        isGrounded,
        toolsUsed: toolResults.map((r) => r.toolName),
        structuredData,
      },
      suggestedFollowUps,
    };
  }

  /**
   * Fast, Live Financial Snapshot for the Assistant Context Panel
   */
  static async getFinancialContext(userId: string): Promise<LiveFinancialSnapshot> {
    const [spendingRes, budgetRes, netWorthRes, portfolioRes, subRes] = await Promise.all([
      ToolRegistry.getSpendingSummary(userId, { period: 'current_month' }),
      ToolRegistry.getBudgetStatus(userId, {}),
      ToolRegistry.getNetWorth(userId, {}),
      ToolRegistry.getPortfolioSummary(userId, {}),
      ToolRegistry.getSubscriptions(userId, {}),
    ]);

    const s = spendingRes.success ? (spendingRes.data as any) : null;
    const b = budgetRes.success ? (budgetRes.data as any) : null;
    const nw = netWorthRes.success ? (netWorthRes.data as any) : null;
    const p = portfolioRes.success ? (portfolioRes.data as any) : null;
    const subs = subRes.success ? (subRes.data as any) : null;

    return {
      periodLabel: s?.period || 'Current Month',
      income: s?.totalIncome || 0,
      expenses: s?.totalExpense || 0,
      netSavings: s?.netCashFlow || 0,
      savingsRate: s?.savingsRate || 'Not Available',
      netWorth: nw?.netWorth || 0,
      totalAssets: nw?.totalAssets || 0,
      totalLiabilities: nw?.totalLiabilities || 0,
      portfolioValue: p?.currentMarketValue || 0,
      portfolioInvested: p?.totalInvested || 0,
      portfolioPnL: p?.totalPnL || 0,
      portfolioReturnPercent: p?.returnPercent || 0,
      activeBudgetsCount: b?.totalBudgets || 0,
      overspentBudgetsCount: b?.overspentCount || 0,
      activeSubscriptionsCount: subs?.activeSubscriptions || 0,
      monthlySubscriptionCost: subs?.monthlyCost || 0,
      connected: true,
    };
  }

  /**
   * List conversations
   */
  static async listConversations(userId: string): Promise<ConversationListItem[]> {
    const conversations = await Conversation.find({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    })
      .sort({ lastActivityAt: -1 })
      .limit(50)
      .lean();

    return conversations.map((c) => {
      const lastMsg = c.messages.filter((m) => m.role === 'user').slice(-1)[0];
      return {
        id: c._id.toString(),
        title: c.title,
        lastMessage: lastMsg?.content?.slice(0, 100) || '',
        lastActivityAt: c.lastActivityAt.toISOString(),
        messageCount: c.messages.length,
      };
    });
  }

  /**
   * Get single conversation
   */
  static async getConversation(userId: string, conversationId: string): Promise<IConversation> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundError('Conversation not found');
    return conversation;
  }

  /**
   * Delete conversation
   */
  static async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundError('Conversation not found');
    conversation.isDeleted = true;
    await conversation.save();
  }

  /**
   * Clear conversation
   */
  static async clearConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!conversation) throw new NotFoundError('Conversation not found');
    conversation.messages = [];
    conversation.lastActivityAt = new Date();
    await conversation.save();
  }

  /**
   * Quick action prompts
   */
  static getQuickActions(): Array<{ label: string; prompt: string; icon: string; category: string }> {
    return [
      { label: 'Show All Transactions', prompt: 'Show my all transactions', icon: 'receipt', category: 'Spending' },
      { label: 'Total Expenses', prompt: 'What are my total expenses?', icon: 'trending-up', category: 'Spending' },
      { label: 'Food Spending', prompt: 'How much did I spend on food?', icon: 'pie-chart', category: 'Spending' },
      { label: 'Netflix Charges', prompt: 'Show my Netflix transactions', icon: 'receipt', category: 'Spending' },
      { label: 'Net Savings', prompt: 'What is my net savings?', icon: 'wallet', category: 'Wealth' },
      { label: 'Latest Transactions', prompt: 'Show my latest transactions', icon: 'receipt', category: 'Spending' },
      { label: 'High Value Expenses', prompt: 'Show transactions above ₹1000', icon: 'receipt', category: 'Spending' },
      { label: 'Financial Summary', prompt: 'Give me my financial summary', icon: 'activity', category: 'Analytics' },
    ];
  }
}
