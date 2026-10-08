import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User, Category, CategoryType, CategorizationFeedback } from '../src/models/index.js';
import { MLService } from '../src/services/ml.service.js';

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_ml';

describe('AI-Powered Transaction Categorization Integration Tests', () => {
  let userToken: string;
  let diningCatId: string;
  let transportCatId: string;
  let subscriptionsCatId: string;
  let salaryCatId: string;

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
      Category.deleteMany({}),
      CategorizationFeedback.deleteMany({}),
    ]);

    // Register test user
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'ai.tester@smartfin.ai',
        password: 'Password123!',
        firstName: 'AI',
        lastName: 'Tester',
      });
    userToken = reg.body.data.tokens.accessToken;

    // Seed system categories in database
    const [c1, c2, c3, c4] = await Promise.all([
      Category.create({
        name: 'Dining & Restaurants',
        slug: 'dining-restaurants',
        type: CategoryType.EXPENSE,
        icon: 'utensils',
        color: '#F97316',
        isSystem: true,
      }),
      Category.create({
        name: 'Transportation & Fuel',
        slug: 'transportation-fuel',
        type: CategoryType.EXPENSE,
        icon: 'car',
        color: '#6366F1',
        isSystem: true,
      }),
      Category.create({
        name: 'Subscriptions & Software',
        slug: 'subscriptions-software',
        type: CategoryType.EXPENSE,
        icon: 'repeat',
        color: '#A855F7',
        isSystem: true,
      }),
      Category.create({
        name: 'Salary & Wages',
        slug: 'salary-wages',
        type: CategoryType.INCOME,
        icon: 'dollar-sign',
        color: '#10B981',
        isSystem: true,
      }),
    ]);

    diningCatId = c1._id.toString();
    transportCatId = c2._id.toString();
    subscriptionsCatId = c3._id.toString();
    salaryCatId = c4._id.toString();
  });

  it('1. Categorize "Monthly Netflix subscription ₹649" -> Expense, 649, INR, Netflix, Subscriptions', async () => {
    const res = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        text: 'Monthly Netflix subscription ₹649',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.amount).toBe(649);
    expect(data.currency).toBe('INR');
    expect(data.merchant).toBe('Netflix');
    expect(data.category.slug).toBe('subscriptions-software');
    expect(data.category.id).toBe(subscriptionsCatId);
    expect(data.categorySlug).toBe('subscriptions-software');
    expect(data.categoryId).toBe(subscriptionsCatId);
    expect(data.predictedCategory).toBe('Subscriptions & Software');
    expect(data.transactionType).toBe('EXPENSE');
    expect(data.confidence).toBeGreaterThanOrEqual(0.75);
    expect(data.requiresConfirmation).toBe(false);
  });

  it('2. Categorize "Spent ₹500 at Swiggy" -> Expense, 500, INR, Swiggy, Food', async () => {
    const res = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        text: 'Spent ₹500 at Swiggy',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.amount).toBe(500);
    expect(data.currency).toBe('INR');
    expect(data.merchant).toBe('Swiggy');
    expect(data.category.slug).toBe('dining-restaurants');
    expect(data.category.id).toBe(diningCatId);
    expect(data.transactionType).toBe('EXPENSE');
  });

  it('3. Categorize "Received salary ₹50,000" -> Income, 50000, INR, Salary category', async () => {
    const res = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        text: 'Received salary ₹50,000',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.amount).toBe(50000);
    expect(data.currency).toBe('INR');
    expect(data.category.slug).toBe('salary-wages');
    expect(data.category.id).toBe(salaryCatId);
    expect(data.transactionType).toBe('INCOME');
  });

  it('4. Categorize "Uber ride ₹350" -> Expense, 350, INR, Uber, Transportation', async () => {
    const res = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        text: 'Uber ride ₹350',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.amount).toBe(350);
    expect(data.currency).toBe('INR');
    expect(data.merchant).toBe('Uber');
    expect(data.category.slug).toBe('transportation-fuel');
    expect(data.category.id).toBe(transportCatId);
    expect(data.transactionType).toBe('EXPENSE');
  });

  it('5. Categorize "Netflix subscription $15" -> Expense, 15, USD, Netflix, Subscriptions', async () => {
    const res = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        text: 'Netflix subscription $15',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.amount).toBe(15);
    expect(data.currency).toBe('USD');
    expect(data.merchant).toBe('Netflix');
    expect(data.category.slug).toBe('subscriptions-software');
    expect(data.transactionType).toBe('EXPENSE');
  });

  it('6 & 7. Reject empty and whitespace-only text with clear validation errors', async () => {
    const emptyRes = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ text: '' });
    expect(emptyRes.status).toBe(400);

    const wsRes = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ text: '    ' });
    expect(wsRes.status).toBe(400);
  });

  it('8. Input with no amount requires confirmation with clear explanation', async () => {
    const res = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        text: 'Dinner with colleagues at local restaurant',
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.amount).toBeNull();
    expect(data.requiresConfirmation).toBe(true);
    expect(data.explanation).toBeDefined();
    expect(data.explanation.toLowerCase()).toContain('amount');
  });

  it('9 & 10. Unknown merchant and unusual input handles safely without crashing', async () => {
    const res = await request(app)
      .post('/api/v1/ml/categorize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        text: 'Paid ₹999 at MysteryVendor999 for miscellaneous item',
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.amount).toBe(999);
    expect(data.currency).toBe('INR');
    expect(data.merchant).toBeDefined();
    expect(typeof data.merchant).toBe('string');
  });

  it('11. Heuristic fallback unit tests for resilient parsing when ML service is offline', () => {
    // Test heuristic parser directly
    const r1 = MLService.heuristicFallback('Monthly Netflix subscription ₹649');
    expect(r1.amount).toBe(649);
    expect(r1.currency).toBe('INR');
    expect(r1.merchant).toBe('Netflix');
    expect(r1.category).toBe('subscriptions-software');

    const r2 = MLService.heuristicFallback('Received salary ₹50,000');
    expect(r2.amount).toBe(50000);
    expect(r2.currency).toBe('INR');
    expect(r2.transaction_type).toBe('INCOME');
    expect(r2.category).toBe('salary-wages');

    const r3 = MLService.heuristicFallback('Spent ₹500 at Swiggy');
    expect(r3.amount).toBe(500);
    expect(r3.currency).toBe('INR');
    expect(r3.merchant).toBe('Swiggy');
    expect(r3.category).toBe('dining-restaurants');

    // Unusual / missing inputs should not throw
    const r4 = MLService.heuristicFallback('');
    expect(r4.amount).toBeNull();
    expect(r4.requires_confirmation).toBe(true);

    const r5 = MLService.heuristicFallback('Random gibberish text without numbers');
    expect(r5.amount).toBeNull();
    expect(r5.requires_confirmation).toBe(true);
  });

  it('12. Store user feedback and corrections without schema validation failure', async () => {
    const feedbackPayload = {
      rawText: 'Paid 300 to local driver',
      parsedAmount: 300,
      parsedCurrency: 'INR',
      parsedMerchant: 'Local Driver',
      predictedCategorySlug: 'shopping-retail',
      predictedCategory: 'Shopping & Retail',
      confidence: 0.65,
      requiresConfirmation: true,
      userAccepted: false,
      correctedCategorySlug: 'transportation-fuel',
      correctedCategoryId: transportCatId,
      source: 'user_correction',
      modelVersion: '1.0.0',
    };

    const res = await request(app)
      .post('/api/v1/ml/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send(feedbackPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const stored = await CategorizationFeedback.findOne({
      rawText: 'Paid 300 to local driver',
    });
    expect(stored).not.toBeNull();
    expect(stored?.userAccepted).toBe(false);
    expect(stored?.correctedCategorySlug).toBe('transportation-fuel');
    expect(stored?.correctedCategoryId?.toString()).toBe(transportCatId);
  });
});
