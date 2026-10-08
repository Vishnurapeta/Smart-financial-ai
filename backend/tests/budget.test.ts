import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import {
  User,
  Transaction,
  Category,
  CategoryType,
  TransactionType,
  PaymentMethod,
  Budget,
  Notification,
  NotificationType,
} from '../src/models/index.js';

const TEST_DB_URI =
  process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_budgets';

describe('Budgeting Module Integration & Calculation Tests', () => {
  let userToken: string;
  let otherUserToken: string;
  let foodCatId: string;
  let utilitiesCatId: string;
  let entertainmentCatId: string;

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
      Category.deleteMany({}),
      Budget.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Register User 1
    const reg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'budget.tester@smartfin.ai',
        password: 'Password123!',
        firstName: 'Budget',
        lastName: 'Tester',
      });
    userToken = reg1.body.data.tokens.accessToken;

    // Register User 2
    const reg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'other.budget@smartfin.ai',
        password: 'Password123!',
        firstName: 'Other',
        lastName: 'User',
      });
    otherUserToken = reg2.body.data.tokens.accessToken;

    // Seed Expense Categories
    const [c1, c2, c3] = await Promise.all([
      Category.create({
        name: 'Food & Dining',
        slug: 'food-dining',
        type: CategoryType.EXPENSE,
        icon: 'utensils',
        color: '#F59E0B',
        isSystem: true,
      }),
      Category.create({
        name: 'Utilities & Bills',
        slug: 'utilities-bills',
        type: CategoryType.EXPENSE,
        icon: 'zap',
        color: '#3B82F6',
        isSystem: true,
      }),
      Category.create({
        name: 'Entertainment',
        slug: 'entertainment',
        type: CategoryType.EXPENSE,
        icon: 'film',
        color: '#EC4899',
        isSystem: true,
      }),
    ]);

    foodCatId = c1._id.toString();
    utilitiesCatId = c2._id.toString();
    entertainmentCatId = c3._id.toString();
  });

  it('1. Create Monthly Budget with validation and duplicate prevention', async () => {
    const currentMonth = '2026-09';

    // Positive case: Create monthly budget of 8000 for Food
    const res = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        categoryId: foodCatId,
        name: 'Food Budget',
        amount: 8000,
        month: currentMonth,
        currency: 'USD',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.budget.amount).toBe(8000);
    expect(res.body.data.budget.spent).toBe(0);
    expect(res.body.data.budget.remaining).toBe(8000);
    expect(res.body.data.budget.percentageUsed).toBe(0);
    expect(res.body.data.budget.isOverspent).toBe(false);
    expect(res.body.data.budget.status).toBe('ON_TRACK');

    // Negative case: Reject amount <= 0
    const invRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        categoryId: utilitiesCatId,
        amount: -500,
        month: currentMonth,
      });
    expect(invRes.status).toBe(400);

    // Negative case: Reject duplicate budget for same category in same month
    const dupRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        categoryId: foodCatId,
        amount: 5000,
        month: currentMonth,
      });
    expect(dupRes.status).toBe(409);
  });

  it('2. Calculate exact financial metrics from real transactions: Budget 8000, Spent 6500 -> Remaining 1500, Usage 81.25%', async () => {
    const month = '2026-09';

    // Create Food budget: $8,000
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        categoryId: foodCatId,
        name: 'Food',
        amount: 8000,
        month,
        currency: 'USD',
      });

    // Add transaction 1 in September 2026: $4,500
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 4500,
        type: TransactionType.EXPENSE,
        category: foodCatId,
        merchant: 'Whole Foods Market',
        date: '2026-09-05T12:00:00.000Z',
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });

    // Add transaction 2 in September 2026: $2,000 (Total spent = 6500)
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 2000,
        type: TransactionType.EXPENSE,
        category: foodCatId,
        merchant: 'Gourmet Dining',
        date: '2026-09-15T18:30:00.000Z',
        paymentMethod: PaymentMethod.DEBIT_CARD,
      });

    // Fetch budgets for September 2026
    const listRes = await request(app)
      .get(`/api/v1/budgets?month=${month}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.budgets).toHaveLength(1);
    const b = listRes.body.data.budgets[0];

    // Mathematical calculations check
    expect(b.amount).toBe(8000);
    expect(b.spent).toBe(6500);
    expect(b.remaining).toBe(1500);
    expect(b.percentageUsed).toBe(81.25);
    expect(b.isOverspent).toBe(false);
    expect(b.status).toBe('WARNING'); // >= 80% threshold

    // Wait brief tick for async event bus handler to persist notification
    await new Promise((r) => setTimeout(r, 500));

    // Verify 80% warning notification was automatically created
    const notifs = await Notification.find({ userId: b.userId });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    const alert80 = notifs.find((n) => n.title.includes('81%') || n.title.includes('80%') || n.title.includes('Budget Alert'));
    expect(alert80).toBeDefined();
    expect(alert80?.type).toBe(NotificationType.BUDGET_THRESHOLD);
    expect(alert80?.message).toContain('81.3%');
  });

  it('3. Overspending Detection: Detect usage > 100% and trigger high priority alert', async () => {
    const month = '2026-09';

    // Budget: 1,000
    const bRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        categoryId: utilitiesCatId,
        name: 'Utilities',
        amount: 1000,
        month,
      });
    const budgetId = bRes.body.data.budget._id;

    // Add expense: 1,500
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 1500,
        type: TransactionType.EXPENSE,
        category: utilitiesCatId,
        merchant: 'Electric Power Grid',
        date: '2026-09-10T10:00:00.000Z',
      });

    const res = await request(app)
      .get(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    const b = res.body.data.budget;
    expect(b.amount).toBe(1000);
    expect(b.spent).toBe(1500);
    expect(b.remaining).toBe(0);
    expect(b.isOverspent).toBe(true);
    expect(b.overspentAmount).toBe(500);
    expect(b.percentageUsed).toBe(150);
    expect(b.status).toBe('OVERSPENT');

    // Wait brief tick for async event bus handler to persist notification
    await new Promise((r) => setTimeout(r, 150));

    // Verify 100% exceeded notification generated
    const exceededNotif = await Notification.findOne({
      userId: b.userId,
      title: { $regex: /Budget Exceeded/i },
    });
    expect(exceededNotif).not.toBeNull();
    expect(exceededNotif?.priority).toBe('HIGH');
  });

  it('4. Monthly Consolidated Summary: Aggregate budgeted vs unbudgeted spending', async () => {
    const month = '2026-09';

    // Budget 1: Food 8000
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ categoryId: foodCatId, amount: 8000, month });

    // Budget 2: Utilities 3000
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ categoryId: utilitiesCatId, amount: 3000, month });

    // Expense in Food: 6500
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 6500,
        type: TransactionType.EXPENSE,
        category: foodCatId,
        merchant: 'Costco',
        date: '2026-09-10T12:00:00.000Z',
      });

    // Expense in Utilities: 1000
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 1000,
        type: TransactionType.EXPENSE,
        category: utilitiesCatId,
        merchant: 'City Water',
        date: '2026-09-12T12:00:00.000Z',
      });

    // Unbudgeted expense in Entertainment: 500
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 500,
        type: TransactionType.EXPENSE,
        category: entertainmentCatId,
        merchant: 'Cinema Cineplex',
        date: '2026-09-14T12:00:00.000Z',
      });

    const sumRes = await request(app)
      .get(`/api/v1/budgets/summary?month=${month}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(sumRes.status).toBe(200);
    const summary = sumRes.body.data.summary;

    expect(summary.totalBudgeted).toBe(11000); // 8000 + 3000
    expect(summary.totalSpentInBudgeted).toBe(7500); // 6500 + 1000
    expect(summary.totalUnbudgetedSpent).toBe(500);
    expect(summary.totalMonthlyExpense).toBe(8000); // 7500 + 500
    expect(summary.totalRemaining).toBe(3500); // 11000 - 7500
    expect(summary.totalBudgetsCount).toBe(2);
    expect(summary.warningCount).toBe(1); // Food at 81.25%
    expect(summary.onTrackCount).toBe(1); // Utilities at 33.33%
    expect(summary.overspentCount).toBe(0);
  });

  it('5. Budget History & Monthly Comparison endpoints', async () => {
    // Current month 2026-09
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ categoryId: foodCatId, amount: 8000, month: '2026-09' });

    // History check
    const histRes = await request(app)
      .get('/api/v1/budgets/history?months=6')
      .set('Authorization', `Bearer ${userToken}`);

    expect(histRes.status).toBe(200);
    expect(histRes.body.data.history).toHaveLength(6);

    // Comparison check
    const compRes = await request(app)
      .get('/api/v1/budgets/comparison?month1=2026-09&month2=2026-08')
      .set('Authorization', `Bearer ${userToken}`);

    expect(compRes.status).toBe(200);
    expect(compRes.body.data.comparison.month1.budgeted).toBe(8000);
    expect(compRes.body.data.comparison.categories).toHaveLength(1);
  });

  it('6. Edit, Delete & Ownership Isolation (IDOR Protection)', async () => {
    const bRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ categoryId: foodCatId, amount: 5000, month: '2026-09' });

    const budgetId = bRes.body.data.budget._id;

    // Owner can edit
    const editRes = await request(app)
      .put(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: 6000, name: 'Updated Food Limit' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.data.budget.amount).toBe(6000);
    expect(editRes.body.data.budget.name).toBe('Updated Food Limit');

    // Other user cannot edit (403 Forbidden)
    const attackRes = await request(app)
      .put(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ amount: 99999 });

    expect(attackRes.status).toBe(403);

    // Owner can delete
    const delRes = await request(app)
      .delete(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(delRes.status).toBe(200);

    // Deleted budget should not show up in active budgets
    const listRes = await request(app)
      .get('/api/v1/budgets?month=2026-09')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.body.data.budgets).toHaveLength(0);
  });
});
