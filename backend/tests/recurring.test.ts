import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Transaction, TransactionType } from '../src/models/transaction.model.js';
import { Category } from '../src/models/category.model.js';
import { RecurringExpense } from '../src/models/recurring-expense.model.js';
import { Subscription } from '../src/models/subscription.model.js';
import { Notification } from '../src/models/notification.model.js';

describe('Recurring Expense and Subscription Intelligence Integration Tests', () => {
  let authToken: string;
  let testUserId: string;
  let entertainmentCatId: Types.ObjectId;
  let utilitiesCatId: Types.ObjectId;
  let groceriesCatId: Types.ObjectId;

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/smartfin_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clear test collections
    await User.deleteMany({ email: /recurring_test_/ });
    await RecurringExpense.deleteMany({});
    await Subscription.deleteMany({});
    await Notification.deleteMany({});

    // Register user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `recurring_test_${Date.now()}@example.com`,
        password: 'Password123!',
        firstName: 'Recurring',
        lastName: 'Tester',
      });

    authToken = regRes.body.data.tokens.accessToken;
    testUserId = regRes.body.data.user.id || regRes.body.data.user._id;

    // Fetch or create categories
    let ent = await Category.findOne({ slug: 'entertainment-subscriptions' });
    if (!ent) {
      ent = await Category.create({
        name: 'Entertainment & Subscriptions',
        slug: 'entertainment-subscriptions',
        type: TransactionType.EXPENSE,
        isSystem: true,
      });
    }
    entertainmentCatId = ent._id;

    let util = await Category.findOne({ slug: 'utilities-bills' });
    if (!util) {
      util = await Category.create({
        name: 'Utilities & Bills',
        slug: 'utilities-bills',
        type: TransactionType.EXPENSE,
        isSystem: true,
      });
    }
    utilitiesCatId = util._id;

    let groc = await Category.findOne({ slug: 'groceries' });
    if (!groc) {
      groc = await Category.create({
        name: 'Groceries',
        slug: 'groceries',
        type: TransactionType.EXPENSE,
        isSystem: true,
      });
    }
    groceriesCatId = groc._id;

    // Seed historical transactions
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const txDocs = [
      // 1. Monthly Netflix Subscription: 4 charges 30 days apart, exact ₹649
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 649,
        currency: 'INR',
        merchant: 'Netflix',
        description: 'Monthly Netflix Plan',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 95 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 649,
        currency: 'INR',
        merchant: 'Netflix Inc',
        description: 'Monthly Netflix Plan',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 65 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 649,
        currency: 'INR',
        merchant: 'Netflix.com',
        description: 'Monthly Netflix Plan',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 35 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 649,
        currency: 'INR',
        merchant: 'Netflix',
        description: 'Monthly Netflix Plan',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 5 * dayMs),
      },

      // 2. Weekly Groceries: 4 charges 7 days apart, ~₹1200
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 1200,
        currency: 'INR',
        merchant: 'Whole Foods Market',
        description: 'Weekly staples',
        category: groceriesCatId,
        date: new Date(now.getTime() - 25 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 1250,
        currency: 'INR',
        merchant: 'Whole Foods Market',
        description: 'Weekly staples',
        category: groceriesCatId,
        date: new Date(now.getTime() - 18 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 1180,
        currency: 'INR',
        merchant: 'Whole Foods Market',
        description: 'Weekly staples',
        category: groceriesCatId,
        date: new Date(now.getTime() - 11 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 1220,
        currency: 'INR',
        merchant: 'Whole Foods Market',
        description: 'Weekly staples',
        category: groceriesCatId,
        date: new Date(now.getTime() - 4 * dayMs),
      },

      // 3. Monthly EMI Loan repayment: 3 charges 30 days apart, exact ₹15,000
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 15000,
        currency: 'INR',
        merchant: 'HDFC Bank Personal Loan EMI',
        description: 'Auto-debit loan installment',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 62 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 15000,
        currency: 'INR',
        merchant: 'HDFC Bank Personal Loan EMI',
        description: 'Auto-debit loan installment',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 32 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 15000,
        currency: 'INR',
        merchant: 'HDFC Bank Personal Loan EMI',
        description: 'Auto-debit loan installment',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 2 * dayMs),
      },

      // 4. Utility: Monthly Electricity with moderate variance (₹1,300, ₹1,450, ₹1,210)
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 1300,
        currency: 'INR',
        merchant: 'BESCOM Electricity',
        description: 'Power bill',
        category: utilitiesCatId,
        date: new Date(now.getTime() - 65 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 1450,
        currency: 'INR',
        merchant: 'BESCOM Electricity',
        description: 'Power bill',
        category: utilitiesCatId,
        date: new Date(now.getTime() - 35 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 1210,
        currency: 'INR',
        merchant: 'BESCOM Electricity',
        description: 'Power bill',
        category: utilitiesCatId,
        date: new Date(now.getTime() - 5 * dayMs),
      },

      // 5. Inactive Subscription: Spotify with last payment 65 days ago
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 119,
        currency: 'INR',
        merchant: 'Spotify India',
        description: 'Premium Duo',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 95 * dayMs),
      },
      {
        userId: new Types.ObjectId(testUserId),
        type: TransactionType.EXPENSE,
        amount: 119,
        currency: 'INR',
        merchant: 'Spotify India',
        description: 'Premium Duo',
        category: entertainmentCatId,
        date: new Date(now.getTime() - 65 * dayMs),
      },
    ];

    await Transaction.insertMany(txDocs);
  });

  afterAll(async () => {
    await User.deleteMany({ email: /recurring_test_/ });
    await RecurringExpense.deleteMany({});
    await Subscription.deleteMany({});
    await Notification.deleteMany({});
  });

  it('1. POST /api/v1/recurring/detect - should detect recurring patterns and persist to DB', async () => {
    const res = await request(app)
      .post('/api/v1/recurring/detect')
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalDetected).toBeGreaterThanOrEqual(4);

    // Verify Netflix was classified as SUBSCRIPTION
    const netflixRec = await RecurringExpense.findOne({
      userId: new Types.ObjectId(testUserId),
      merchant: /Netflix/i,
      isDeleted: false,
    });
    expect(netflixRec).not.toBeNull();
    expect(netflixRec?.frequency).toBe('MONTHLY');
    expect(netflixRec?.recurringType).toBe('SUBSCRIPTION');
    expect(netflixRec?.expectedAmount).toBe(649);
    expect(netflixRec?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(netflixRec?.isActive).toBe(true);

    // Verify HDFC was classified as EMI
    const emiRec = await RecurringExpense.findOne({
      userId: new Types.ObjectId(testUserId),
      merchant: /HDFC/i,
      isDeleted: false,
    });
    expect(emiRec).not.toBeNull();
    expect(emiRec?.recurringType).toBe('EMI');
    expect(emiRec?.expectedAmount).toBe(15000);

    // Verify BESCOM was classified as UTILITY
    const utilityRec = await RecurringExpense.findOne({
      userId: new Types.ObjectId(testUserId),
      merchant: /BESCOM/i,
      isDeleted: false,
    });
    expect(utilityRec).not.toBeNull();
    expect(utilityRec?.recurringType).toBe('UTILITY');

    // Verify Spotify was flagged as possibly inactive with transaction evidence
    const spotifyRec = await RecurringExpense.findOne({
      userId: new Types.ObjectId(testUserId),
      merchant: /Spotify/i,
      isDeleted: false,
    });
    expect(spotifyRec).not.toBeNull();
    expect(spotifyRec?.isPossiblyInactive).toBe(true);
    expect(spotifyRec?.inactivityEvidence).toBeDefined();
    expect(spotifyRec?.inactivityEvidence).toContain('No transaction detected');

    // Verify Subscription record created for Spotify with POSSIBLY_INACTIVE status
    const spotifySub = await Subscription.findOne({
      userId: new Types.ObjectId(testUserId),
      merchant: /Spotify/i,
      isDeleted: false,
    });
    expect(spotifySub).not.toBeNull();
    expect(spotifySub?.status).toBe('POSSIBLY_INACTIVE');
    expect(spotifySub?.isPossiblyInactive).toBe(true);
  });

  it('2. GET /api/v1/subscriptions/dashboard - should calculate accurate subscription metrics', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const dashboard = res.body.data;

    expect(dashboard.subscriptionCount).toBeGreaterThanOrEqual(2);
    expect(dashboard.activeSubscriptions).toBeGreaterThanOrEqual(1);
    expect(dashboard.possiblyInactiveSubscriptions).toBeGreaterThanOrEqual(1);
    expect(dashboard.monthlySubscriptionCost).toBeGreaterThan(0);
    expect(dashboard.annualizedSubscriptionCost).toBe(
      Math.round(dashboard.monthlySubscriptionCost * 12 * 100) / 100,
    );
    expect(dashboard.possiblyInactiveList.length).toBeGreaterThanOrEqual(1);
    expect(dashboard.possiblyInactiveList[0].inactivityEvidence).toBeDefined();
  });

  it('3. GET /api/v1/recurring - should return paginated recurring expense records', async () => {
    const res = await request(app)
      .get('/api/v1/recurring')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(4);

    // Test filter by frequency
    const filterRes = await request(app)
      .get('/api/v1/recurring?frequency=WEEKLY')
      .set('Authorization', `Bearer ${authToken}`);

    expect(filterRes.status).toBe(200);
    expect(
      filterRes.body.data.items.every((i: { frequency: string }) => i.frequency === 'WEEKLY'),
    ).toBe(true);
  });

  it('4. Reminder Architecture: GET /api/v1/recurring/reminders/upcoming & POST trigger', async () => {
    const upcomingRes = await request(app)
      .get('/api/v1/recurring/reminders/upcoming?days=30')
      .set('Authorization', `Bearer ${authToken}`);

    expect(upcomingRes.status).toBe(200);
    expect(upcomingRes.body.success).toBe(true);
    expect(upcomingRes.body.data.bills.length).toBeGreaterThanOrEqual(1);

    const firstBill = upcomingRes.body.data.bills[0];
    expect(firstBill.merchant).toBeDefined();
    expect(firstBill.amount).toBeGreaterThan(0);
    expect(firstBill.urgency).toBeDefined();

    // Trigger bill reminders
    const triggerRes = await request(app)
      .post('/api/v1/recurring/reminders/trigger')
      .set('Authorization', `Bearer ${authToken}`);

    expect(triggerRes.status).toBe(200);
    expect(triggerRes.body.success).toBe(true);
  });

  it('5. CRUD Subscriptions & Price History Alert tracking', async () => {
    // Create new subscription
    const createRes = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'GitHub Copilot',
        merchant: 'GitHub',
        planTier: 'Individual',
        billingCycle: 'MONTHLY',
        amount: 10,
        currency: 'USD',
        renewalDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(createRes.status).toBe(201);
    const subId = createRes.body.data.item._id;

    // Update price from $10 to $19 (detect price change)
    const updateRes = await request(app)
      .put(`/api/v1/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 19,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.item.amount).toBe(19);
    expect(updateRes.body.data.item.priceChangeAlert).toBe(true);
    expect(updateRes.body.data.item.priceHistory.length).toBe(2);

    // Soft delete
    const deleteRes = await request(app)
      .delete(`/api/v1/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deleteRes.status).toBe(200);
  });
});
