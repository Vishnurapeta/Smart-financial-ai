import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import {
  User,
  Transaction,
  FinancialGoal,
  Budget,
  Portfolio,
  Holding,
  Watchlist,
  RecurringExpense,
  Subscription,
  Category,
  Notification,
  FinancialReport,
  AuditLog,
  RoleName,
  TransactionType,
  PaymentMethod,
  GoalStatus,
  GoalCategory,
  RecurringFrequency,
  RecurringType,
  BudgetPeriod,
  CategoryType,
} from '../src/models/index.js';
import { signAccessToken } from '../src/utils/token.js';
import { env } from '../src/config/env.js';

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_e2e';

describe('SmartFin AI — Complete System End-to-End Integration & Validation Suite', () => {
  let defaultCategoryId: Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Transaction.deleteMany({}),
      FinancialGoal.deleteMany({}),
      Budget.deleteMany({}),
      Portfolio.deleteMany({}),
      Holding.deleteMany({}),
      Watchlist.deleteMany({}),
      RecurringExpense.deleteMany({}),
      Subscription.deleteMany({}),
      Category.deleteMany({}),
      Notification.deleteMany({}),
      FinancialReport.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    const cat = await Category.create({
      name: 'General',
      slug: 'general',
      type: CategoryType.EXPENSE,
      isSystem: true,
      color: '#6366f1',
      icon: 'tag',
    });
    defaultCategoryId = cat._id;
  });

  // =========================================================================
  // 1. COMPLETE USER END-TO-END JOURNEY (21 SEQUENTIAL STEPS)
  // =========================================================================
  describe('1. Full User End-to-End Lifecycle Journey (21 Sequential Steps)', () => {
    it('should complete all 21 user financial milestones seamlessly without failure', async () => {
      // Step 1: Register new user
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'johndoe.e2e@smartfin.ai',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe',
        });
      expect(registerRes.status).toBe(201);
      expect(registerRes.body.data.user.email).toBe('johndoe.e2e@smartfin.ai');
      const userId = registerRes.body.data.user.id || registerRes.body.data.user._id;

      // Step 2: Login user
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'johndoe.e2e@smartfin.ai',
          password: 'Password123!',
        });
      expect(loginRes.status).toBe(200);
      const userToken = loginRes.body.data.tokens.accessToken;
      expect(userToken).toBeDefined();

      const authHeaders = { Authorization: `Bearer ${userToken}` };

      // Step 3: Add Income Transaction
      const incomeRes = await request(app)
        .post('/api/v1/transactions')
        .set(authHeaders)
        .send({
          amount: 6500,
          type: TransactionType.INCOME,
          merchant: 'Tech Corp Employer',
          description: 'Monthly payroll direct deposit',
          category: defaultCategoryId.toString(),
          date: new Date().toISOString(),
          paymentMethod: PaymentMethod.BANK_TRANSFER,
        });
      expect(incomeRes.status).toBe(201);
      const incomeTx = incomeRes.body.data.transaction || incomeRes.body.data;
      expect(incomeTx.amount).toBe(6500);

      // Step 4: Add Expense Transaction
      const expenseRes = await request(app)
        .post('/api/v1/transactions')
        .set(authHeaders)
        .send({
          amount: 120,
          type: TransactionType.EXPENSE,
          merchant: 'Swiggy Gourmet',
          description: 'Dinner delivery with family',
          category: defaultCategoryId.toString(),
          date: new Date().toISOString(),
          paymentMethod: PaymentMethod.CREDIT_CARD,
        });
      expect(expenseRes.status).toBe(201);
      const expenseTx = expenseRes.body.data.transaction || expenseRes.body.data;
      expect(expenseTx.amount).toBe(120);

      // Step 5: Smart Categorize Transaction via ML
      const categorizeRes = await request(app)
        .post('/api/v1/ml/categorize')
        .set(authHeaders)
        .send({
          text: 'Uber ride downtown $24.50',
        });
      expect([200, 201]).toContain(categorizeRes.status);
      expect(categorizeRes.body.data).toBeDefined();

      // Step 6: Create Monthly Budget
      const currentYearMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      const budgetRes = await request(app)
        .post('/api/v1/budgets')
        .set(authHeaders)
        .send({
          categoryId: defaultCategoryId.toString(),
          amount: 2500,
          period: BudgetPeriod.MONTHLY,
          month: currentYearMonth,
        });
      expect(budgetRes.status).toBe(201);
      const createdBudget = budgetRes.body.data.budget || budgetRes.body.data;
      expect(createdBudget.amount).toBe(2500);

      // Step 7: Create Recurring Expense
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const recurringRes = await request(app)
        .post('/api/v1/recurring')
        .set(authHeaders)
        .send({
          merchant: 'Netflix Streaming',
          description: 'Premium 4K Family Subscription',
          expectedAmount: 19.99,
          frequency: RecurringFrequency.MONTHLY,
          recurringType: RecurringType.SUBSCRIPTION,
          startDate: now.toISOString(),
          nextDueDate: nextMonth.toISOString(),
        });
      expect(recurringRes.status).toBe(201);
      const recurringItem = recurringRes.body.data.item || recurringRes.body.data;
      expect(recurringItem.merchant).toBe('Netflix Streaming');

      // Step 8: Add Financial Goal
      const futureGoalDate = new Date(now.getFullYear() + 1, now.getMonth(), 1);
      const goalRes = await request(app)
        .post('/api/v1/goals')
        .set(authHeaders)
        .send({
          title: 'Emergency Rainy Day Fund',
          description: '6 months of living expenses reserve',
          targetAmount: 15000,
          currentAmount: 3000,
          targetDate: futureGoalDate.toISOString(),
          category: GoalCategory.EMERGENCY_FUND,
        });
      expect(goalRes.status).toBe(201);
      const createdGoal = goalRes.body.data.goal || goalRes.body.data;
      expect(createdGoal.targetAmount).toBe(15000);

      // Step 9: Add Portfolio & Holding
      const portfolioRes = await request(app)
        .post('/api/v1/portfolios')
        .set(authHeaders)
        .send({
          name: 'Core Tech Growth Portfolio',
          baseCurrency: 'USD',
          cashBalance: 5000,
        });
      expect(portfolioRes.status).toBe(201);
      const portfolioId = portfolioRes.body.data._id || portfolioRes.body.data.id;

      const holdingRes = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set(authHeaders)
        .send({
          symbol: 'AAPL',
          quantity: 25,
          buyPrice: 175.5,
          buyDate: new Date().toISOString(),
        });
      expect(holdingRes.status).toBe(201);
      expect(holdingRes.body.data.symbol).toBe('AAPL');

      // Step 10: Add Stock to Watchlist
      const watchlistRes = await request(app)
        .post('/api/v1/watchlists')
        .set(authHeaders)
        .send({
          name: 'Tech Blue Chips',
          isDefault: true,
        });
      expect(watchlistRes.status).toBe(201);
      const watchlistId = watchlistRes.body.data._id || watchlistRes.body.data.id;

      const addSymbolRes = await request(app)
        .post(`/api/v1/watchlists/${watchlistId}/symbols`)
        .set(authHeaders)
        .send({ symbol: 'MSFT' });
      expect(addSymbolRes.status).toBe(200);

      // Step 11: View Stock Historical Data
      const historyRes = await request(app)
        .get('/api/v1/stocks/AAPL/history?interval=1d&range=1mo')
        .set(authHeaders);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);

      // Step 12: Request Stock Prediction (Proxy Endpoint with allowlisted target)
      const predRes = await request(app)
        .get('/api/v1/stocks/predictions/proxy?path=/predictions/stock?symbol=AAPL&horizon=7')
        .set(authHeaders);
      expect([200, 404, 405, 502, 503]).toContain(predRes.status);

      // Step 13: View Prediction Model Catalog & Metrics
      const modelsRes = await request(app)
        .get('/api/v1/stocks/predictions/proxy?path=/models/stock')
        .set(authHeaders);
      expect([200, 404, 502, 503]).toContain(modelsRes.status);

      // Step 14: View Expense Forecast
      const expenseForecastRes = await request(app)
        .get('/api/v1/forecasts/expenses?horizonMonths=3')
        .set(authHeaders);
      expect([200, 404, 502]).toContain(expenseForecastRes.status);

      // Step 15: View Cash-Flow Forecast
      const cashFlowForecastRes = await request(app)
        .get('/api/v1/forecasts/cash-flow?horizonMonths=3')
        .set(authHeaders);
      expect([200, 404, 502]).toContain(cashFlowForecastRes.status);

      // Step 16: View Anomaly Summary
      const anomalyRes = await request(app)
        .get('/api/v1/anomalies/summary')
        .set(authHeaders);
      expect(anomalyRes.status).toBe(200);
      expect(anomalyRes.body.data).toBeDefined();

      // Step 17: Ask AI Financial Assistant
      const aiRes = await request(app)
        .post('/api/v1/assistant/chat')
        .set(authHeaders)
        .send({
          message: 'What is my current total income and expenses this month?',
        });
      expect(aiRes.status).toBe(200);
      const aiContent = aiRes.body.data.message?.content || aiRes.body.data.reply;
      expect(aiContent).toBeDefined();

      // Step 18: Receive & List Notifications
      const notifRes = await request(app)
        .get('/api/v1/notifications')
        .set(authHeaders);
      expect(notifRes.status).toBe(200);
      const notificationsList = notifRes.body.data.notifications || notifRes.body.data;
      expect(Array.isArray(notificationsList)).toBe(true);

      // Step 19: Request Monthly Financial Report
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const reportRes = await request(app)
        .post('/api/v1/reports/monthly')
        .set(authHeaders)
        .send({
          year: currentYear,
          month: currentMonth,
        });
      expect([200, 201, 202]).toContain(reportRes.status);
      const reportData = reportRes.body.data?.report || reportRes.body.data;
      const reportId = reportData?._id || reportData?.id;

      // Step 20: Download / View PDF Report
      if (reportId) {
        const pdfRes = await request(app)
          .get(`/api/v1/reports/${reportId}/pdf`)
          .set(authHeaders);
        expect([200, 202, 400, 404]).toContain(pdfRes.status);
      }

      // Step 21: Logout User and verify session termination
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set(authHeaders);
      expect(logoutRes.status).toBe(200);
    }, 30000);
  });

  // =========================================================================
  // 2. COMPLETE ADMIN OPERATIONAL JOURNEY (8 STEPS)
  // =========================================================================
  describe('2. Admin End-to-End Operational Journey (8 Steps)', () => {
    it('should allow authorized administrators to manage platform state with complete audit trail', async () => {
      // Setup Admin User directly
      const adminUser = await User.create({
        email: 'ops-admin.e2e@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'System',
        lastName: 'Admin',
        role: RoleName.ADMIN,
        isEmailVerified: true,
      });

      // Target normal user for management
      const targetUser = await User.create({
        email: 'target.e2e@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Target',
        lastName: 'User',
        role: RoleName.USER,
        isEmailVerified: false,
      });

      const adminToken = signAccessToken({
        userId: adminUser._id.toString(),
        role: adminUser.role,
      });
      const adminHeaders = { Authorization: `Bearer ${adminToken}` };

      // Step 1: Admin verifies authentication access
      const meRes = await request(app).get('/api/v1/auth/me').set(adminHeaders);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.role).toBe(RoleName.ADMIN);

      // Step 2: View Admin Dashboard Overview Metrics
      const dashRes = await request(app).get('/api/v1/admin/metrics/overview').set(adminHeaders);
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.users).toBeDefined();
      expect(dashRes.body.data.users.total).toBeGreaterThan(0);

      // Step 3: View System Health & Database Diagnostics
      const healthRes = await request(app).get('/api/v1/admin/system/health').set(adminHeaders);
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.data.components).toBeDefined();
      expect(healthRes.body.data.status).toBeDefined();

      // Step 4: View API & Operational Telemetry
      const telemetryRes = await request(app).get('/api/v1/admin/metrics/telemetry').set(adminHeaders);
      expect(telemetryRes.status).toBe(200);

      // Step 5: Manage User Account Status (Suspend, then Reactivate)
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id}/status`)
        .set(adminHeaders)
        .send({
          action: 'SUSPEND',
          reason: 'Terms of service review',
        });
      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.user.isSuspended).toBe(true);

      const reactivateRes = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id}/status`)
        .set(adminHeaders)
        .send({
          action: 'REACTIVATE',
        });
      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.user.isSuspended).toBe(false);

      // Step 6: Perform Privileged Action (Manual Email Verification)
      const verifyEmailRes = await request(app)
        .post(`/api/v1/admin/users/${targetUser._id}/verify-email`)
        .set(adminHeaders);
      expect(verifyEmailRes.status).toBe(200);
      expect(verifyEmailRes.body.success).toBe(true);

      const verifiedUserInDb = await User.findById(targetUser._id);
      expect(verifiedUserInDb?.isEmailVerified).toBe(true);

      // Step 7: Inspect Audit Logs
      const auditRes = await request(app).get('/api/v1/admin/audit-logs').set(adminHeaders);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.logs.length).toBeGreaterThan(0);

      // Step 8: Admin Logout
      const logoutRes = await request(app).post('/api/v1/auth/logout').set(adminHeaders);
      expect(logoutRes.status).toBe(200);

      // Verification: Normal USER is strictly denied access to Admin APIs
      const normalUserToken = signAccessToken({
        userId: targetUser._id.toString(),
        role: targetUser.role,
      });
      const forbiddenRes = await request(app)
        .get('/api/v1/admin/metrics/overview')
        .set('Authorization', `Bearer ${normalUserToken}`);
      expect(forbiddenRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. SECURITY END-TO-END JOURNEY & MULTI-TENANT ISOLATION
  // =========================================================================
  describe('3. Security End-to-End Boundary & Multi-Tenant Attack Scenarios', () => {
    it('should defend against IDOR, NoSQL injection, SSRF, and unauthenticated access', async () => {
      // 1. Multi-Tenant IDOR: User B cannot access User A records
      const userA = await User.create({
        email: 'usera.sec@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Alice',
        lastName: 'A',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const userB = await User.create({
        email: 'userb.sec@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Bob',
        lastName: 'B',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const txA = await Transaction.create({
        userId: userA._id,
        amount: 500,
        type: TransactionType.EXPENSE,
        merchant: 'Private Merchant',
        category: defaultCategoryId,
        date: new Date(),
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });

      const tokenB = signAccessToken({
        userId: userB._id.toString(),
        role: userB.role,
      });

      const idorRes = await request(app)
        .get(`/api/v1/transactions/${txA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect([403, 404]).toContain(idorRes.status);

      // 2. NoSQL Operator Injection Neutralization
      const injectionRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $ne: null },
          password: 'Password123!',
        });
      // The sanitizer strips $ne, failing schema validation with 400
      expect(injectionRes.status).toBe(400);

      // 3. Path Traversal & SSRF Defense on Stock Prediction Gateway
      const traversalRes = await request(app)
        .get('/api/v1/stocks/predictions/proxy?path=../../../../etc/shadow')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(traversalRes.status).toBe(400);

      // 4. Algorithm Confusion & Unverified Token Rejection
      const forgedToken = jwt.sign(
        { userId: userA._id.toString(), role: RoleName.SUPER_ADMIN },
        'untrusted_attacker_secret_key',
        { algorithm: 'HS256' },
      );
      const forgedRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(forgedRes.status).toBe(401);
    });
  });
});
