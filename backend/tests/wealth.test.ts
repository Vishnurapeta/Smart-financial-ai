import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User, FinancialGoal, Asset, Liability, NetWorthSnapshot } from '../src/models/index.js';

describe('Financial Goals, Assets, Liabilities & Net Worth Tests', () => {
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartfin_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    await FinancialGoal.deleteMany({ userId });
    await Asset.deleteMany({ userId });
    await Liability.deleteMany({ userId });
    await NetWorthSnapshot.deleteMany({ userId });
    await User.deleteMany({ email: 'wealth_test@smartfin.ai' });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Setup test user
    await User.deleteMany({ email: 'wealth_test@smartfin.ai' });
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'wealth_test@smartfin.ai',
        password: 'Password123!',
        firstName: 'Wealth',
        lastName: 'Tester',
      });

    userToken = regRes.body.data.tokens.accessToken;
    userId = regRes.body.data.user.id;

    await FinancialGoal.deleteMany({ userId });
    await Asset.deleteMany({ userId });
    await Liability.deleteMany({ userId });
    await NetWorthSnapshot.deleteMany({ userId });
  });

  describe('1. Financial Goals Calculation & API', () => {
    it('should create a goal and compute progress & required monthly contribution accurately', async () => {
      // Set target date 10 months in the future
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + 10);

      const res = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Emergency Fund',
          targetAmount: 100000,
          currentAmount: 20000,
          targetDate: targetDate.toISOString(),
          category: 'EMERGENCY_FUND',
          priority: 'HIGH',
        });

      expect(res.status).toBe(201);
      const goal = res.body.data.goal;
      expect(goal.title).toBe('Emergency Fund');
      expect(goal.targetAmount).toBe(100000);
      expect(goal.currentAmount).toBe(20000);
      // Progress calculation: 20000 / 100000 = 20%
      expect(goal.progressPercentage).toBe(20);
      // Remaining: 80000, across ~10 months => ~8000 / month
      expect(goal.remainingAmount).toBe(80000);
      expect(goal.monthsRemaining).toBeGreaterThanOrEqual(9);
      expect(goal.monthsRemaining).toBeLessThanOrEqual(11);
      expect(goal.requiredMonthlyContribution).toBeCloseTo(8000, -2);
      expect(goal.isAchieved).toBe(false);
    });

    it('should handle goal contributions and mark achieved when target is met', async () => {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + 6);

      const createRes = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Vacation Fund',
          targetAmount: 50000,
          currentAmount: 10000,
          targetDate: targetDate.toISOString(),
          category: 'TRAVEL',
        });

      const goalId = createRes.body.data.goal.id;

      // Add contribution of 40000
      const contribRes = await request(app)
        .post(`/api/v1/goals/${goalId}/contribute`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 40000,
          notes: 'Bonus allocation',
        });

      expect(contribRes.status).toBe(200);
      const updatedGoal = contribRes.body.data.goal;
      expect(updatedGoal.currentAmount).toBe(50000);
      expect(updatedGoal.progressPercentage).toBe(100);
      expect(updatedGoal.remainingAmount).toBe(0);
      expect(updatedGoal.requiredMonthlyContribution).toBe(0);
      expect(updatedGoal.status).toBe('ACHIEVED');
      expect(updatedGoal.isAchieved).toBe(true);
    });

    it('should edit and delete financial goals', async () => {
      const targetDate = new Date();
      targetDate.setFullYear(targetDate.getFullYear() + 1);

      const createRes = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Old Bike Fund',
          targetAmount: 30000,
          currentAmount: 5000,
          targetDate: targetDate.toISOString(),
          category: 'OTHER',
        });

      const goalId = createRes.body.data.goal.id;

      // Update goal
      const updateRes = await request(app)
        .put(`/api/v1/goals/${goalId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Electric Scooter Fund',
          targetAmount: 40000,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.goal.title).toBe('Electric Scooter Fund');
      expect(updateRes.body.data.goal.targetAmount).toBe(40000);

      // Delete goal
      const deleteRes = await request(app)
        .delete(`/api/v1/goals/${goalId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(deleteRes.status).toBe(200);

      // Verify not found
      const getRes = await request(app)
        .get(`/api/v1/goals/${goalId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(getRes.status).toBe(404);
    });
  });

  describe('2. Assets & Liabilities Management', () => {
    it('should create assets in each category bucket and group them properly', async () => {
      // 1. Cash
      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Emergency Cash in Locker',
          type: 'CASH',
          value: 15000,
          institution: 'Home',
        });

      // 2. Bank Balance
      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'HDFC Savings Account',
          type: 'BANK_ACCOUNT',
          value: 125000,
          institution: 'HDFC Bank',
          accountNumber: 'XXXX1234',
        });

      // 3. Investments
      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Nifty 50 Index Fund',
          type: 'INVESTMENT',
          value: 200000,
          institution: 'Zerodha',
        });

      // 4. Other Assets
      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Royal Enfield Motorcycle',
          type: 'VEHICLE',
          value: 160000,
        });

      const listRes = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.assets.length).toBe(4);
    });

    it('should create liabilities in each bucket and compute total liabilities', async () => {
      // 1. Loans
      await request(app)
        .post('/api/v1/liabilities')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'SBI Education Loan',
          type: 'STUDENT_LOAN',
          totalAmount: 200000,
          remainingAmount: 150000,
          interestRate: 8.5,
          monthlyPayment: 5000,
        });

      // 2. Credit Card Debt
      await request(app)
        .post('/api/v1/liabilities')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'ICICI Amazon Pay Credit Card',
          type: 'CREDIT_CARD',
          totalAmount: 35000,
          remainingAmount: 25000,
          interestRate: 36,
          minimumPayment: 2500,
        });

      // 3. Other Liabilities
      await request(app)
        .post('/api/v1/liabilities')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Personal Borrowing from Family',
          type: 'OTHER',
          totalAmount: 20000,
          remainingAmount: 15000,
        });

      const listRes = await request(app)
        .get('/api/v1/liabilities')
        .set('Authorization', `Bearer ${userToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.liabilities.length).toBe(3);
    });
  });

  describe('3. Net Worth Calculation & Historical Snapshots', () => {
    it('should calculate Net Worth = Total Assets - Total Liabilities accurately with breakdowns', async () => {
      // Assets: Cash (20k) + Bank (80k) + Investments (100k) + Other (50k) = 250k
      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Cash', type: 'CASH', value: 20000 });

      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Salary Account', type: 'BANK_ACCOUNT', value: 80000 });

      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Mutual Funds', type: 'INVESTMENT', value: 100000 });

      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Gold Coins', type: 'PRECIOUS_METALS', value: 50000 });

      // Liabilities: Loans (40k) + Credit Card (10k) = 50k
      await request(app)
        .post('/api/v1/liabilities')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Personal Loan', type: 'PERSONAL_LOAN', remainingAmount: 40000 });

      await request(app)
        .post('/api/v1/liabilities')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Credit Card', type: 'CREDIT_CARD', remainingAmount: 10000 });

      const netWorthRes = await request(app)
        .get('/api/v1/net-worth')
        .set('Authorization', `Bearer ${userToken}`);

      expect(netWorthRes.status).toBe(200);
      const nw = netWorthRes.body.data;
      expect(nw.totalAssets).toBe(250000);
      expect(nw.totalLiabilities).toBe(50000);
      // Net worth = 250,000 - 50,000 = 200,000
      expect(nw.netWorth).toBe(200000);

      // Check category breakdown
      expect(nw.assetBreakdown.cash).toBe(20000);
      expect(nw.assetBreakdown.bankBalance).toBe(80000);
      expect(nw.assetBreakdown.investments).toBe(150000); // 100k mutual fund + 50k precious metals
      expect(nw.assetBreakdown.otherAssets).toBe(0);

      expect(nw.liabilityBreakdown.loans).toBe(40000);
      expect(nw.liabilityBreakdown.creditCardDebt).toBe(10000);
      expect(nw.liabilityBreakdown.otherLiabilities).toBe(0);

      // Check financial ratios: Debt to Asset = 50,000 / 250,000 = 20%
      expect(nw.debtToAssetRatio).toBe(20);
    });

    it('should create historical net-worth snapshots and retrieve time-series history', async () => {
      // Create asset of 100k
      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Fixed Deposit', type: 'INVESTMENT', value: 100000 });

      // Create snapshot #1
      const snap1 = await request(app)
        .post('/api/v1/net-worth/snapshot')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notes: 'Snapshot 1' });

      expect(snap1.status).toBe(201);
      expect(snap1.body.data.snapshot.netWorth).toBe(100000);

      // Add asset 50k more
      await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Cash Bonus', type: 'CASH', value: 50000 });

      // Create snapshot #2 with historical date (e.g. yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const snap2 = await request(app)
        .post('/api/v1/net-worth/snapshot')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          snapshotDate: yesterday.toISOString(),
          notes: 'Snapshot yesterday',
        });

      expect(snap2.status).toBe(201);

      // Fetch history
      const historyRes = await request(app)
        .get('/api/v1/net-worth/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.snapshots.length).toBeGreaterThanOrEqual(2);
      expect(historyRes.body.data.current.netWorth).toBe(150000);
    });
  });
});
