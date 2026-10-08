import {
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
} from '../../models/notification.model.js';

export interface FormattedNotificationContent {
  title: string;
  message: string;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  actionUrl: string;
  htmlBody: string;
  metadata?: Record<string, unknown>;
}

export class NotificationTemplateService {
  private static instance: NotificationTemplateService;

  private constructor() {}

  public static getInstance(): NotificationTemplateService {
    if (!NotificationTemplateService.instance) {
      NotificationTemplateService.instance = new NotificationTemplateService();
    }
    return NotificationTemplateService.instance;
  }

  private wrapBaseHtml(title: string, bodyContent: string, actionUrl?: string, actionText = 'View in SmartFin AI'): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
    .header { background: linear-gradient(135deg, #10b981 0%, #0d9488 100%); padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #022c22; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px; }
    .badge-info { background-color: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-warning { background-color: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); }
    .badge-alert { background-color: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); }
    .badge-critical { background-color: #dc2626; color: #ffffff; }
    .card { background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 20px; margin: 20px 0; }
    .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #022c22 !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .footer { padding: 20px 24px; background-color: #0f172a; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #334155; }
    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }
    .stat-label { color: #94a3b8; }
    .stat-val { font-weight: 600; color: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SmartFin AI</h1>
    </div>
    <div class="content">
      ${bodyContent}
      ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="btn">${actionText}</a></div>` : ''}
    </div>
    <div class="footer">
      <p>This is an automated notification from SmartFin AI Platform.</p>
      <p>Configure notification preferences in your Account Settings.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  public formatBudgetThreshold(data: {
    categoryName: string;
    spent: number;
    limit: number;
    percentage: number;
    period: string;
  }): FormattedNotificationContent {
    const title = `⚠️ Budget Alert: ${data.categoryName} at ${data.percentage.toFixed(0)}%`;
    const message = `You have spent $${data.spent.toFixed(2)} of your $${data.limit.toFixed(2)} limit for ${data.categoryName} (${data.percentage.toFixed(1)}%). Consider reviewing your discretionary expenses.`;
    const actionUrl = '/budgets';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-warning">Budget Warning</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">${data.categoryName} Budget Alert</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Category</span><span class="stat-val">${data.categoryName}</span></div>
        <div class="stat-row"><span class="stat-label">Spent</span><span class="stat-val">$${data.spent.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Budget Limit</span><span class="stat-val">$${data.limit.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Usage</span><span class="stat-val" style="color: #fbbf24;">${data.percentage.toFixed(1)}%</span></div>
      </div>
      `,
      actionUrl,
      'View Budget Details',
    );

    return {
      title,
      message,
      severity: NotificationSeverity.WARNING,
      priority: NotificationPriority.MEDIUM,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatBudgetExceeded(data: {
    categoryName: string;
    spent: number;
    limit: number;
    overspentAmount: number;
    period: string;
  }): FormattedNotificationContent {
    const title = `🚨 Budget Exceeded: ${data.categoryName}`;
    const message = `You have exceeded your ${data.categoryName} budget by $${data.overspentAmount.toFixed(2)}. Total spent: $${data.spent.toFixed(2)} against a limit of $${data.limit.toFixed(2)}.`;
    const actionUrl = '/budgets';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-alert">Budget Exceeded</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0; color: #f43f5e;">${data.categoryName} Limit Exceeded</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Category</span><span class="stat-val">${data.categoryName}</span></div>
        <div class="stat-row"><span class="stat-label">Budget Limit</span><span class="stat-val">$${data.limit.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Total Spent</span><span class="stat-val" style="color: #f43f5e;">$${data.spent.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Over Budget By</span><span class="stat-val" style="color: #f43f5e;">+$${data.overspentAmount.toFixed(2)}</span></div>
      </div>
      `,
      actionUrl,
      'Manage Budgets',
    );

    return {
      title,
      message,
      severity: NotificationSeverity.ALERT,
      priority: NotificationPriority.HIGH,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatRecurringDue(data: {
    title: string;
    amount: number;
    dueDate: string | Date;
    daysUntilDue: number;
    categoryName?: string;
  }): FormattedNotificationContent {
    const dueStr = new Date(data.dueDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timing =
      data.daysUntilDue === 0
        ? 'is due today'
        : data.daysUntilDue === 1
          ? 'is due tomorrow'
          : `is due in ${data.daysUntilDue} days`;

    const title = `📅 Bill Due Reminder: ${data.title} (${timing})`;
    const message = `Upcoming recurring bill "${data.title}" for $${data.amount.toFixed(2)} ${timing} on ${dueStr}. Ensure sufficient account balance to prevent payment failure.`;
    const actionUrl = '/subscriptions';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-info">Recurring Payment</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">Upcoming Bill: ${data.title}</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Bill / Expense</span><span class="stat-val">${data.title}</span></div>
        <div class="stat-row"><span class="stat-label">Amount</span><span class="stat-val">$${data.amount.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Due Date</span><span class="stat-val">${dueStr}</span></div>
        ${data.categoryName ? `<div class="stat-row"><span class="stat-label">Category</span><span class="stat-val">${data.categoryName}</span></div>` : ''}
      </div>
      `,
      actionUrl,
      'View Recurring Bills',
    );

    return {
      title,
      message,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.MEDIUM,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatSubscriptionRenewal(data: {
    name: string;
    amount: number;
    renewalDate: string | Date;
    daysUntilRenewal: number;
    cycle?: string;
  }): FormattedNotificationContent {
    const renewStr = new Date(data.renewalDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timing =
      data.daysUntilRenewal === 0
        ? 'today'
        : data.daysUntilRenewal === 1
          ? 'tomorrow'
          : `in ${data.daysUntilRenewal} days`;

    const title = `🔄 Subscription Renewal: ${data.name}`;
    const message = `Your subscription to "${data.name}" ($${data.amount.toFixed(2)}) will automatically renew ${timing} on ${renewStr}. Review your active subscriptions to cancel if no longer needed.`;
    const actionUrl = '/subscriptions';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-info">Subscription Renewal</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">${data.name} Renewing Soon</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Subscription</span><span class="stat-val">${data.name}</span></div>
        <div class="stat-row"><span class="stat-label">Renewal Cost</span><span class="stat-val">$${data.amount.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Renewal Date</span><span class="stat-val">${renewStr}</span></div>
        ${data.cycle ? `<div class="stat-row"><span class="stat-label">Billing Cycle</span><span class="stat-val">${data.cycle}</span></div>` : ''}
      </div>
      `,
      actionUrl,
      'Manage Subscriptions',
    );

    return {
      title,
      message,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.MEDIUM,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatAnomalyDetected(data: {
    amount: number;
    description: string;
    severity: string;
    score: number;
    reason?: string;
  }): FormattedNotificationContent {
    const isCritical = data.score >= 0.85 || data.severity === 'CRITICAL';
    const title = `🔍 Unusual Activity Flagged: $${data.amount.toFixed(2)}`;
    const message = `Transaction of $${data.amount.toFixed(2)} ("${data.description}") deviates significantly from your typical spending pattern (Anomaly Score: ${data.score.toFixed(2)}). ${data.reason || 'Please verify this transaction.'}`;
    const actionUrl = '/anomalies';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge ${isCritical ? 'badge-critical' : 'badge-alert'}">Spending Anomaly</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">Unusual Spending Detected</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Description</span><span class="stat-val">${data.description}</span></div>
        <div class="stat-row"><span class="stat-label">Amount</span><span class="stat-val" style="color: #f43f5e;">$${data.amount.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Risk Severity</span><span class="stat-val">${data.severity}</span></div>
        <div class="stat-row"><span class="stat-label">Anomaly Score</span><span class="stat-val">${(data.score * 100).toFixed(0)}%</span></div>
      </div>
      `,
      actionUrl,
      'Review Anomaly',
    );

    return {
      title,
      message,
      severity: isCritical ? NotificationSeverity.CRITICAL : NotificationSeverity.ALERT,
      priority: isCritical ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatStockAlert(data: {
    symbol: string;
    alertType: string;
    threshold: number;
    currentPrice: number;
    percentChange?: number;
    notes?: string;
  }): FormattedNotificationContent {
    const changeText =
      data.percentChange !== undefined
        ? ` (${data.percentChange >= 0 ? '+' : ''}${data.percentChange.toFixed(2)}%)`
        : '';
    const title = `📈 Stock Alert: ${data.symbol} ${data.alertType.replace(/_/g, ' ')} $${data.threshold.toFixed(2)}`;
    const message = `${data.symbol} is currently trading at $${data.currentPrice.toFixed(2)}${changeText}, triggering your alert threshold of $${data.threshold.toFixed(2)}.`;
    const actionUrl = '/stocks';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-info">Market Alert</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">${data.symbol} Price Alert Triggered</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Ticker Symbol</span><span class="stat-val">${data.symbol}</span></div>
        <div class="stat-row"><span class="stat-label">Trigger Price</span><span class="stat-val" style="color: #10b981; font-size: 16px;">$${data.currentPrice.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Alert Condition</span><span class="stat-val">${data.alertType} $${data.threshold.toFixed(2)}</span></div>
        ${data.percentChange !== undefined ? `<div class="stat-row"><span class="stat-label">24h Change</span><span class="stat-val">${data.percentChange >= 0 ? '+' : ''}${data.percentChange.toFixed(2)}%</span></div>` : ''}
        ${data.notes ? `<div class="stat-row"><span class="stat-label">Alert Notes</span><span class="stat-val">${data.notes}</span></div>` : ''}
      </div>
      `,
      actionUrl,
      'View Stock Chart',
    );

    return {
      title,
      message,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.HIGH,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatPortfolioUpdate(data: {
    portfolioName: string;
    totalValue: number;
    dailyPnl: number;
    dailyPnlPercent: number;
  }): FormattedNotificationContent {
    const isGain = data.dailyPnl >= 0;
    const title = `💼 Daily Portfolio Summary: ${data.portfolioName}`;
    const message = `Your portfolio "${data.portfolioName}" is currently valued at $${data.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Daily performance: ${isGain ? '+' : ''}$${data.dailyPnl.toFixed(2)} (${isGain ? '+' : ''}${data.dailyPnlPercent.toFixed(2)}%).`;
    const actionUrl = '/portfolio';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-info">Portfolio Digest</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">${data.portfolioName} Daily Performance</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Total Portfolio Value</span><span class="stat-val" style="font-size: 18px; color: #10b981;">$${data.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        <div class="stat-row"><span class="stat-label">Daily P&L</span><span class="stat-val" style="color: ${isGain ? '#10b981' : '#f43f5e'}; font-weight: bold;">${isGain ? '+' : ''}$${data.dailyPnl.toFixed(2)} (${isGain ? '+' : ''}${data.dailyPnlPercent.toFixed(2)}%)</span></div>
      </div>
      `,
      actionUrl,
      'Open Portfolio',
    );

    return {
      title,
      message,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.LOW,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatMonthlyReport(data: {
    month: number;
    year: number;
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    summary?: string;
  }): FormattedNotificationContent {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthStr = monthNames[data.month - 1] || `Month ${data.month}`;
    const title = `📊 Monthly Financial Summary: ${monthStr} ${data.year}`;
    const savingsRate = data.totalIncome > 0 ? ((data.netSavings / data.totalIncome) * 100).toFixed(1) : '0.0';
    const message = `Your ${monthStr} ${data.year} financial report is ready. Total Income: $${data.totalIncome.toFixed(2)}, Total Expenses: $${data.totalExpense.toFixed(2)}, Net Savings: $${data.netSavings.toFixed(2)} (Savings Rate: ${savingsRate}%).`;
    const actionUrl = '/dashboard';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-info">Monthly Financial Report</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">${monthStr} ${data.year} Financial Overview</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${data.summary || message}</p>
      <div class="card">
        <div class="stat-row"><span class="stat-label">Total Inflow / Income</span><span class="stat-val" style="color: #10b981;">+$${data.totalIncome.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Total Outflow / Expenses</span><span class="stat-val" style="color: #f43f5e;">-$${data.totalExpense.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Net Savings</span><span class="stat-val" style="font-size: 16px; color: ${data.netSavings >= 0 ? '#10b981' : '#f43f5e'}; font-weight: bold;">$${data.netSavings.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Savings Rate</span><span class="stat-val">${savingsRate}%</span></div>
      </div>
      `,
      actionUrl,
      'View Full Analytics',
    );

    return {
      title,
      message,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.MEDIUM,
      actionUrl,
      htmlBody,
      metadata: data,
    };
  }

  public formatCustom(data: {
    title: string;
    message: string;
    type?: NotificationType;
    severity?: NotificationSeverity;
    priority?: NotificationPriority;
    actionUrl?: string;
  }): FormattedNotificationContent {
    const title = data.title;
    const message = data.message;
    const severity = data.severity || NotificationSeverity.INFO;
    const priority = data.priority || NotificationPriority.MEDIUM;
    const actionUrl = data.actionUrl || '';
    const htmlBody = this.wrapBaseHtml(
      title,
      `
      <span class="badge badge-info">${data.type || 'Notification'}</span>
      <h2 style="font-size: 18px; margin: 0 0 12px 0;">${title}</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${message}</p>
      `,
      actionUrl,
      'Open SmartFin AI',
    );

    return {
      title,
      message,
      severity,
      priority,
      actionUrl,
      htmlBody,
    };
  }
}

export const notificationTemplateService = NotificationTemplateService.getInstance();
