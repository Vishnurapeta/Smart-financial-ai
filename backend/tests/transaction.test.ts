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
  TransactionSource,
} from '../src/models/index.js';

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_transactions';

describe('Transaction Management Module Integration Tests', () => {
  let userAToken: string;
  let userBToken: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;

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

    // Register User A
    const regA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alice.tx@smartfin.ai',
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Tx',
      });
    userAToken = regA.body.data.tokens.accessToken;

    // Register User B
    const regB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'bob.tx@smartfin.ai',
        password: 'Password123!',
        firstName: 'Bob',
        lastName: 'Tx',
      });
    userBToken = regB.body.data.tokens.accessToken;

    // Seed Categories
    const incCat = await Category.create({
      name: 'Salary & Compensation',
      slug: 'salary-comp',
      type: CategoryType.INCOME,
      icon: 'briefcase',
      color: '#10B981',
      isSystem: true,
    });
    incomeCategoryId = incCat._id.toString();

    const expCat = await Category.create({
      name: 'Food & Dining',
      slug: 'food-dining',
      type: CategoryType.EXPENSE,
      icon: 'coffee',
      color: '#F59E0B',
      isSystem: true,
    });
    expenseCategoryId = expCat._id.toString();
  });

  describe('1. Add Income & Add Expense', () => {
    it('should successfully add an income transaction with all fields', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 6500.5,
          type: TransactionType.INCOME,
          merchant: 'Google LLC',
          description: 'Senior Software Engineer Bi-Weekly Payroll',
          category: incomeCategoryId,
          subcategory: 'Base Salary',
          date: '2026-09-15T09:00:00.000Z',
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          currency: 'USD',
          notes: 'Direct deposit into primary checking account',
          tags: ['payroll', 'tech', 'salary'],
          source: TransactionSource.MANUAL,
          recurring: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe(6500.5);
      expect(res.body.data.transaction.type).toBe('INCOME');
      expect(res.body.data.transaction.merchant).toBe('Google LLC');
      expect(res.body.data.transaction.isRecurring).toBe(true);
      expect(res.body.data.transaction.category.name).toBe('Salary & Compensation');
      expect(res.body.data.transaction.tags).toEqual(['payroll', 'tech', 'salary']);
    });

    it('should successfully add an expense transaction', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 45.8,
          type: TransactionType.EXPENSE,
          merchant: 'Whole Foods Market',
          description: 'Weekly organic groceries',
          category: expenseCategoryId,
          date: '2026-09-16T18:30:00.000Z',
          paymentMethod: PaymentMethod.CREDIT_CARD,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.transaction.amount).toBe(45.8);
      expect(res.body.data.transaction.type).toBe('EXPENSE');
      expect(res.body.data.transaction.merchant).toBe('Whole Foods Market');
    });

    it('should reject transaction creation with invalid amount (<= 0)', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: -10,
          type: TransactionType.EXPENSE,
          merchant: 'Test Invalid',
          category: expenseCategoryId,
          date: new Date(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should reject transaction creation if referenced category does not exist', async () => {
      const fakeCategoryId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 100,
          type: TransactionType.EXPENSE,
          merchant: 'Store',
          category: fakeCategoryId,
          date: new Date(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('category');
    });
  });

  describe('2. Querying, Search, Filtering, Sorting & Backend Calculations', () => {
    beforeEach(async () => {
      // Seed 4 transactions for User A
      await Promise.all([
        request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            amount: 5000,
            type: TransactionType.INCOME,
            merchant: 'Acme Corp',
            description: 'Consulting Contract Payment',
            category: incomeCategoryId,
            date: '2026-09-01T10:00:00.000Z',
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            notes: 'Invoice #1042',
            tags: ['consulting'],
          }),
        request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            amount: 120,
            type: TransactionType.EXPENSE,
            merchant: 'Starbucks Coffee',
            description: 'Team coffee meetings',
            category: expenseCategoryId,
            date: '2026-09-05T08:30:00.000Z',
            paymentMethod: PaymentMethod.DEBIT_CARD,
            tags: ['coffee', 'dining'],
          }),
        request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            amount: 350,
            type: TransactionType.EXPENSE,
            merchant: 'Delta Airlines',
            description: 'Flight to FinTech Conference',
            category: expenseCategoryId,
            date: '2026-09-10T14:00:00.000Z',
            paymentMethod: PaymentMethod.CREDIT_CARD,
            notes: 'Business travel expense',
            isRecurring: false,
          }),
        request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            amount: 15,
            type: TransactionType.EXPENSE,
            merchant: 'Netflix Subscription',
            description: 'Premium 4K streaming plan',
            category: expenseCategoryId,
            date: '2026-09-15T00:00:00.000Z',
            paymentMethod: PaymentMethod.CREDIT_CARD,
            isRecurring: true,
            notes: 'Monthly recurring subscription',
          }),
      ]);
    });

    it('should calculate accurate financial summaries using backend aggregation', async () => {
      const res = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(4);

      // Verify business logic calculation:
      // Income = 5000
      // Expense = 120 + 350 + 15 = 485
      // Net Cash Flow = 5000 - 485 = 4515
      const { summary } = res.body.data;
      expect(summary.totalIncome).toBe(5000);
      expect(summary.totalExpense).toBe(485);
      expect(summary.netCashFlow).toBe(4515);
      expect(summary.transactionCount).toBe(4);
    });

    it('should search transactions by keyword across merchant, description, and notes', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?search=coffee')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(1);
      expect(res.body.data.transactions[0].merchant).toBe('Starbucks Coffee');
    });

    it('should filter transactions by type (INCOME vs EXPENSE)', async () => {
      const incomeRes = await request(app)
        .get('/api/v1/transactions?type=INCOME')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(incomeRes.status).toBe(200);
      expect(incomeRes.body.data.transactions.length).toBe(1);
      expect(incomeRes.body.data.transactions[0].amount).toBe(5000);
      expect(incomeRes.body.data.summary.totalIncome).toBe(5000);
      expect(incomeRes.body.data.summary.totalExpense).toBe(0);

      const expenseRes = await request(app)
        .get('/api/v1/transactions?type=EXPENSE')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(expenseRes.status).toBe(200);
      expect(expenseRes.body.data.transactions.length).toBe(3);
      expect(expenseRes.body.data.summary.totalExpense).toBe(485);
    });

    it('should filter transactions by payment method', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?paymentMethod=CREDIT_CARD')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(2);
      expect(res.body.data.transactions.every((t: any) => t.paymentMethod === 'CREDIT_CARD')).toBe(true);
    });

    it('should filter transactions by date range', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?startDate=2026-09-04&endDate=2026-09-12')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(2); // Starbucks (Sept 5) & Delta (Sept 10)
    });

    it('should filter transactions by amount range', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?minAmount=100&maxAmount=1000')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(2); // 120 and 350
    });

    it('should filter transactions by recurring flag', async () => {
      const res = await request(app)
        .get('/api/v1/transactions?recurring=true')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(1);
      expect(res.body.data.transactions[0].merchant).toBe('Netflix Subscription');
    });

    it('should sort transactions by amount ascending and descending', async () => {
      const ascRes = await request(app)
        .get('/api/v1/transactions?sortBy=amount&sortOrder=asc')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(ascRes.status).toBe(200);
      expect(ascRes.body.data.transactions[0].amount).toBe(15);
      expect(ascRes.body.data.transactions[3].amount).toBe(5000);

      const descRes = await request(app)
        .get('/api/v1/transactions?sortBy=amount&sortOrder=desc')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(descRes.status).toBe(200);
      expect(descRes.body.data.transactions[0].amount).toBe(5000);
      expect(descRes.body.data.transactions[3].amount).toBe(15);
    });

    it('should paginate transactions correctly', async () => {
      const page1 = await request(app)
        .get('/api/v1/transactions?limit=2&page=1')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data.transactions.length).toBe(2);
      expect(page1.body.data.pagination.page).toBe(1);
      expect(page1.body.data.pagination.limit).toBe(2);
      expect(page1.body.data.pagination.total).toBe(4);
      expect(page1.body.data.pagination.totalPages).toBe(2);

      const page2 = await request(app)
        .get('/api/v1/transactions?limit=2&page=2')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.data.transactions.length).toBe(2);
      expect(page2.body.data.pagination.page).toBe(2);
    });
  });

  describe('3. Edit, Delete & Authorization Attack Prevention', () => {
    let createdTxId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 250,
          type: TransactionType.EXPENSE,
          merchant: 'Best Buy',
          description: 'External SSD',
          category: expenseCategoryId,
          date: new Date(),
        });

      createdTxId = createRes.body.data.transaction._id;
    });

    it('should successfully get transaction details via GET /api/v1/transactions/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/transactions/${createdTxId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transaction._id).toBe(createdTxId);
      expect(res.body.data.transaction.merchant).toBe('Best Buy');
      expect(res.body.data.transaction.category.name).toBe('Food & Dining');
    });

    it('should successfully edit a transaction via PUT /api/v1/transactions/:id', async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${createdTxId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 220.99,
          merchant: 'Best Buy Outlet',
          notes: 'Discount coupon applied',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.transaction.amount).toBe(220.99);
      expect(res.body.data.transaction.merchant).toBe('Best Buy Outlet');
      expect(res.body.data.transaction.notes).toBe('Discount coupon applied');

      // Verify persistence in DB
      const dbTx = await Transaction.findById(createdTxId);
      expect(dbTx?.amount).toBe(220.99);
      expect(dbTx?.merchant).toBe('Best Buy Outlet');
    });

    it('should thwart attack: User B cannot edit User A transaction', async () => {
      const res = await request(app)
        .put(`/api/v1/transactions/${createdTxId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          amount: 999999,
          merchant: 'Hacked Store',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');

      // Verify document in DB was NOT changed
      const dbTx = await Transaction.findById(createdTxId);
      expect(dbTx?.amount).toBe(250);
      expect(dbTx?.merchant).toBe('Best Buy');
    });

    it('should successfully soft-delete a transaction via DELETE /api/v1/transactions/:id', async () => {
      const res = await request(app)
        .delete(`/api/v1/transactions/${createdTxId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);

      // Verify transaction no longer appears in user query
      const listRes = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(listRes.body.data.transactions.length).toBe(0);

      // In DB, it is soft-deleted
      const dbTx = await Transaction.findById(createdTxId);
      expect(dbTx?.isDeleted).toBe(true);
    });

    it('should thwart attack: User B cannot delete User A transaction', async () => {
      const res = await request(app)
        .delete(`/api/v1/transactions/${createdTxId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);

      const dbTx = await Transaction.findById(createdTxId);
      expect(dbTx?.isDeleted).toBe(false);
    });
  });

  describe('4. Category Retrieval', () => {
    it('should retrieve available categories via GET /api/v1/categories', async () => {
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.categories.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.categories.some((c: any) => c.name === 'Salary & Compensation')).toBe(true);
      expect(res.body.data.categories.some((c: any) => c.name === 'Food & Dining')).toBe(true);
    });
  });
});
