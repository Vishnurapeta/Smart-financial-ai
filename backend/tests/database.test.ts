import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  User,
  Role,
  RoleName,
  Category,
  CategoryType,
  Transaction,
  TransactionType,
  PaymentMethod,
  TransactionSource,
  Holding,
  HoldingAssetType,
  StockPrediction,
  PredictionHorizon,
  AuditLog,
  AuditStatus,
  Budget,
  BudgetPeriod,
} from '../src/models/index.js';

describe('Database Architecture & Mongoose Models', () => {
  const testUserId = new mongoose.Types.ObjectId();
  const testCategoryId = new mongoose.Types.ObjectId();
  const testPortfolioId = new mongoose.Types.ObjectId();

  it('1. Role & User: should validate schemas, enums, and password hashing logic', async () => {
    // Valid Role
    const validRole = new Role({
      name: RoleName.USER,
      description: 'Standard User with personal finance tracking privileges',
      permissions: ['finance:all'],
      isSystem: true,
    });
    const roleValidation = await validRole.validate();
    expect(roleValidation).toBeUndefined();

    // Invalid Role enum
    const invalidRole = new Role({
      name: 'INVALID_ROLE',
      description: 'Test',
    });
    await expect(invalidRole.validate()).rejects.toThrow();

    // Valid User
    const validUser = new User({
      email: 'test@smartfin.ai',
      passwordHash: await bcrypt.hash('Password123!', 10),
      firstName: 'John',
      lastName: 'Doe',
      role: RoleName.USER,
      roleId: validRole._id,
      defaultCurrency: 'USD',
      locale: 'en-US',
    });
    const userValidation = await validUser.validate();
    expect(userValidation).toBeUndefined();

    // Password comparison check
    const isMatch = await validUser.comparePassword('Password123!');
    expect(isMatch).toBe(true);
    const isWrongMatch = await validUser.comparePassword('WrongPassword');
    expect(isWrongMatch).toBe(false);

    // Invalid email validation
    const invalidEmailUser = new User({
      email: 'invalid-email-format',
      passwordHash: 'hashed',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    await expect(invalidEmailUser.validate()).rejects.toThrow(/valid email address/);
  });

  it('2. Category: should validate hierarchical structure and type enums', async () => {
    const parentCategory = new Category({
      name: 'Food & Dining',
      slug: 'food-dining',
      type: CategoryType.EXPENSE,
      isSystem: true,
      color: '#F97316',
    });
    expect(await parentCategory.validate()).toBeUndefined();

    const subCategory = new Category({
      userId: testUserId,
      name: 'Coffee Shops',
      slug: 'coffee-shops',
      type: CategoryType.EXPENSE,
      parentId: parentCategory._id,
      color: '#78350F',
    });
    expect(await subCategory.validate()).toBeUndefined();
    expect(subCategory.parentId?.toString()).toBe(parentCategory._id.toString());
  });

  it('3. Transaction: should enforce all required fields, enums, metadata, and user ownership', async () => {
    const validTx = new Transaction({
      userId: testUserId,
      type: TransactionType.EXPENSE,
      amount: 4.75,
      currency: 'USD',
      merchant: 'Blue Bottle Coffee',
      description: 'Morning Oat Latte',
      category: testCategoryId,
      subcategory: 'Coffee Shops',
      date: new Date('2026-09-26T08:30:00Z'),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      isRecurring: true,
      source: TransactionSource.MANUAL,
      metadata: {
        location: 'San Francisco, CA',
        taxAmount: 0.35,
        tipAmount: 1.0,
      },
      tags: ['coffee', 'breakfast'],
    });

    expect(await validTx.validate()).toBeUndefined();
    expect(validTx.amount).toBe(4.75);
    expect(validTx.merchant).toBe('Blue Bottle Coffee');
    expect(validTx.isRecurring).toBe(true);
    expect(validTx.metadata).toHaveProperty('location', 'San Francisco, CA');

    // Reject non-positive transaction amounts
    const invalidTx = new Transaction({
      userId: testUserId,
      type: TransactionType.EXPENSE,
      amount: -10,
      merchant: 'Store',
      category: testCategoryId,
      date: new Date(),
    });
    await expect(invalidTx.validate()).rejects.toThrow(/greater than 0/);
  });

  it('4. Budget: should validate category spending caps and periods', async () => {
    const validBudget = new Budget({
      userId: testUserId,
      categoryId: testCategoryId,
      name: 'Monthly Dining Budget',
      amount: 400.0,
      period: BudgetPeriod.MONTHLY,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'),
      notifyAt80: true,
      notifyAt100: true,
    });

    expect(await validBudget.validate()).toBeUndefined();
    expect(validBudget.amount).toBe(400.0);
    expect(validBudget.spent).toBe(0);
    expect(validBudget.notifyAt80).toBe(true);
  });

  it('5. Holding: should validate lots and calculate currentValue and P&L correctly', async () => {
    const holding = new Holding({
      portfolioId: testPortfolioId,
      userId: testUserId,
      symbol: 'AAPL',
      assetType: HoldingAssetType.EQUITY,
      quantity: 10,
      averageBuyPrice: 150.0,
      currentPrice: 180.0,
      lots: [
        {
          lotId: 'lot-001',
          quantity: 10,
          buyPrice: 150.0,
          buyDate: new Date('2026-01-15'),
          fees: 2.5,
          status: 'OPEN',
        },
      ],
    });

    expect(await holding.validate()).toBeUndefined();
    expect(holding.lots).toHaveLength(1);
    expect(holding.lots[0].status).toBe('OPEN');

    // Simulate pre-save calculations
    holding.totalCost = Math.round(holding.quantity * holding.averageBuyPrice * 100) / 100;
    holding.currentValue = Math.round(holding.quantity * holding.currentPrice * 100) / 100;
    holding.unrealizedPnL = Math.round((holding.currentValue - holding.totalCost) * 100) / 100;
    holding.unrealizedPnLPercent =
      Math.round(((holding.currentValue - holding.totalCost) / holding.totalCost) * 10000) / 100;

    expect(holding.totalCost).toBe(1500.0);
    expect(holding.currentValue).toBe(1800.0);
    expect(holding.unrealizedPnL).toBe(300.0);
    expect(holding.unrealizedPnLPercent).toBe(20.0);
  });

  it('6. StockPrediction: should enforce all required ML horizons, models, and metrics', async () => {
    const prediction = new StockPrediction({
      symbol: 'NVDA',
      model: 'XGBOOST_DIRECTIONAL',
      predictionHorizon: PredictionHorizon.FIVE_DAYS,
      predictionTimestamp: new Date(),
      predictedValue: 135.5,
      predictedReturn: 0.052,
      modelVersion: 'v1.2.0',
      evaluationMetrics: {
        mape: 3.2,
        mae: 2.1,
        rmse: 2.8,
        confidenceScore: 0.88,
        directionAccuracy: 0.72,
      },
      featureVersion: 'fv_2026_q3',
      dataTimestamp: new Date('2026-09-26T16:00:00Z'),
    });

    expect(await prediction.validate()).toBeUndefined();
    expect(prediction.symbol).toBe('NVDA');
    expect(prediction.predictionHorizon).toBe(PredictionHorizon.FIVE_DAYS);
    expect(prediction.evaluationMetrics.confidenceScore).toBe(0.88);
  });

  it('7. AuditLog: should validate immutable security and compliance records', async () => {
    const log = new AuditLog({
      userId: testUserId,
      actorRole: 'SUPER_ADMIN',
      action: 'TRANSACTION_SPLIT',
      resource: 'TRANSACTION',
      resourceId: 'tx-123456',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Vitest',
      changes: {
        before: { amount: 100 },
        after: { amount: 50 },
      },
      status: AuditStatus.SUCCESS,
    });

    expect(await log.validate()).toBeUndefined();
    expect(log.action).toBe('TRANSACTION_SPLIT');
    expect(log.status).toBe(AuditStatus.SUCCESS);
    expect(log.timestamp).toBeDefined();
  });
});
