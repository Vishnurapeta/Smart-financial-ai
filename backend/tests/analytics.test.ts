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
} from '../src/models/index.js';

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_analytics';

describe('Financial Analytics & Dashboard Calculations Tests', () => {
  let userToken: string;
  let salaryCatId: string;
  let housingCatId: string;
  let foodCatId: string;

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
    ]);

    // Register User
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'analytics.user@smartfin.ai',
        password: 'Password123!',
        firstName: 'Fin',
        lastName: 'Analyst',
      });
    userToken = reg.body.data.tokens.accessToken;

    // Seed Categories
    const [c1, c2, c3] = await Promise.all([
      Category.create({
        name: 'Salary & Compensation',
        slug: 'salary-comp',
        type: CategoryType.INCOME,
        color: '#10B981',
        isSystem: true,
      }),
      Category.create({
        name: 'Housing & Rent',
        slug: 'housing-rent',
        type: CategoryType.EXPENSE,
        color: '#3B82F6',
        isSystem: true,
      }),
      Category.create({
        name: 'Food & Groceries',
        slug: 'food-groceries',
        type: CategoryType.EXPENSE,
        color: '#F59E0B',
        isSystem: true,
      }),
    ]);
    salaryCatId = c1._id.toString();
    housingCatId = c2._id.toString();
    foodCatId = c3._id.toString();
  });

  it('should return clean zeros and empty datasets when user has no transactions', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { kpis, categorySpending, incomeVsExpense, dailySpending, topMerchants } =
      res.body.data;

    expect(kpis.totalBalance).toBe(0);
    expect(kpis.totalIncome).toBe(0);
    expect(kpis.totalExpenses).toBe(0);
    expect(kpis.savings).toBe(0);
    expect(kpis.savingsRate).toBe(0);
    expect(kpis.monthlyBurnRate).toBe(0);
    expect(kpis.yearToDateSpending).toBe(0);
    expect(kpis.monthOverMonth.incomeChangePercent).toBe(0);
    expect(kpis.monthOverMonth.expenseChangePercent).toBe(0);

    expect(categorySpending).toEqual([]);
    expect(topMerchants).toEqual([]);
    expect(dailySpending).toEqual([]);
    expect(incomeVsExpense.length).toBe(6); // 6 continuous monthly slots initialized to 0
    expect(incomeVsExpense.every((pt: any) => pt.income === 0 && pt.expense === 0)).toBe(true);
  });

  it('should accurately calculate total balance, savings, savings rate, burn rate, and category percentages', async () => {
    const now = new Date();

    // 1. Income: $10,000
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 10000,
        type: TransactionType.INCOME,
        merchant: 'Alphabet Corp',
        category: salaryCatId,
        date: now.toISOString(),
      });

    // 2. Expense 1: Housing $2,500
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 2500,
        type: TransactionType.EXPENSE,
        merchant: 'Skyline Apartments',
        category: housingCatId,
        date: now.toISOString(),
      });

    // 3. Expense 2: Food $500
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 500,
        type: TransactionType.EXPENSE,
        merchant: 'Trader Joe’s',
        category: foodCatId,
        date: now.toISOString(),
      });

    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    const { kpis, categorySpending, topMerchants, largestTransactions } = res.body.data;

    // Mathematical verification:
    // Income = $10,000
    // Expenses = $2,500 + $500 = $3,000
    // Balance / Savings = $10,000 - $3,000 = $7,000
    // Savings Rate = ($7,000 / $10,000) * 100 = 70.0%
    expect(kpis.totalIncome).toBe(10000);
    expect(kpis.totalExpenses).toBe(3000);
    expect(kpis.totalBalance).toBe(7000);
    expect(kpis.savings).toBe(7000);
    expect(kpis.savingsRate).toBe(70);
    expect(kpis.monthlyBurnRate).toBe(3000);
    expect(kpis.yearToDateSpending).toBe(3000);

    // Category breakdown verification:
    // Housing: $2,500 / $3,000 = 83.3%
    // Food: $500 / $3,000 = 16.7%
    expect(categorySpending.length).toBe(2);
    const housing = categorySpending.find((c: any) => c.name === 'Housing & Rent');
    const food = categorySpending.find((c: any) => c.name === 'Food & Groceries');

    expect(housing).toBeDefined();
    expect(housing.amount).toBe(2500);
    expect(housing.percentage).toBe(83.3);

    expect(food).toBeDefined();
    expect(food.amount).toBe(500);
    expect(food.percentage).toBe(16.7);

    // Top merchants verification:
    expect(topMerchants[0].merchant).toBe('Skyline Apartments');
    expect(topMerchants[0].amount).toBe(2500);
    expect(topMerchants[1].merchant).toBe('Trader Joe’s');
    expect(topMerchants[1].amount).toBe(500);

    // Largest transaction should be $10,000
    expect(largestTransactions[0].amount).toBe(10000);
  });

  it('should accurately calculate month-over-month (MoM) changes across consecutive months', async () => {
    const now = new Date();
    // Previous month date: 15th of last month
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    // Current month date: 1st of current month
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 2);

    // Prev Month: Income $4,000, Expense $2,000 -> Savings $2,000
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 4000,
        type: TransactionType.INCOME,
        merchant: 'Previous Employer',
        category: salaryCatId,
        date: prevMonthDate.toISOString(),
      });

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 2000,
        type: TransactionType.EXPENSE,
        merchant: 'Old Landlord',
        category: housingCatId,
        date: prevMonthDate.toISOString(),
      });

    // Current Month: Income $6,000 (+50%), Expense $2,500 (+25%) -> Savings $3,500 (+75%)
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 6000,
        type: TransactionType.INCOME,
        merchant: 'New Employer Promotion',
        category: salaryCatId,
        date: currentMonthDate.toISOString(),
      });

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amount: 2500,
        type: TransactionType.EXPENSE,
        merchant: 'Current Landlord',
        category: housingCatId,
        date: currentMonthDate.toISOString(),
      });

    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    const { monthOverMonth } = res.body.data.kpis;

    expect(monthOverMonth.previousMonth.income).toBe(4000);
    expect(monthOverMonth.previousMonth.expense).toBe(2000);
    expect(monthOverMonth.previousMonth.savings).toBe(2000);

    expect(monthOverMonth.currentMonth.income).toBe(6000);
    expect(monthOverMonth.currentMonth.expense).toBe(2500);
    expect(monthOverMonth.currentMonth.savings).toBe(3500);

    // MoM Percentage changes:
    // Income: ((6000 - 4000) / 4000) * 100 = +50.0%
    // Expense: ((2500 - 2000) / 2000) * 100 = +25.0%
    // Savings: ((3500 - 2000) / 2000) * 100 = +75.0%
    expect(monthOverMonth.incomeChangePercent).toBe(50);
    expect(monthOverMonth.expenseChangePercent).toBe(25);
    expect(monthOverMonth.savingsChangePercent).toBe(75);
  });

  it('should reject unauthenticated request to /api/v1/analytics/dashboard with 401', async () => {
    const res = await request(app).get('/api/v1/analytics/dashboard');
    expect(res.status).toBe(401);
  });
});
