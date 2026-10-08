import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Transaction, TransactionType } from '../src/models/transaction.model.js';
import { Category } from '../src/models/category.model.js';
import { RecurringExpense, RecurringFrequency, RecurringType } from '../src/models/recurring-expense.model.js';
import { FinancialGoal, GoalCategory, GoalStatus } from '../src/models/financial-goal.model.js';
import { FinancialForecast } from '../src/models/financial-forecast.model.js';

describe('Financial Forecasting Module Integration Tests', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let foodCatId: Types.ObjectId;
  let housingCatId: Types.ObjectId;

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/smartfin_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test collections
    await User.deleteMany({ email: /forecast_test_/ });
    await FinancialForecast.deleteMany({});

    // Register User A
    const regA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `forecast_test_a_${Date.now()}@example.com`,
        password: 'Password123!',
        firstName: 'Forecaster',
        lastName: 'Alpha',
      });
    userAToken = regA.body.data.tokens.accessToken;
    userAId = regA.body.data.user.id || regA.body.data.user._id;

    // Register User B
    const regB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `forecast_test_b_${Date.now()}@example.com`,
        password: 'Password123!',
        firstName: 'Forecaster',
        lastName: 'Beta',
      });
    userBToken = regB.body.data.tokens.accessToken;
    userBId = regB.body.data.user.id || regB.body.data.user._id;

    // Ensure Categories
    let foodCat = await Category.findOne({ slug: 'food-dining' });
    if (!foodCat) {
      foodCat = await Category.create({
        name: 'Food & Dining',
        slug: 'food-dining',
        type: TransactionType.EXPENSE,
        isSystem: true,
      });
    }
    foodCatId = foodCat._id;

    let housingCat = await Category.findOne({ slug: 'housing-rent' });
    if (!housingCat) {
      housingCat = await Category.create({
        name: 'Housing & Rent',
        slug: 'housing-rent',
        type: TransactionType.EXPENSE,
        isSystem: true,
      });
    }
    housingCatId = housingCat._id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: /forecast_test_/ });
    await Transaction.deleteMany({ userId: { $in: [userAId, userBId] } });
    await RecurringExpense.deleteMany({ userId: { $in: [userAId, userBId] } });
    await FinancialGoal.deleteMany({ userId: { $in: [userAId, userBId] } });
    await FinancialForecast.deleteMany({ userId: { $in: [userAId, userBId] } });
  });

  it('1. Authentication Check: GET /api/v1/forecasts/expenses without token should return 401', async () => {
    const res = await request(app).get('/api/v1/forecasts/expenses');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. Insufficient Data: User with 0 transactions should get insufficient_data status', async () => {
    const res = await request(app)
      .get('/api/v1/forecasts/expenses?horizon=3')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('insufficient_data');
    expect(res.body.data.min_history_required).toBe(3);
    expect(res.body.data.actual_history_months).toBe(0);
    expect(res.body.data.forecast).toHaveLength(0);
  });

  it('3. User Data Isolation & Accurate Expense Forecasting', async () => {
    // Seed 6 consecutive months of historical transactions for User A
    const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];
    const expenseAmounts = [18000, 20000, 19500, 21000, 22500, 22000];
    const incomeAmounts = [45000, 45000, 45000, 48000, 48000, 48000];

    for (let i = 0; i < months.length; i++) {
      const [year, month] = months[i].split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, 15));

      // Expense tx
      await Transaction.create({
        userId: new Types.ObjectId(userAId),
        type: TransactionType.EXPENSE,
        amount: expenseAmounts[i],
        currency: 'USD',
        merchant: 'Supermarket and Rent',
        category: foodCatId,
        date,
      });

      // Income tx
      await Transaction.create({
        userId: new Types.ObjectId(userAId),
        type: TransactionType.INCOME,
        amount: incomeAmounts[i],
        currency: 'USD',
        merchant: 'Employer Payroll',
        category: housingCatId,
        date,
      });

      // Transfer tx (must NOT be counted in expense total)
      await Transaction.create({
        userId: new Types.ObjectId(userAId),
        type: TransactionType.TRANSFER,
        amount: 5000,
        currency: 'USD',
        merchant: 'Internal Savings Transfer',
        category: housingCatId,
        date,
      });
    }

    // Also add a recurring commitment for User A
    await RecurringExpense.create({
      userId: new Types.ObjectId(userAId),
      merchant: 'Apartment Rent',
      description: 'Monthly flat rent',
      expectedAmount: 12000,
      currency: 'USD',
      frequency: RecurringFrequency.MONTHLY,
      recurringType: RecurringType.EXPENSE,
      confidence: 1.0,
      startDate: new Date('2025-01-01'),
      nextDueDate: new Date('2025-07-01'),
      isActive: true,
      autoDetected: false,
    });

    // Request Expense Forecast for User A
    const resA = await request(app)
      .get('/api/v1/forecasts/expenses?horizon=3')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.success).toBe(true);
    expect(resA.body.data.status).toBe('success');
    expect(resA.body.data.actual_history_months).toBe(6);
    expect(resA.body.data.forecast).toHaveLength(3);

    // Verify User B still sees 0 history (User Data Isolation Guarantee)
    const resB = await request(app)
      .get('/api/v1/forecasts/expenses?horizon=3')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(resB.body.data.status).toBe('insufficient_data');
    expect(resB.body.data.actual_history_months).toBe(0);
  });

  it('4. Cash-Flow Forecast Synthesis: Expected Income, Expenses & Net Flow', async () => {
    // Add an active financial goal with autoContributeMonthly for User A
    await FinancialGoal.create({
      userId: new Types.ObjectId(userAId),
      title: 'Emergency Savings',
      targetAmount: 50000,
      currentAmount: 10000,
      currency: 'USD',
      targetDate: new Date('2026-12-31'),
      category: GoalCategory.EMERGENCY_FUND,
      status: GoalStatus.IN_PROGRESS,
      autoContributeMonthly: 3000,
    });

    const res = await request(app)
      .get('/api/v1/forecasts/cash-flow?horizon=3')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('success');
    expect(res.body.data.forecast_type).toBe('cash_flow');
    expect(res.body.data.forecast).toHaveLength(3);

    const firstPeriod = res.body.data.forecast[0];
    expect(firstPeriod.expected_income).toBeGreaterThan(40000);
    expect(firstPeriod.expected_expenses).toBeGreaterThan(15000);
    expect(firstPeriod.planned_contributions).toBe(3000);
    // Net Flow = Income - Expenses - Planned
    const expectedNet = Math.round((firstPeriod.expected_income - firstPeriod.expected_expenses - 3000) * 100) / 100;
    expect(Math.abs(firstPeriod.projected_net_cash_flow - expectedNet)).toBeLessThanOrEqual(1.0);
  });

  it('5. Forecast History & Audit Trail', async () => {
    const res = await request(app)
      .get('/api/v1/forecasts/history?limit=10')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.history.length).toBeGreaterThan(0);
    expect(res.body.data.history[0]).toHaveProperty('forecastType');
    expect(res.body.data.history[0]).toHaveProperty('generatedAt');
  });
});
