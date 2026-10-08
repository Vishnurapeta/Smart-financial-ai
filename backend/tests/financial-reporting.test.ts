import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Transaction, TransactionType } from '../src/models/transaction.model.js';
import { FinancialReport, ReportStatus, ReportType } from '../src/models/financial-report.model.js';
import { FinancialGoal, GoalCategory, GoalStatus } from '../src/models/financial-goal.model.js';
import { Category, CategoryType } from '../src/models/category.model.js';
import { Asset, AssetType } from '../src/models/asset.model.js';
import { Liability, LiabilityType } from '../src/models/liability.model.js';
import { Portfolio } from '../src/models/portfolio.model.js';
import { Holding, HoldingAssetType } from '../src/models/holding.model.js';
import { RecurringExpense, RecurringFrequency, RecurringType } from '../src/models/recurring-expense.model.js';
import { Subscription, SubscriptionBillingCycle, SubscriptionStatus } from '../src/models/subscription.model.js';
import { reportAggregatorService } from '../src/services/report/report-aggregator.service.js';
import { reportPdfService } from '../src/services/report/report-pdf.service.js';
import { cacheService } from '../src/config/redis.js';

describe('Production Financial Reporting System Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof createApp>;
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let catSalaryId: Types.ObjectId;
  let catHousingId: Types.ObjectId;
  let catFoodId: Types.ObjectId;
  let catTransportId: Types.ObjectId;
  let catMedicalId: Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    app = createApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await FinancialReport.deleteMany({});
    await Transaction.deleteMany({});
    await FinancialGoal.deleteMany({});
    await Asset.deleteMany({});
    await Liability.deleteMany({});
    await Portfolio.deleteMany({});
    await Holding.deleteMany({});
    await RecurringExpense.deleteMany({});
    await Subscription.deleteMany({});
    await User.deleteMany({});
    await Category.deleteMany({});
    await cacheService.delPattern('ratelimit:*');

    // Create system categories
    const [salaryCat, housingCat, foodCat, transportCat, medicalCat] = await Category.create([
      { name: 'Salary', slug: 'salary', type: CategoryType.INCOME, icon: 'briefcase', color: '#10b981', isSystem: true, isDeleted: false },
      { name: 'Housing', slug: 'housing', type: CategoryType.EXPENSE, icon: 'home', color: '#3b82f6', isSystem: true, isDeleted: false },
      { name: 'Food', slug: 'food', type: CategoryType.EXPENSE, icon: 'utensils', color: '#f59e0b', isSystem: true, isDeleted: false },
      { name: 'Transportation', slug: 'transportation', type: CategoryType.EXPENSE, icon: 'car', color: '#8b5cf6', isSystem: true, isDeleted: false },
      { name: 'Medical', slug: 'medical', type: CategoryType.EXPENSE, icon: 'heart', color: '#ef4444', isSystem: true, isDeleted: false },
    ]);

    catSalaryId = salaryCat._id;
    catHousingId = housingCat._id;
    catFoodId = foodCat._id;
    catTransportId = transportCat._id;
    catMedicalId = medicalCat._id;

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send({
      email: 'usera.investor@smartfin.ai',
      password: 'SecurePassword123!',
      firstName: 'Alice',
      lastName: 'Investor',
    });
    userAToken = resA.body.data.tokens.accessToken;
    userAId = resA.body.data.user.id;

    // Register User B (for user isolation & authorization tests)
    const resB = await request(app).post('/api/v1/auth/register').send({
      email: 'userb.trader@smartfin.ai',
      password: 'SecurePassword123!',
      firstName: 'Bob',
      lastName: 'Trader',
    });
    userBToken = resB.body.data.tokens.accessToken;
    userBId = resB.body.data.user.id;
  });

  describe('1. Calculation Engine & Single Source of Truth', () => {
    it('calculates income, expenses, positive savings, and savings rate deterministically', async () => {
      const year = 2026;
      const month = 9; // September 2026
      const txDate = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));

      // User A Transactions
      await Transaction.create([
        {
          userId: new Types.ObjectId(userAId),
          type: TransactionType.INCOME,
          amount: 75000,
          category: catSalaryId,
          merchant: 'Tech Corp',
          description: 'Monthly Salary',
          date: txDate,
        },
        {
          userId: new Types.ObjectId(userAId),
          type: TransactionType.EXPENSE,
          amount: 42000,
          category: catHousingId,
          merchant: 'Rent Property',
          description: 'Apartment Rent',
          date: txDate,
        },
      ]);

      const snapshot = await reportAggregatorService.buildMonthlySnapshot(userAId, year, month);

      expect(snapshot.executiveSummary.totalIncome).toBe(75000);
      expect(snapshot.executiveSummary.totalExpenses).toBe(42000);
      expect(snapshot.executiveSummary.savings).toBe(33000);
      expect(snapshot.executiveSummary.savingsRate).toBe(44); // (33000/75000)*100 = 44%
      expect(snapshot.executiveSummary.savingsRateFormatted).toBe('44.0%');
      expect(snapshot.executiveSummary.monthlyBurnRate).toBe(42000);
      expect(snapshot.largestTransactions.length).toBe(2);
      expect(snapshot.largestTransactions[0].amount).toBe(75000);
    });

    it('handles negative savings gracefully without hiding negative values', async () => {
      const year = 2026;
      const month = 9;
      const txDate = new Date(Date.UTC(year, month - 1, 10, 10, 0, 0));

      await Transaction.create([
        {
          userId: new Types.ObjectId(userAId),
          type: TransactionType.INCOME,
          amount: 75000,
          category: catSalaryId,
          merchant: 'Tech Corp',
          description: 'Salary',
          date: txDate,
        },
        {
          userId: new Types.ObjectId(userAId),
          type: TransactionType.EXPENSE,
          amount: 80000,
          category: catMedicalId,
          merchant: 'City Hospital',
          description: 'Emergency Surgery',
          date: txDate,
        },
      ]);

      const snapshot = await reportAggregatorService.buildMonthlySnapshot(userAId, year, month);

      expect(snapshot.executiveSummary.totalIncome).toBe(75000);
      expect(snapshot.executiveSummary.totalExpenses).toBe(80000);
      expect(snapshot.executiveSummary.savings).toBe(-5000);
      expect(snapshot.executiveSummary.savingsRate).toBe(-6.7);
      expect(snapshot.executiveSummary.savingsRateFormatted).toBe('-6.7%');
    });

    it('safely handles zero income without division by zero error ("Not available")', async () => {
      const year = 2026;
      const month = 9;
      const txDate = new Date(Date.UTC(year, month - 1, 5, 10, 0, 0));

      await Transaction.create({
        userId: new Types.ObjectId(userAId),
        type: TransactionType.EXPENSE,
        amount: 15000,
        category: catFoodId,
        merchant: 'Supermarket',
        description: 'Groceries',
        date: txDate,
      });

      const snapshot = await reportAggregatorService.buildMonthlySnapshot(userAId, year, month);

      expect(snapshot.executiveSummary.totalIncome).toBe(0);
      expect(snapshot.executiveSummary.totalExpenses).toBe(15000);
      expect(snapshot.executiveSummary.savings).toBe(-15000);
      expect(snapshot.executiveSummary.savingsRate).toBeNull();
      expect(snapshot.executiveSummary.savingsRateFormatted).toBe('Not available');
    });

    it('aggregates top spending categories and calculates percentage distribution', async () => {
      const year = 2026;
      const month = 9;
      const txDate = new Date(Date.UTC(year, month - 1, 12, 10, 0, 0));

      await Transaction.create([
        {
          userId: new Types.ObjectId(userAId),
          type: TransactionType.EXPENSE,
          amount: 5000,
          category: catHousingId,
          merchant: 'Landlord',
          description: 'Rent',
          date: txDate,
        },
        {
          userId: new Types.ObjectId(userAId),
          type: TransactionType.EXPENSE,
          amount: 3000,
          category: catFoodId,
          merchant: 'Grocery Mart',
          description: 'Food Supplies',
          date: txDate,
        },
        {
          userId: new Types.ObjectId(userAId),
          type: TransactionType.EXPENSE,
          amount: 2000,
          category: catTransportId,
          merchant: 'Metro Transit',
          description: 'Commute',
          date: txDate,
        },
      ]);

      const snapshot = await reportAggregatorService.buildMonthlySnapshot(userAId, year, month);

      expect(snapshot.expenseSection.totalExpenses).toBe(10000);
      expect(snapshot.expenseSection.topCategories.length).toBe(3);
      expect(snapshot.expenseSection.topCategories[0].name).toBe('Housing');
      expect(snapshot.expenseSection.topCategories[0].amount).toBe(5000);
      expect(snapshot.expenseSection.topCategories[0].percentage).toBe(50);
      expect(snapshot.expenseSection.topCategories[1].name).toBe('Food');
      expect(snapshot.expenseSection.topCategories[1].percentage).toBe(30);
      expect(snapshot.expenseSection.topCategories[2].name).toBe('Transportation');
      expect(snapshot.expenseSection.topCategories[2].percentage).toBe(20);
    });

    it('aggregates recurring expenses, subscriptions, goals, and net worth correctly', async () => {
      const year = 2026;
      const month = 9;

      // Recurring expense & subscription
      await RecurringExpense.create({
        userId: new Types.ObjectId(userAId),
        merchant: 'Electric Utility',
        description: 'Power Grid',
        expectedAmount: 120,
        currency: 'USD',
        frequency: RecurringFrequency.MONTHLY,
        recurringType: RecurringType.UTILITY,
        confidence: 0.95,
        startDate: new Date('2026-01-01'),
        nextDueDate: new Date('2026-09-30'),
        isActive: true,
        isPossiblyInactive: false,
        autoDetected: false,
        isDeleted: false,
      });

      await Subscription.create({
        userId: new Types.ObjectId(userAId),
        name: 'Cloud Storage Pro',
        merchant: 'Cloud Corp',
        billingCycle: SubscriptionBillingCycle.MONTHLY,
        amount: 20,
        currency: 'USD',
        status: SubscriptionStatus.ACTIVE,
        renewalDate: new Date('2026-09-28'),
        isPossiblyInactive: false,
        priceHistory: [],
        priceChangeAlert: false,
        isDeleted: false,
      });

      // Goal
      await FinancialGoal.create({
        userId: new Types.ObjectId(userAId),
        title: 'Emergency Fund',
        description: 'Safety buffer',
        category: GoalCategory.EMERGENCY_FUND,
        targetAmount: 100000,
        currentAmount: 80000,
        currency: 'USD',
        targetDate: new Date('2026-12-31'),
        status: GoalStatus.IN_PROGRESS,
        autoContributeMonthly: 500,
        isDeleted: false,
      });

      // Asset & Liability
      await Asset.create({
        userId: new Types.ObjectId(userAId),
        name: 'Checking Account',
        type: AssetType.BANK_ACCOUNT,
        currentValue: 50000,
        currency: 'USD',
        isLiquid: true,
        isDeleted: false,
      });

      await Liability.create({
        userId: new Types.ObjectId(userAId),
        name: 'Car Loan',
        type: LiabilityType.AUTO_LOAN,
        currentBalance: 10000,
        currency: 'USD',
        isDeleted: false,
      });

      const snapshot = await reportAggregatorService.buildMonthlySnapshot(userAId, year, month);

      expect(snapshot.recurringCommitments.activeRecurringCount).toBe(1);
      expect(snapshot.recurringCommitments.activeSubscriptionCount).toBe(1);
      expect(snapshot.recurringCommitments.totalMonthlyCommitments).toBe(140);

      expect(snapshot.financialGoals.activeGoals.length).toBe(1);
      expect(snapshot.financialGoals.activeGoals[0].name).toBe('Emergency Fund');
      expect(snapshot.financialGoals.activeGoals[0].progressPercent).toBe(80);
      expect(snapshot.financialGoals.activeGoals[0].remainingAmount).toBe(20000);

      expect(snapshot.netWorthSection.totalAssets).toBe(50000);
      expect(snapshot.netWorthSection.totalLiabilities).toBe(10000);
      expect(snapshot.netWorthSection.currentNetWorth).toBe(40000);
    });
  });

  describe('2. Vector PDF Generation Engine', () => {
    it('generates a multi-page fintech vector PDF document on disk with content', async () => {
      const snapshot = await reportAggregatorService.buildMonthlySnapshot(userAId, 2026, 9);
      const reportId = new Types.ObjectId().toString();

      const { filePath, fileSizeBytes } = await reportPdfService.generatePdf(reportId, snapshot);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fileSizeBytes).toBeGreaterThan(1000);

      // Clean up temporary generated PDF file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('3. API Endpoints, Caching & Deduplication', () => {
    it('POST /api/v1/reports/monthly generates a new monthly report snapshot', async () => {
      const res = await request(app)
        .post('/api/v1/reports/monthly')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          year: 2026,
          month: 9,
          forceRegenerate: false,
          sendEmail: false,
        });

      expect([200, 202]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reportId).toBeDefined();
      expect(res.body.data.year).toBe(2026);
      expect(res.body.data.month).toBe(9);
    });

    it('returns existing cached report on duplicate request when forceRegenerate is false', async () => {
      // First request
      const firstRes = await request(app)
        .post('/api/v1/reports/monthly')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          year: 2026,
          month: 9,
          forceRegenerate: false,
        });

      const reportId = firstRes.body.data.reportId;

      // Mark report as READY to simulate completion
      await FinancialReport.updateOne(
        { _id: new Types.ObjectId(reportId) },
        { $set: { status: ReportStatus.READY } },
      );

      // Second request for same period
      const secondRes = await request(app)
        .post('/api/v1/reports/monthly')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          year: 2026,
          month: 9,
          forceRegenerate: false,
        });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.isCached).toBe(true);
      expect(secondRes.body.data.reportId).toBe(reportId);
    });

    it('GET /api/v1/reports lists reports with pagination and filtering', async () => {
      // Generate two reports
      await FinancialReport.create([
        {
          userId: new Types.ObjectId(userAId),
          reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
          title: 'Monthly Financial Report - September 2026',
          year: 2026,
          month: 9,
          periodStart: new Date('2026-09-01'),
          periodEnd: new Date('2026-09-30'),
          timezone: 'UTC',
          currency: 'USD',
          status: ReportStatus.READY,
        },
        {
          userId: new Types.ObjectId(userAId),
          reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
          title: 'Monthly Financial Report - August 2026',
          year: 2026,
          month: 8,
          periodStart: new Date('2026-08-01'),
          periodEnd: new Date('2026-08-31'),
          timezone: 'UTC',
          currency: 'USD',
          status: ReportStatus.READY,
        },
      ]);

      const res = await request(app)
        .get('/api/v1/reports?year=2026')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });
  });

  describe('4. Security & Strict User Isolation (IDOR Protection)', () => {
    let userAReportId: string;

    beforeEach(async () => {
      const report = await FinancialReport.create({
        userId: new Types.ObjectId(userAId),
        reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
        title: "Alice's Private Financial Report",
        year: 2026,
        month: 9,
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        timezone: 'UTC',
        currency: 'USD',
        status: ReportStatus.READY,
        dataSnapshot: {
          metadata: {
            reportType: 'MONTHLY_FINANCIAL_REPORT',
            periodLabel: 'September 2026',
          },
          executiveSummary: {
            totalIncome: 100000,
            totalExpenses: 20000,
            savings: 80000,
            savingsRate: 80,
            savingsRateFormatted: '80%',
            monthlyBurnRate: 20000,
            burnRateDefinition: 'Monthly outflow rate',
            netWorth: 500000,
            portfolioValue: 300000,
            keyTakeaway: 'High savings rate',
          },
        },
      });
      userAReportId = report._id.toString();
    });

    it('allows User A to view their own report', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/${userAReportId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(userAReportId);
    });

    it('prevents User B from accessing User A report (IDOR Protection)', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/${userAReportId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('prevents User B from downloading User A PDF report', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/${userAReportId}/pdf`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
    });

    it('prevents User B from triggering email delivery of User A report', async () => {
      const res = await request(app)
        .post(`/api/v1/reports/${userAReportId}/email`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
    });

    it('prevents User B from deleting User A report', async () => {
      const res = await request(app)
        .delete(`/api/v1/reports/${userAReportId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);

      // Verify report is not deleted
      const check = await FinancialReport.findById(userAReportId);
      expect(check?.isDeleted).toBe(false);
    });
  });

  describe('5. PDF Streaming & Email Delivery Triggers', () => {
    it('GET /api/v1/reports/:id/pdf streams application/pdf to the authorized owner', async () => {
      // Create snapshot & report
      const snapshot = await reportAggregatorService.buildMonthlySnapshot(userAId, 2026, 9);
      const report = await FinancialReport.create({
        userId: new Types.ObjectId(userAId),
        reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
        title: 'Monthly Financial Report - September 2026',
        year: 2026,
        month: 9,
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        timezone: 'UTC',
        currency: 'USD',
        status: ReportStatus.READY,
        dataSnapshot: snapshot,
      });

      const res = await request(app)
        .get(`/api/v1/reports/${report._id}/pdf`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body).toBeDefined();
    });

    it('POST /api/v1/reports/:id/email queues email delivery safely for authenticated owner', async () => {
      const report = await FinancialReport.create({
        userId: new Types.ObjectId(userAId),
        reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
        title: 'Monthly Financial Report - September 2026',
        year: 2026,
        month: 9,
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        timezone: 'UTC',
        currency: 'USD',
        status: ReportStatus.READY,
        dataSnapshot: {
          executiveSummary: {
            totalIncome: 50000,
            totalExpenses: 20000,
            savings: 30000,
          },
        },
      });

      const res = await request(app)
        .post(`/api/v1/reports/${report._id}/email`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('queued');
    });
  });
});
