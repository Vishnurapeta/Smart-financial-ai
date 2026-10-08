import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { performance } from 'perf_hooks';
import { User } from '../models/user.model.js';
import { Transaction, TransactionType, PaymentMethod, TransactionSource } from '../models/transaction.model.js';
import { Category, CategoryType } from '../models/category.model.js';
import { Budget, BudgetPeriod } from '../models/budget.model.js';
import { Portfolio } from '../models/portfolio.model.js';
import { Holding, HoldingAssetType } from '../models/holding.model.js';
import { TransactionService } from '../services/transaction.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { PortfolioService } from '../services/portfolio.service.js';
import { AdminMetricsService } from '../services/admin/admin-metrics.service.js';
import { reportPdfService } from '../services/report/report-pdf.service.js';
import { MonthlyReportSnapshot } from '../services/report/report-aggregator.service.js';
import { cacheService } from '../config/redis.js';

async function runBenchmark() {
  console.log('=== STARTING PERFORMANCE BENCHMARK BASELINE ===');
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // 1. Seed Categories & User
  const user = await User.create({
    email: 'bench@smartfin.ai',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    firstName: 'Bench',
    lastName: 'User',
    role: 'USER',
    isEmailVerified: true,
  });
  const userId = user._id.toString();

  const category = await Category.create({
    name: 'Food & Dining',
    slug: 'food-dining',
    type: CategoryType.EXPENSE,
    icon: 'utensils',
    color: '#EF4444',
    isSystem: true,
  });

  // 2. Seed 500 Transactions
  const transactionsData = [];
  const now = Date.now();
  for (let i = 0; i < 500; i++) {
    const isIncome = i % 5 === 0;
    transactionsData.push({
      userId: user._id,
      type: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
      amount: Math.round((Math.random() * 200 + 10) * 100) / 100,
      currency: 'USD',
      merchant: `Merchant ${i % 20}`,
      description: `Benchmark transaction #${i}`,
      category: category._id,
      date: new Date(now - i * 3600 * 1000 * 12),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      source: TransactionSource.MANUAL,
      isDeleted: false,
    });
  }
  await Transaction.insertMany(transactionsData);

  // 3. Seed Budget
  await Budget.create({
    userId: user._id,
    categoryId: category._id,
    name: 'Monthly Dining',
    amount: 1500,
    period: BudgetPeriod.MONTHLY,
    startDate: new Date(now - 15 * 86400000),
    endDate: new Date(now + 15 * 86400000),
    isDeleted: false,
  });

  // 4. Seed Portfolio & Holdings
  const portfolio = await Portfolio.create({
    userId: user._id,
    name: 'Bench Portfolio',
    baseCurrency: 'USD',
    cashBalance: 5000,
    isDefault: true,
  });

  const holdingSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY'];
  for (const sym of holdingSymbols) {
    await Holding.create({
      portfolioId: portfolio._id,
      userId: user._id,
      symbol: sym,
      assetType: HoldingAssetType.EQUITY,
      quantity: 10,
      averageBuyPrice: 150,
      currentPrice: 165,
      isDeleted: false,
    });
  }

  console.log(`Database seeded with 1 user, 1 category, 500 transactions, 1 budget, 1 portfolio, and ${holdingSymbols.length} holdings.`);

  // BENCHMARK 1: Transaction Query & Pagination
  const txRuns: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await TransactionService.getTransactions(userId, { page: 1, limit: 20 });
    txRuns.push(performance.now() - start);
  }
  const avgTx = txRuns.reduce((a, b) => a + b, 0) / txRuns.length;
  console.log(`[MEASUREMENT] TransactionService.getTransactions (page 1, limit 20): avg = ${avgTx.toFixed(2)}ms (min: ${Math.min(...txRuns).toFixed(2)}ms, max: ${Math.max(...txRuns).toFixed(2)}ms)`);

  // BENCHMARK 2: Analytics Dashboard Aggregation (10 parallel aggregation pipelines)
  const analyticsRuns: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await AnalyticsService.getDashboardAnalytics(userId);
    analyticsRuns.push(performance.now() - start);
  }
  const avgAnalytics = analyticsRuns.reduce((a, b) => a + b, 0) / analyticsRuns.length;
  console.log(`[MEASUREMENT] AnalyticsService.getDashboardAnalytics (10 pipelines): avg = ${avgAnalytics.toFixed(2)}ms (min: ${Math.min(...analyticsRuns).toFixed(2)}ms, max: ${Math.max(...analyticsRuns).toFixed(2)}ms)`);

  // BENCHMARK 3: Portfolio Dashboard (Holdings marked-to-market & predictions)
  const portfolioService = PortfolioService.getInstance();
  const portfolioRuns: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await portfolioService.getPortfolioDashboard(userId, portfolio._id.toString());
    portfolioRuns.push(performance.now() - start);
  }
  const avgPortfolio = portfolioRuns.reduce((a, b) => a + b, 0) / portfolioRuns.length;
  console.log(`[MEASUREMENT] PortfolioService.getPortfolioDashboard (${holdingSymbols.length} holdings): avg = ${avgPortfolio.toFixed(2)}ms (min: ${Math.min(...portfolioRuns).toFixed(2)}ms, max: ${Math.max(...portfolioRuns).toFixed(2)}ms)`);

  // BENCHMARK 4: Admin Platform Overview (6 countDocuments across collections)
  const adminRuns: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await AdminMetricsService.getPlatformOverview();
    adminRuns.push(performance.now() - start);
  }
  const avgAdmin = adminRuns.reduce((a, b) => a + b, 0) / adminRuns.length;
  console.log(`[MEASUREMENT] AdminMetricsService.getPlatformOverview (16 count operations): avg = ${avgAdmin.toFixed(2)}ms (min: ${Math.min(...adminRuns).toFixed(2)}ms, max: ${Math.max(...adminRuns).toFixed(2)}ms)`);

  // BENCHMARK 5: Report Aggregation & PDF Generation
  const { reportAggregatorService } = await import('../services/report/report-aggregator.service.js');
  const snapshotStart = performance.now();
  const snapshot = await reportAggregatorService.buildMonthlySnapshot(userId, 2026, 9);
  const snapshotDuration = performance.now() - snapshotStart;
  console.log(`[MEASUREMENT] reportAggregatorService.buildMonthlySnapshot: duration = ${snapshotDuration.toFixed(2)}ms`);

  const pdfRuns: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    await reportPdfService.generatePdf(new Types.ObjectId().toString(), snapshot);
    pdfRuns.push(performance.now() - start);
  }
  const avgPdf = pdfRuns.reduce((a, b) => a + b, 0) / pdfRuns.length;
  console.log(`[MEASUREMENT] reportPdfService.generatePdf (Multi-page PDF): avg = ${avgPdf.toFixed(2)}ms (min: ${Math.min(...pdfRuns).toFixed(2)}ms, max: ${Math.max(...pdfRuns).toFixed(2)}ms)`);

  // BENCHMARK 6: Cache Service Latency
  const cacheRuns: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await cacheService.set(`bench:key:${i}`, { foo: 'bar', idx: i }, 60);
    await cacheService.get(`bench:key:${i}`);
    cacheRuns.push(performance.now() - start);
  }
  const avgCache = cacheRuns.reduce((a, b) => a + b, 0) / cacheRuns.length;
  console.log(`[MEASUREMENT] CacheService (set + get roundtrip): avg = ${avgCache.toFixed(3)}ms (min: ${Math.min(...cacheRuns).toFixed(3)}ms, max: ${Math.max(...cacheRuns).toFixed(3)}ms)`);

  console.log('=== BENCHMARK BASELINE COMPLETE ===');
  await mongoose.disconnect();
  await mongoServer.stop();
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
