import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { MonthlyReportSnapshot, CompleteFinancialReportData } from './report-aggregator.service.js';
import { logger } from '../../utils/logger.js';

export class ReportPdfService {
  private static instance: ReportPdfService;
  private storageDir: string;

  private constructor() {
    this.storageDir = path.resolve(process.cwd(), 'storage', 'reports');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public static getInstance(): ReportPdfService {
    if (!ReportPdfService.instance) {
      ReportPdfService.instance = new ReportPdfService();
    }
    return ReportPdfService.instance;
  }

  /**
   * Generates a professional, multi-page vector PDF report and writes to storage
   */
  public async generatePdf(
    reportId: string,
    snapshot: MonthlyReportSnapshot,
  ): Promise<{ filePath: string; fileSizeBytes: number; buffer: Buffer }> {
    const filePath = path.join(this.storageDir, `report-${reportId}.pdf`);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          bufferPages: true,
          info: {
            Title: `SmartFin AI Report - ${snapshot.metadata.periodLabel}`,
            Author: 'SmartFin AI Intelligence Platform',
            Subject: 'Monthly Financial Intelligence Report',
            Keywords: 'Finance, Investment, Report, Analytics',
            CreationDate: new Date(),
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));

        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        const { metadata, executiveSummary, incomeSection, expenseSection } = snapshot;
        const cur = metadata.currency;

        // ================= PAGE 1: EXECUTIVE OVERVIEW =================
        this.renderHeader(doc, snapshot, 1);

        doc.fillColor('#0F172A').fontSize(22).font('Helvetica-Bold').text('MONTHLY FINANCIAL REPORT', 40, 75);
        doc.fillColor('#64748B').fontSize(10).font('Helvetica').text(
          `Reporting Period: ${snapshot.metadata.periodDisplay || snapshot.metadata.periodLabel}  •  Currency: ${cur}  •  Generated: ${new Date(snapshot.metadata.generatedAt).toLocaleDateString()}`,
          40,
          102,
        );

        // Scorecard Cards Grid (2x3)
        const startY = 125;
        const cardW = 165;
        const cardH = 65;

        // Card 1: Total Income
        this.renderScorecard(doc, 40, startY, cardW, cardH, 'TOTAL INCOME', `${cur} ${executiveSummary.totalIncome.toLocaleString()}`, '#10B981', `+${incomeSection.incomeChangePercent}% vs prior mo`);
        // Card 2: Total Expenses
        this.renderScorecard(doc, 215, startY, cardW, cardH, 'TOTAL EXPENSES', `${cur} ${executiveSummary.totalExpenses.toLocaleString()}`, '#F43F5E', `${expenseSection.expenseChangePercent >= 0 ? '+' : ''}${expenseSection.expenseChangePercent}% vs prior mo`);
        // Card 3: Net Savings
        const isSavingsPos = executiveSummary.savings >= 0;
        this.renderScorecard(doc, 390, startY, cardW, cardH, 'NET SAVINGS', `${cur} ${executiveSummary.savings.toLocaleString()}`, isSavingsPos ? '#10B981' : '#F43F5E', `Rate: ${executiveSummary.savingsRateFormatted}`);

        const row2Y = startY + 75;
        // Card 4: Monthly Burn Rate
        this.renderScorecard(doc, 40, row2Y, cardW, cardH, 'MONTHLY BURN RATE', `${cur} ${executiveSummary.monthlyBurnRate.toLocaleString()}`, '#6366F1', 'Operating Outflow');
        // Card 5: Net Worth
        this.renderScorecard(doc, 215, row2Y, cardW, cardH, 'NET WORTH', `${cur} ${executiveSummary.netWorth.toLocaleString()}`, '#0EA5E9', 'Assets minus Liabilities');
        // Card 6: Portfolio Value
        this.renderScorecard(doc, 390, row2Y, cardW, cardH, 'INVESTMENT PORTFOLIO', `${cur} ${executiveSummary.portfolioValue.toLocaleString()}`, '#8B5CF6', snapshot.portfolioSection.hasPortfolio ? `${snapshot.portfolioSection.holdingsCount} Assets` : 'No holdings');

        // Key Takeaway Callout Box
        const calloutY = row2Y + 85;
        doc.roundedRect(40, calloutY, 515, 60, 6).fillColor('#F1F5F9').fill();
        doc.rect(40, calloutY, 4, 60).fillColor('#10B981').fill();
        doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('Executive Summary Takeaway', 55, calloutY + 10);
        doc.fillColor('#334155').fontSize(9).font('Helvetica').text(executiveSummary.keyTakeaway, 55, calloutY + 28, { width: 485, lineGap: 3 });

        // Deterministic Insights Section
        const insightsY = calloutY + 75;
        doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Key Financial Observations', 40, insightsY);
        let currInsightY = insightsY + 20;

        for (const insight of executiveSummary.insights.slice(0, 4)) {
          doc.circle(46, currInsightY + 5, 2.5).fillColor('#10B981').fill();
          doc.fillColor('#334155').fontSize(9).font('Helvetica').text(insight, 56, currInsightY, { width: 490 });
          currInsightY += 24;
        }

        // ================= PAGE 2: CASH FLOW & CATEGORIES =================
        doc.addPage();
        this.renderHeader(doc, snapshot, 2);

        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Income & Expense Flow Analysis', 40, 75);

        // Comparison Table
        const flowTableY = 98;
        this.renderTableRow(doc, flowTableY, ['Metric', `Previous (${snapshot.incomeSection.previousMonthIncome ? 'Last Mo' : 'Prior'})`, `Current (${snapshot.metadata.periodLabel})`, 'Net Change', '% Change'], true);
        this.renderTableRow(doc, flowTableY + 22, ['Total Inflow (Income)', `${cur} ${incomeSection.previousMonthIncome.toLocaleString()}`, `${cur} ${incomeSection.totalIncome.toLocaleString()}`, `${cur} ${incomeSection.incomeChangeAmount.toLocaleString()}`, `${incomeSection.incomeChangePercent}%`]);
        this.renderTableRow(doc, flowTableY + 44, ['Total Outflow (Expenses)', `${cur} ${expenseSection.previousMonthExpenses.toLocaleString()}`, `${cur} ${expenseSection.totalExpenses.toLocaleString()}`, `${cur} ${expenseSection.expenseChangeAmount.toLocaleString()}`, `${expenseSection.expenseChangePercent}%`]);
        this.renderTableRow(doc, flowTableY + 66, ['Net Monthly Savings', `${cur} ${(incomeSection.previousMonthIncome - expenseSection.previousMonthExpenses).toLocaleString()}`, `${cur} ${executiveSummary.savings.toLocaleString()}`, `${cur} ${(executiveSummary.savings - (incomeSection.previousMonthIncome - expenseSection.previousMonthExpenses)).toLocaleString()}`, executiveSummary.savingsRateFormatted]);

        // Top Spending Categories
        const catY = flowTableY + 110;
        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Top Spending Categories Breakdown', 40, catY);

        let catRowY = catY + 24;
        this.renderTableRow(doc, catRowY, ['Category Name', 'Total Spent', '% of Outflow', 'Visual Share'], true);
        catRowY += 22;

        if (expenseSection.topCategories.length === 0) {
          doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('No categorical expense transactions recorded in this period.', 40, catRowY);
        } else {
          for (const cat of expenseSection.topCategories.slice(0, 6)) {
            // Draw text
            doc.fillColor('#1E293B').fontSize(9).font('Helvetica-Bold').text(cat.name, 45, catRowY + 5);
            doc.font('Helvetica').text(`${cur} ${cat.amount.toLocaleString()}`, 190, catRowY + 5);
            doc.text(`${cat.percentage.toFixed(1)}%`, 310, catRowY + 5);

            // Progress bar
            const barW = 120;
            const barFillW = Math.max(4, Math.min(barW, (cat.percentage / 100) * barW));
            doc.roundedRect(410, catRowY + 6, barW, 8, 3).fillColor('#E2E8F0').fill();
            doc.roundedRect(410, catRowY + 6, barFillW, 8, 3).fillColor('#10B981').fill();

            catRowY += 22;
          }
        }

        // ================= PAGE 3: LARGEST TRANSACTIONS & BILLS =================
        doc.addPage();
        this.renderHeader(doc, snapshot, 3);

        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Largest Period Transactions', 40, 75);

        let txY = 98;
        this.renderTableRow(doc, txY, ['Date', 'Description / Merchant', 'Category', 'Type', 'Amount'], true);
        txY += 22;

        if (snapshot.largestTransactions.length === 0) {
          doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('No transaction records found for this reporting period.', 40, txY);
          txY += 25;
        } else {
          for (const tx of snapshot.largestTransactions) {
            this.renderTableRow(doc, txY, [tx.date || '-', tx.description.slice(0, 24), tx.category, tx.type, `${cur} ${tx.amount.toLocaleString()}`]);
            txY += 20;
          }
        }

        // Recurring & Subscriptions Section
        const recY = txY + 25;
        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Recurring Outflows & Fixed Commitments', 40, recY);

        doc.fillColor('#475569').fontSize(9).font('Helvetica').text(
          `Active recurring payments: ${snapshot.recurringCommitments.activeRecurringCount} (${cur} ${snapshot.recurringCommitments.totalRecurringMonthly.toLocaleString()}/mo)  •  Active subscriptions: ${snapshot.recurringCommitments.activeSubscriptionCount} (${cur} ${snapshot.recurringCommitments.totalSubscriptionMonthly.toLocaleString()}/mo)`,
          40,
          recY + 20,
        );

        let recTableY = recY + 38;
        this.renderTableRow(doc, recTableY, ['Service / Payee', 'Amount', 'Billing Cycle', 'Next Expected Date', 'Commitment Type'], true);
        recTableY += 22;

        const billsToShow = snapshot.recurringCommitments.upcomingBills.slice(0, 5);
        if (billsToShow.length === 0) {
          doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('No recurring bills or active subscriptions configured.', 40, recTableY);
        } else {
          for (const bill of billsToShow) {
            this.renderTableRow(doc, recTableY, [bill.name.slice(0, 22), `${cur} ${bill.amount.toLocaleString()}`, bill.frequency, bill.nextExpectedDate || 'Scheduled', bill.type]);
            recTableY += 20;
          }
        }

        // Financial Goals Progress
        if (snapshot.financialGoals.activeGoals.length > 0) {
          const goalY = recTableY + 20;
          doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Active Financial Goal Milestones', 40, goalY);
          let gY = goalY + 22;
          this.renderTableRow(doc, gY, ['Goal Name', 'Target Amount', 'Current Saved', 'Progress', 'Remaining Gap'], true);
          gY += 22;
          for (const g of snapshot.financialGoals.activeGoals.slice(0, 4)) {
            this.renderTableRow(doc, gY, [g.name.slice(0, 22), `${cur} ${g.targetAmount.toLocaleString()}`, `${cur} ${g.currentAmount.toLocaleString()}`, `${g.progressPercent}%`, `${cur} ${g.remainingAmount.toLocaleString()}`]);
            gY += 20;
          }
        }

        // ================= PAGE 4: PORTFOLIO & WEALTH =================
        doc.addPage();
        this.renderHeader(doc, snapshot, 4);

        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Balance Sheet & Investment Portfolio', 40, 75);

        // Net worth summary
        const nwY = 98;
        this.renderTableRow(doc, nwY, ['Total Assets', 'Total Liabilities', 'Current Net Worth', 'Net Worth Movement', '% Movement'], true);
        this.renderTableRow(doc, nwY + 22, [`${cur} ${snapshot.netWorthSection.totalAssets.toLocaleString()}`, `${cur} ${snapshot.netWorthSection.totalLiabilities.toLocaleString()}`, `${cur} ${snapshot.netWorthSection.currentNetWorth.toLocaleString()}`, `${cur} ${snapshot.netWorthSection.netWorthChange.toLocaleString()}`, `${snapshot.netWorthSection.netWorthChangePercent}%`]);

        // Holdings Table
        const portY = nwY + 65;
        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Investment Portfolio Holdings', 40, portY);

        if (!snapshot.portfolioSection.hasPortfolio || snapshot.portfolioSection.holdings.length === 0) {
          doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('No investment portfolio or stock holdings currently linked to this account.', 40, portY + 22);
        } else {
          doc.fillColor('#475569').fontSize(9).font('Helvetica').text(
            `Total Invested: ${cur} ${snapshot.portfolioSection.totalInvested.toLocaleString()}  •  Current Value: ${cur} ${snapshot.portfolioSection.currentMarketValue.toLocaleString()}  •  Unrealized P&L: ${cur} ${snapshot.portfolioSection.unrealizedPnL.toLocaleString()} (${snapshot.portfolioSection.unrealizedPnLPercent}%)`,
            40,
            portY + 20,
          );

          let holdY = portY + 36;
          this.renderTableRow(doc, holdY, ['Symbol', 'Company', 'Shares', 'Avg Price', 'Current Price', 'Market Value', 'Unrealized P&L'], true);
          holdY += 22;

          for (const h of snapshot.portfolioSection.holdings.slice(0, 6)) {
            const pnlStr = `${h.pnl >= 0 ? '+' : ''}${cur} ${h.pnl.toLocaleString()} (${h.pnlPercent}%)`;
            this.renderTableRow(doc, holdY, [h.symbol, h.companyName.slice(0, 16), String(h.shares), `${cur} ${h.avgPrice.toFixed(2)}`, `${cur} ${h.currentPrice.toFixed(2)}`, `${cur} ${h.marketValue.toLocaleString()}`, pnlStr]);
            holdY += 20;
          }
        }

        // Watchlist
        if (snapshot.watchlistSection.symbols.length > 0) {
          const wlY = portY + 180;
          doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Tracked Stock Watchlist', 40, wlY);
          let wRowY = wlY + 22;
          this.renderTableRow(doc, wRowY, ['Ticker Symbol', 'Current Market Price', 'Daily Change', 'Daily Change %'], true);
          wRowY += 22;
          for (const s of snapshot.watchlistSection.symbols.slice(0, 5)) {
            this.renderTableRow(doc, wRowY, [s.symbol, s.price ? `${cur} ${s.price.toFixed(2)}` : 'Market data unavailable', s.change ? `${cur} ${s.change.toFixed(2)}` : '-', s.changePercent ? `${s.changePercent.toFixed(2)}%` : '-']);
            wRowY += 20;
          }
        }

        // ================= PAGE 5: AI FORECASTS & STOCK MODEL PREDICTIONS =================
        doc.addPage();
        this.renderHeader(doc, snapshot, 5);

        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('Machine Learning Forecasts & Stock Models', 40, 75);

        // Expense & Cash Flow Forecast Section
        const fcY = 98;
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Cash Flow & Outflow Forecasts (Model Estimates)', 40, fcY);
        doc.fillColor('#64748B').fontSize(8).font('Helvetica').text('Forecast — Model Estimate based on historical seasonal trends.', 40, fcY + 14);

        if (snapshot.forecastSection.available && snapshot.forecastSection.expenseForecast) {
          const ef = snapshot.forecastSection.expenseForecast;
          const cf = snapshot.forecastSection.cashFlowForecast;

          let fcRowY = fcY + 30;
          this.renderTableRow(doc, fcRowY, ['Forecast Metric', 'Projected Value', 'Algorithm Model', 'Confidence Score'], true);
          fcRowY += 22;
          this.renderTableRow(doc, fcRowY, ['Next Month Projected Expenses', `${cur} ${ef.nextMonthEstimatedExpenses.toLocaleString()}`, ef.modelUsed, `${(ef.confidenceScore * 100).toFixed(0)}%`]);
          if (cf) {
            this.renderTableRow(doc, fcRowY + 20, ['Projected Net Cash Flow', `${cur} ${cf.projectedNetFlow.toLocaleString()}`, 'ARIMA / Exponential Smoothing', 'Optimal']);
          }
        } else {
          doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('Cash flow forecast model unavailable for this reporting period.', 40, fcY + 32);
        }

        // Stock Prediction Models Section
        const spY = fcY + 85;
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Stock Market Model Forecasts (Estimates Only)', 40, spY);
        doc.fillColor('#E11D48').fontSize(8).font('Helvetica-Bold').text(
          'DISCLAIMER: Forecasts are machine learning statistical estimates and do not guarantee future returns or constitute financial advice.',
          40,
          spY + 14,
        );

        if (snapshot.stockModelForecasts.available && snapshot.stockModelForecasts.forecasts.length > 0) {
          let spRowY = spY + 30;
          this.renderTableRow(doc, spRowY, ['Ticker', 'Horizon', 'Current', 'Target Estimate', 'Model / Ver', 'Validation RMSE'], true);
          spRowY += 22;

          for (const f of snapshot.stockModelForecasts.forecasts) {
            this.renderTableRow(doc, spRowY, [f.symbol, `${f.predictionHorizonDays} Days`, `${cur} ${f.currentPrice.toFixed(2)}`, `${cur} ${f.predictedPrice.toFixed(2)} (${f.predictedReturnPercent > 0 ? '+' : ''}${f.predictedReturnPercent.toFixed(1)}%)`, `${f.modelName} ${f.modelVersion}`, `${f.historicalRmse.toFixed(4)}`]);
            spRowY += 20;
          }
        } else {
          doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('No stock model forecasts available for this reporting period.', 40, spY + 32);
        }

        // Unusual Spending Anomalies Section
        const anomY = spY + 115;
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Unusual Activity & Spending Anomalies', 40, anomY);
        doc.fillColor('#64748B').fontSize(8).font('Helvetica').text('AI anomaly detector flags statistical deviations from your historical behavior. Does not imply fraud.', 40, anomY + 14);

        if (snapshot.anomalySection.unusualSpendingCount > 0) {
          let aRowY = anomY + 30;
          this.renderTableRow(doc, aRowY, ['Date', 'Merchant / Payee', 'Amount', 'Risk Severity', 'Deviation Explanation'], true);
          aRowY += 22;

          for (const a of snapshot.anomalySection.events.slice(0, 4)) {
            this.renderTableRow(doc, aRowY, [a.date || '-', a.merchant.slice(0, 20), `${cur} ${a.amount.toLocaleString()}`, a.severity, a.reason.slice(0, 30)]);
            aRowY += 20;
          }
        } else {
          doc.fillColor('#10B981').fontSize(9).font('Helvetica').text('✓ Zero unusual spending anomalies detected during this reporting period.', 40, anomY + 32);
        }

        // Finalize document page numbers and footers
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text(
            `SmartFin AI Financial Intelligence Platform  •  Strictly Confidential  •  Page ${i + 1} of ${range.count}`,
            40,
            800,
            { align: 'center', width: 515 },
          );
        }

        doc.end();

        writeStream.on('finish', () => {
          const finalBuffer = Buffer.concat(buffers);
          logger.info({ filePath, sizeBytes: finalBuffer.length }, '[ReportPdfService] PDF generated successfully');
          resolve({ filePath, fileSizeBytes: finalBuffer.length, buffer: finalBuffer });
        });

        writeStream.on('error', (err) => {
          logger.error({ err }, '[ReportPdfService] Write stream error');
          reject(err);
        });
      } catch (err) {
        logger.error({ err }, '[ReportPdfService] PDF creation error');
        reject(err);
      }
    });
  }

  private renderHeader(doc: typeof PDFDocument, snapshot: MonthlyReportSnapshot, pageNum: number): void {
    doc.fillColor('#10B981').fontSize(9).font('Helvetica-Bold').text('SMARTFIN AI', 40, 30);
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica').text(
      `Financial Intelligence Report  |  ${snapshot.metadata.periodLabel}`,
      115,
      31,
    );
    doc.fillColor('#CBD5E1').fontSize(8).font('Helvetica').text(`Page ${pageNum}`, 520, 31, { align: 'right' });
    doc.moveTo(40, 45).lineTo(555, 45).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
  }

  private renderScorecard(
    doc: typeof PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    accentColor: string,
    subtext: string,
  ): void {
    doc.roundedRect(x, y, w, h, 6).fillColor('#F8FAFC').strokeColor('#E2E8F0').lineWidth(0.75).fillAndStroke();
    doc.roundedRect(x, y, 4, h, 2).fillColor(accentColor).fill();
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text(label, x + 12, y + 10);
    doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text(value, x + 12, y + 24);
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(subtext, x + 12, y + 46);
  }

  private renderTableRow(
    doc: typeof PDFDocument,
    y: number,
    cols: string[],
    isHeader = false,
  ): void {
    const colWidth = 515 / cols.length;

    if (isHeader) {
      doc.rect(40, y, 515, 20).fillColor('#F1F5F9').fill();
    } else {
      doc.rect(40, y, 515, 20).fillColor(y % 40 === 0 ? '#FAFAFA' : '#FFFFFF').fill();
      doc.moveTo(40, y + 20).lineTo(555, y + 20).strokeColor('#F1F5F9').lineWidth(0.5).stroke();
    }

    cols.forEach((col, idx) => {
      const colX = 45 + idx * colWidth;
      doc
        .fillColor(isHeader ? '#475569' : '#1E293B')
        .fontSize(isHeader ? 7.5 : 8)
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .text(col, colX, y + 6, { width: colWidth - 8, lineBreak: false, ellipsis: true });
    });
  }

  /**
   * Generates a comprehensive, multi-module, paginated Complete Financial Report PDF
   */
  public async generateCompleteReportPdf(
    data: CompleteFinancialReportData,
  ): Promise<{ filePath: string; fileSizeBytes: number; buffer: Buffer }> {
    const filename = `SMARTFIN_Financial_Report_${data.metadata.fromDateStr}_to_${data.metadata.toDateStr}.pdf`;
    const filePath = path.join(this.storageDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          bufferPages: true,
          info: {
            Title: `SMARTFIN AI Complete Financial Report - ${data.metadata.periodDisplay}`,
            Author: 'SmartFin AI Intelligence Platform',
            Subject: 'Complete Financial Report',
            Keywords: 'Financial Report, SmartFin AI, Statement, Wealth, Transactions',
            CreationDate: new Date(),
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));

        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // Register font with Rupee glyph support if available
        let regFont = 'Helvetica';
        let boldFont = 'Helvetica-Bold';
        const winReg = 'C:\\Windows\\Fonts\\segoeui.ttf';
        const winBold = 'C:\\Windows\\Fonts\\segoeuib.ttf';
        if (fs.existsSync(winReg) && fs.existsSync(winBold)) {
          try {
            doc.registerFont('AppFont', winReg);
            doc.registerFont('AppFont-Bold', winBold);
            regFont = 'AppFont';
            boldFont = 'AppFont-Bold';
          } catch {
            // fallback
          }
        }

        const formatINR = (val: number | null | undefined): string => {
          if (val === null || val === undefined || isNaN(val)) return '₹0.00';
          const isNeg = val < 0;
          const absVal = Math.abs(val);
          const formatted = new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(absVal);
          return `${isNeg ? '-' : ''}₹${formatted}`;
        };

        let curY = 40;

        const renderRunningHeader = () => {
          doc.fillColor('#10B981').fontSize(9).font(boldFont).text('SMARTFIN AI', 40, 26);
          doc.fillColor('#94A3B8').fontSize(8).font(regFont).text(
            `Complete Financial Report  |  ${data.metadata.periodDisplay}`,
            115,
            27,
          );
          doc.moveTo(40, 42).lineTo(555, 42).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
        };

        const ensureSpace = (neededHeight: number) => {
          if (curY + neededHeight > 755) {
            doc.addPage();
            renderRunningHeader();
            curY = 55;
          }
        };

        const renderSectionHeader = (title: string, subtitle?: string) => {
          ensureSpace(subtitle ? 42 : 32);
          doc.rect(40, curY, 3, 13).fillColor('#10B981').fill();
          doc.fillColor('#0F172A').fontSize(11).font(boldFont).text(title, 48, curY);
          curY += 16;
          if (subtitle) {
            doc.fillColor('#64748B').fontSize(7.5).font(regFont).text(subtitle, 48, curY, { width: 505 });
            curY += 15;
          }
        };

        const renderTable = (
          headers: string[],
          widths: number[],
          rows: string[][],
          alignments: Array<'left' | 'right' | 'center'> = [],
        ) => {
          const drawTableHeader = () => {
            doc.rect(40, curY, 515, 18).fillColor('#F1F5F9').fill();
            let xOffset = 40;
            headers.forEach((h, i) => {
              const w = widths[i];
              const align = alignments[i] || 'left';
              doc.fillColor('#475569').fontSize(7).font(boldFont).text(
                h,
                align === 'right' ? xOffset : xOffset + 4,
                curY + 5,
                { width: align === 'right' ? w - 4 : w - 8, align, lineBreak: false, ellipsis: true },
              );
              xOffset += w;
            });
            curY += 18;
          };

          ensureSpace(22 + (rows.length > 0 ? 18 : 0));
          drawTableHeader();

          if (rows.length === 0) {
            doc.fillColor('#94A3B8').fontSize(8).font(regFont).text('No records available.', 45, curY + 4);
            curY += 18;
            return;
          }

          rows.forEach((row, rowIdx) => {
            if (curY + 18 > 755) {
              doc.addPage();
              renderRunningHeader();
              curY = 55;
              drawTableHeader();
            }

            const isEven = rowIdx % 2 === 0;
            doc.rect(40, curY, 515, 18).fillColor(isEven ? '#FFFFFF' : '#F8FAFC').fill();
            doc.moveTo(40, curY + 18).lineTo(555, curY + 18).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

            let xOffset = 40;
            row.forEach((cell, i) => {
              const w = widths[i];
              const align = alignments[i] || 'left';
              doc.fillColor('#1E293B').fontSize(7.5).font(regFont).text(
                cell,
                align === 'right' ? xOffset : xOffset + 4,
                curY + 5,
                { width: align === 'right' ? w - 4 : w - 8, align, lineBreak: false, ellipsis: true },
              );
              xOffset += w;
            });
            curY += 18;
          });

          curY += 10;
        };

        // ================= PAGE 1: COVER & EXECUTIVE SUMMARY =================
        // Top Branding
        doc.fillColor('#10B981').fontSize(16).font(boldFont).text('SMARTFIN AI', 40, curY);
        doc.fillColor('#0F172A').fontSize(13).font(boldFont).text('COMPLETE FINANCIAL REPORT', 40, curY + 20);
        doc.fillColor('#64748B').fontSize(8.5).font(regFont).text(
          `Reporting Period: ${data.metadata.periodDisplay}`,
          40,
          curY + 38,
        );

        // Metadata box on top right
        doc.roundedRect(330, curY, 225, 52, 4).fillColor('#F8FAFC').strokeColor('#E2E8F0').lineWidth(0.5).fillAndStroke();
        doc.fillColor('#475569').fontSize(7.5).font(boldFont).text('CLIENT STATEMENT METADATA', 340, curY + 7);
        doc.fillColor('#1E293B').fontSize(7.5).font(regFont).text(`User: ${data.metadata.userName}`, 340, curY + 19);
        doc.text(`Generated: ${data.metadata.generatedAt}`, 340, curY + 29);
        doc.text(`Timezone: ${data.metadata.timezone}  •  Currency: ${data.metadata.currency}`, 340, curY + 39);

        curY += 62;
        doc.moveTo(40, curY).lineTo(555, curY).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
        curY += 12;

        // Executive Financial Summary
        renderSectionHeader('1. EXECUTIVE FINANCIAL SUMMARY');

        const cardW = 165;
        const cardH = 50;
        const row1Y = curY;

        // Scorecard helper
        const renderMiniScorecard = (x: number, y: number, label: string, val: string, color: string, sub: string) => {
          doc.roundedRect(x, y, cardW, cardH, 5).fillColor('#F8FAFC').strokeColor('#E2E8F0').lineWidth(0.5).fillAndStroke();
          doc.roundedRect(x, y, 3, cardH, 2).fillColor(color).fill();
          doc.fillColor('#64748B').fontSize(7).font(boldFont).text(label, x + 10, y + 8);
          doc.fillColor('#0F172A').fontSize(11).font(boldFont).text(val, x + 10, y + 20);
          doc.fillColor('#64748B').fontSize(7).font(regFont).text(sub, x + 10, y + 36);
        };

        renderMiniScorecard(40, row1Y, 'TOTAL INCOME', formatINR(data.summary.totalIncome), '#10B981', `${data.incomeAnalysis.count} inflow transactions`);
        renderMiniScorecard(215, row1Y, 'TOTAL EXPENSES', formatINR(data.summary.totalExpenses), '#F43F5E', `${data.expenseAnalysis.count} outflow transactions`);
        renderMiniScorecard(390, row1Y, 'NET SAVINGS', formatINR(data.summary.netSavings), data.summary.netSavings >= 0 ? '#10B981' : '#F43F5E', `Savings Rate: ${data.summary.savingsRateDisplay}`);

        const row2Y = row1Y + 58;
        renderMiniScorecard(40, row2Y, 'TRANSACTIONS COUNT', `${data.summary.transactionCount} records`, '#6366F1', 'In date range');
        renderMiniScorecard(215, row2Y, 'LARGEST EXPENSE', formatINR(data.summary.largestExpense), '#D97706', 'Peak outflow');
        renderMiniScorecard(390, row2Y, 'AVERAGE TRANSACTION', formatINR(data.summary.averageTransaction), '#0EA5E9', `Avg Exp: ${formatINR(data.summary.averageExpense)}`);

        curY = row2Y + 60;

        // Takeaway callout
        doc.roundedRect(40, curY, 515, 36, 4).fillColor('#F1F5F9').fill();
        doc.rect(40, curY, 3, 36).fillColor('#10B981').fill();
        doc.fillColor('#0F172A').fontSize(7.5).font(boldFont).text('Executive Cash Flow Observation', 50, curY + 7);
        const takeaway = `During ${data.metadata.periodDisplay}, total income amounted to ${formatINR(data.summary.totalIncome)} and total expenses amounted to ${formatINR(data.summary.totalExpenses)}, resulting in a net cash savings of ${formatINR(data.summary.netSavings)} (savings rate: ${data.summary.savingsRateDisplay}).`;
        doc.fillColor('#334155').fontSize(7).font(regFont).text(takeaway, 50, curY + 18, { width: 495 });
        curY += 46;

        // ================= SECTION 2: TRANSACTIONS RECORD =================
        renderSectionHeader(
          '2. COMPLETE TRANSACTIONS RECORD',
          `Complete listing of all ${data.transactions.length} transactions recorded between ${data.metadata.fromDateStr} and ${data.metadata.toDateStr}`,
        );

        if (data.transactions.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No transactions were recorded during the selected reporting period.', 40, curY);
          curY += 20;
        } else {
          const txHeaders = ['Date', 'Description', 'Merchant', 'Category', 'Type', 'Amount', 'Payment Method'];
          const txWidths = [60, 115, 80, 75, 55, 65, 65];
          const txAligns: Array<'left' | 'right' | 'center'> = ['left', 'left', 'left', 'left', 'center', 'right', 'left'];
          const txRows = data.transactions.map((t) => [
            t.date,
            t.description.length > 25 ? t.description.slice(0, 23) + '..' : t.description,
            t.merchant.length > 18 ? t.merchant.slice(0, 16) + '..' : t.merchant,
            t.category,
            t.type,
            formatINR(t.amount),
            t.paymentMethod,
          ]);
          renderTable(txHeaders, txWidths, txRows, txAligns);
        }

        // ================= SECTION 3: INCOME ANALYSIS =================
        renderSectionHeader(
          '3. INCOME ANALYSIS',
          `Total Income: ${formatINR(data.incomeAnalysis.totalIncome)}  •  Count: ${data.incomeAnalysis.count}  •  Average Income: ${formatINR(data.incomeAnalysis.averageIncome)}  •  Largest Income: ${formatINR(data.incomeAnalysis.largestIncome)}`,
        );

        if (data.incomeAnalysis.byCategory.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No income transactions recorded during this reporting period.', 40, curY);
          curY += 20;
        } else {
          const incHeaders = ['Income Category', 'Transactions', 'Total Amount', '% Share of Income'];
          const incWidths = [185, 95, 120, 115];
          const incAligns: Array<'left' | 'right' | 'center'> = ['left', 'center', 'right', 'right'];
          const incRows = data.incomeAnalysis.byCategory.map((c) => [
            c.category,
            String(c.count),
            formatINR(c.amount),
            `${c.percentage.toFixed(1)}%`,
          ]);
          renderTable(incHeaders, incWidths, incRows, incAligns);
        }

        // ================= SECTION 4: EXPENSE ANALYSIS =================
        renderSectionHeader(
          '4. EXPENSE ANALYSIS',
          `Total Expenses: ${formatINR(data.expenseAnalysis.totalExpenses)}  •  Count: ${data.expenseAnalysis.count}  •  Average Expense: ${formatINR(data.expenseAnalysis.averageExpense)}  •  Largest Expense: ${formatINR(data.expenseAnalysis.largestExpense)}`,
        );

        if (data.expenseAnalysis.byCategory.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No expense transactions recorded during this reporting period.', 40, curY);
          curY += 20;
        } else {
          const expHeaders = ['Expense Category', 'Transactions', 'Total Amount', '% Share of Outflow'];
          const expWidths = [185, 95, 120, 115];
          const expAligns: Array<'left' | 'right' | 'center'> = ['left', 'center', 'right', 'right'];
          const expRows = data.expenseAnalysis.byCategory.map((c) => [
            c.category,
            String(c.count),
            formatINR(c.amount),
            `${c.percentage.toFixed(1)}%`,
          ]);
          renderTable(expHeaders, expWidths, expRows, expAligns);
        }

        // ================= SECTION 5: CATEGORY BREAKDOWN =================
        renderSectionHeader(
          '5. CATEGORY BREAKDOWN',
          'Consolidated category-wise breakdown of financial activity across all recorded categories',
        );

        if (data.categoryBreakdown.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No categorical transactions recorded in this reporting period.', 40, curY);
          curY += 20;
        } else {
          const catHeaders = ['Category Name', 'Flow Type', 'Transactions', 'Total Amount', '% Relative Share'];
          const catWidths = [165, 80, 80, 100, 90];
          const catAligns: Array<'left' | 'right' | 'center'> = ['left', 'center', 'center', 'right', 'right'];
          const catRows = data.categoryBreakdown.map((c) => [
            c.category,
            c.type,
            String(c.count),
            formatINR(c.amount),
            `${c.percentage.toFixed(1)}%`,
          ]);
          renderTable(catHeaders, catWidths, catRows, catAligns);
        }

        // ================= SECTION 6: BUDGETS =================
        renderSectionHeader(
          '6. BUDGET ALLOCATIONS & UTILIZATION',
          'Budget utilization evaluation for spending thresholds configured in your account',
        );

        if (!data.budgets.available || data.budgets.records.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No budget records available for the selected period.', 40, curY);
          curY += 20;
        } else {
          const bHeaders = ['Budget Name', 'Category', 'Budget Limit', 'Spent', 'Remaining', 'Utilization %', 'Status'];
          const bWidths = [90, 85, 70, 70, 70, 65, 65];
          const bAligns: Array<'left' | 'right' | 'center'> = ['left', 'left', 'right', 'right', 'right', 'right', 'center'];
          const bRows = data.budgets.records.map((b) => [
            b.name,
            b.category,
            formatINR(b.limit),
            formatINR(b.spent),
            formatINR(b.remaining),
            `${b.utilizationPercent.toFixed(1)}%`,
            b.status,
          ]);
          renderTable(bHeaders, bWidths, bRows, bAligns);
        }

        // ================= SECTION 7: PORTFOLIO & INVESTMENTS =================
        renderSectionHeader(
          '7. INVESTMENT PORTFOLIO & HOLDINGS',
          `Current Portfolio Snapshot as of ${data.metadata.generatedAt}  •  Total Invested: ${formatINR(data.portfolio.totalInvested)}  •  Current Value: ${formatINR(data.portfolio.currentValue)}  •  Unrealized P&L: ${data.portfolio.unrealizedPnL >= 0 ? '+' : ''}${formatINR(data.portfolio.unrealizedPnL)} (${data.portfolio.unrealizedPnLPercent}%)`,
        );

        if (!data.portfolio.available || data.portfolio.holdings.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No investment portfolio or stock holdings currently linked to this account.', 40, curY);
          curY += 20;
        } else {
          const portHeaders = ['Symbol', 'Quantity', 'Avg Buy Price', 'Current Price', 'Invested Amount', 'Market Value', 'P&L / Return'];
          const portWidths = [65, 55, 75, 75, 80, 80, 85];
          const portAligns: Array<'left' | 'right' | 'center'> = ['left', 'right', 'right', 'right', 'right', 'right', 'right'];
          const portRows = data.portfolio.holdings.map((h) => [
            h.symbol,
            String(h.quantity),
            formatINR(h.avgBuyPrice),
            formatINR(h.currentPrice),
            formatINR(h.investedAmount),
            formatINR(h.marketValue),
            `${h.pnl >= 0 ? '+' : ''}${formatINR(h.pnl)} (${h.pnlPercent.toFixed(1)}%)`,
          ]);
          renderTable(portHeaders, portWidths, portRows, portAligns);
        }

        // ================= SECTION 8: NET WORTH STATEMENT =================
        renderSectionHeader(
          '8. BALANCE SHEET & NET WORTH STATEMENT',
          `Current Net Worth Snapshot as of ${data.metadata.generatedAt}  •  Total Assets: ${formatINR(data.netWorth.totalAssets)}  •  Total Liabilities: ${formatINR(data.netWorth.totalLiabilities)}  •  Net Worth: ${formatINR(data.netWorth.netWorth)}`,
        );

        const nwHeaders = ['Asset Category', 'Asset Value', 'Liability Category', 'Liability Balance'];
        const nwWidths = [140, 115, 145, 115];
        const nwAligns: Array<'left' | 'right' | 'center'> = ['left', 'right', 'left', 'right'];
        const nwRows = [
          ['Cash & Bank Accounts', formatINR(data.netWorth.assetBreakdown.cash), 'Loans (Student, Mortgage, Personal)', formatINR(data.netWorth.liabilityBreakdown.loans)],
          ['Investments & Securities', formatINR(data.netWorth.assetBreakdown.investments), 'Credit Card Debt', formatINR(data.netWorth.liabilityBreakdown.creditCardDebt)],
          ['Other Real Assets', formatINR(data.netWorth.assetBreakdown.otherAssets), 'Other Liabilities', formatINR(data.netWorth.liabilityBreakdown.otherLiabilities)],
          ['TOTAL ASSETS', formatINR(data.netWorth.totalAssets), 'TOTAL LIABILITIES', formatINR(data.netWorth.totalLiabilities)],
          ['NET WORTH (Assets minus Liabilities)', formatINR(data.netWorth.netWorth), '', ''],
        ];
        renderTable(nwHeaders, nwWidths, nwRows, nwAligns);

        // ================= SECTION 9: FINANCIAL GOALS =================
        renderSectionHeader(
          '9. FINANCIAL GOAL PROGRESS',
          'Target savings milestones and progress towards stated financial objectives',
        );

        if (!data.goals.available || data.goals.records.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No financial goals available.', 40, curY);
          curY += 20;
        } else {
          const gHeaders = ['Goal Title', 'Target Amount', 'Current Saved', 'Remaining Gap', 'Progress %', 'Target Date', 'Status'];
          const gWidths = [105, 75, 75, 75, 60, 65, 60];
          const gAligns: Array<'left' | 'right' | 'center'> = ['left', 'right', 'right', 'right', 'right', 'center', 'center'];
          const gRows = data.goals.records.map((g) => [
            g.title,
            formatINR(g.targetAmount),
            formatINR(g.currentAmount),
            formatINR(g.remainingAmount),
            `${g.progressPercent.toFixed(1)}%`,
            g.targetDate,
            g.status,
          ]);
          renderTable(gHeaders, gWidths, gRows, gAligns);
        }

        // ================= SECTION 10: SUBSCRIPTIONS =================
        renderSectionHeader(
          '10. SUBSCRIPTIONS & RECURRING OUTFLOWS',
          `Active Subscriptions  •  Monthly Commitment: ${formatINR(data.subscriptions.totalMonthlyCost)}/mo  •  Estimated Annual: ${formatINR(data.subscriptions.estimatedAnnualCost)}/yr`,
        );

        if (!data.subscriptions.available || data.subscriptions.records.length === 0) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No subscription records available.', 40, curY);
          curY += 20;
        } else {
          const subHeaders = ['Subscription Service', 'Amount', 'Billing Cycle', 'Next Expected Date', 'Status'];
          const subWidths = [140, 95, 95, 95, 90];
          const subAligns: Array<'left' | 'right' | 'center'> = ['left', 'right', 'center', 'center', 'center'];
          const subRows = data.subscriptions.records.map((s) => [
            s.name,
            formatINR(s.amount),
            s.billingCycle,
            s.nextBillingDate,
            s.status,
          ]);
          renderTable(subHeaders, subWidths, subRows, subAligns);
        }

        // ================= SECTION 11: FORECASTING =================
        renderSectionHeader(
          '11. FINANCIAL FORECASTING (MODEL ESTIMATES)',
          'Machine learning projections of estimated future cash outflows (Estimates only, not actual expenses)',
        );

        if (!data.forecasting.available) {
          doc.fillColor('#64748B').fontSize(8.5).font(regFont).text('No financial forecasts available for this reporting period.', 40, curY);
          curY += 20;
        } else {
          const fcHeaders = ['Forecast Metric', 'Projected Value', 'Algorithm Model', 'Confidence Score'];
          const fcWidths = [160, 120, 135, 100];
          const fcAligns: Array<'left' | 'right' | 'center'> = ['left', 'right', 'left', 'center'];
          const fcRows = [
            [
              'Projected Next Month Expenses',
              data.forecasting.projectedExpenses ? formatINR(data.forecasting.projectedExpenses) : 'N/A',
              data.forecasting.modelUsed || 'Seasonal Holt-Winters / ARIMA',
              data.forecasting.confidenceScore ? `${(data.forecasting.confidenceScore * 100).toFixed(0)}%` : 'Optimal',
            ],
          ];
          if (data.forecasting.projectedCashFlow !== undefined) {
            fcRows.push([
              'Projected Net Cash Flow',
              formatINR(data.forecasting.projectedCashFlow),
              'Cash Flow Horizon Model',
              'Optimal',
            ]);
          }
          renderTable(fcHeaders, fcWidths, fcRows, fcAligns);
        }

        // ================= SECTION 12: ANOMALIES =================
        renderSectionHeader(
          '12. FINANCIAL ANOMALY DETECTION',
          'Automated isolation of statistical deviations evaluating spending volatility against your personal profile',
        );

        if (!data.anomalies.available || data.anomalies.records.length === 0) {
          doc.fillColor('#10B981').fontSize(8.5).font(regFont).text('✓ Zero unusual spending anomalies detected during the selected reporting period.', 40, curY);
          curY += 20;
        } else {
          const anomHeaders = ['Date', 'Merchant / Payee', 'Amount', 'Severity', 'Explanation'];
          const anomWidths = [70, 110, 75, 65, 195];
          const anomAligns: Array<'left' | 'right' | 'center'> = ['left', 'left', 'right', 'center', 'left'];
          const anomRows = data.anomalies.records.map((a) => [
            a.date,
            a.merchant,
            formatINR(a.amount),
            a.severity,
            a.reason,
          ]);
          renderTable(anomHeaders, anomWidths, anomRows, anomAligns);
        }

        // ================= SECTION 13: DAILY SPENDING TREND =================
        if (data.dailySpendingTrend.length > 0) {
          renderSectionHeader(
            '13. DAILY SPENDING SCHEDULE',
            'Chronological daily expenditure aggregation for transactions in this period',
          );

          const dailyHeaders = ['Date', 'Transactions Count', 'Daily Total Spent'];
          const dailyWidths = [170, 170, 175];
          const dailyAligns: Array<'left' | 'right' | 'center'> = ['left', 'center', 'right'];
          const dailyRows = data.dailySpendingTrend.map((d) => [
            d.date,
            `${d.count} transactions`,
            formatINR(d.amount),
          ]);
          renderTable(dailyHeaders, dailyWidths, dailyRows, dailyAligns);
        }

        // ================= POST-PROCESSING: PAGE NUMBERS & FOOTERS =================
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.moveTo(40, 795).lineTo(555, 795).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
          doc.fillColor('#94A3B8').fontSize(7.5).font(regFont).text(
            `SMARTFIN AI Complete Financial Report  •  Strictly Confidential  •  Page ${i + 1} of ${range.count}`,
            40,
            803,
            { align: 'center', width: 515 },
          );
        }

        doc.end();

        writeStream.on('finish', () => {
          const finalBuffer = Buffer.concat(buffers);
          logger.info(
            { filePath, sizeBytes: finalBuffer.length, pages: range.count },
            '[ReportPdfService] Complete Financial Report PDF generated successfully',
          );
          resolve({ filePath, fileSizeBytes: finalBuffer.length, buffer: finalBuffer });
        });

        writeStream.on('error', (err) => {
          logger.error({ err }, '[ReportPdfService] Write stream error in complete PDF');
          reject(err);
        });
      } catch (err) {
        logger.error({ err }, '[ReportPdfService] Complete PDF creation error');
        reject(err);
      }
    });
  }
}

export const reportPdfService = ReportPdfService.getInstance();
