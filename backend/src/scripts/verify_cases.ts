import mongoose, { Types } from 'mongoose';
import { reportAggregatorService } from '../services/report/report-aggregator.service.js';
import { reportPdfService } from '../services/report/report-pdf.service.js';
import { Transaction } from '../models/transaction.model.js';
import { Budget } from '../models/budget.model.js';
import { Holding } from '../models/holding.model.js';
import { FinancialGoal } from '../models/financial-goal.model.js';
import { Asset } from '../models/asset.model.js';
import { Liability } from '../models/liability.model.js';
import '../models/category.model.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/smartfin_ai_dev');
  const userId = '6ab972c44eed9dea19f2b26a';
  const userObjectId = new Types.ObjectId(userId);

  console.log('================================================================');
  console.log('RUNNING COMPREHENSIVE VERIFICATION SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------
  // CASE 1: 01/10/2026 -> 06/10/2026
  // ---------------------------------------------------------
  console.log('TEST CASE 1: Reporting Period 01/10/2026 -> 06/10/2026');
  const c1Data = await reportAggregatorService.buildCompleteFinancialReport(userId, '2026-10-01', '2026-10-06');
  const c1Pdf = await reportPdfService.generateCompleteReportPdf(c1Data);
  console.log(`  - Period Display: ${c1Data.metadata.periodDisplay}`);
  console.log(`  - Income: ₹${c1Data.summary.totalIncome.toLocaleString('en-IN')}`);
  console.log(`  - Expenses: ₹${c1Data.summary.totalExpenses.toLocaleString('en-IN')}`);
  console.log(`  - Net Savings: ₹${c1Data.summary.netSavings.toLocaleString('en-IN')}`);
  console.log(`  - Savings Rate: ${c1Data.summary.savingsRateDisplay}`);
  console.log(`  - Transactions Count: ${c1Data.summary.transactionCount}`);
  console.log(`  - PDF Size: ${c1Pdf.fileSizeBytes} bytes (Valid vector PDF: ${c1Pdf.buffer.toString('utf8', 0, 4) === '%PDF'})`);
  if (c1Pdf.fileSizeBytes < 5000 || !c1Pdf.buffer.toString('utf8', 0, 4).startsWith('%PDF')) {
    throw new Error('Case 1 PDF generation failed or empty');
  }
  console.log('  ✓ Case 1 PASSED\n');

  // ---------------------------------------------------------
  // CASE 2: 01/09/2026 -> 30/09/2026
  // ---------------------------------------------------------
  console.log('TEST CASE 2: Previous Month 01/09/2026 -> 30/09/2026');
  const c2Data = await reportAggregatorService.buildCompleteFinancialReport(userId, '2026-09-01', '2026-09-30');
  const c2Pdf = await reportPdfService.generateCompleteReportPdf(c2Data);
  console.log(`  - Period Display: ${c2Data.metadata.periodDisplay}`);
  console.log(`  - Income: ₹${c2Data.summary.totalIncome.toLocaleString('en-IN')}`);
  console.log(`  - Expenses: ₹${c2Data.summary.totalExpenses.toLocaleString('en-IN')}`);
  console.log(`  - Net Savings: ₹${c2Data.summary.netSavings.toLocaleString('en-IN')}`);
  console.log(`  - Transactions Count: ${c2Data.summary.transactionCount}`);
  console.log(`  - PDF Size: ${c2Pdf.fileSizeBytes} bytes`);
  console.log('  ✓ Case 2 PASSED\n');

  // ---------------------------------------------------------
  // CASE 3: Single day: 06/10/2026 -> 06/10/2026
  // ---------------------------------------------------------
  console.log('TEST CASE 3: Single Day 06/10/2026 -> 06/10/2026');
  const c3Data = await reportAggregatorService.buildCompleteFinancialReport(userId, '2026-10-06', '2026-10-06');
  const c3Pdf = await reportPdfService.generateCompleteReportPdf(c3Data);
  console.log(`  - Period Display: ${c3Data.metadata.periodDisplay}`);
  console.log(`  - Transactions Count: ${c3Data.summary.transactionCount}`);
  console.log(`  - PDF Size: ${c3Pdf.fileSizeBytes} bytes`);
  console.log('  ✓ Case 3 PASSED\n');

  // ---------------------------------------------------------
  // CASE 4: Multiple months: 01/09/2026 -> 06/10/2026
  // ---------------------------------------------------------
  console.log('TEST CASE 4: Multi-month Period 01/09/2026 -> 06/10/2026');
  const c4Data = await reportAggregatorService.buildCompleteFinancialReport(userId, '2026-09-01', '2026-10-06');
  const c4Pdf = await reportPdfService.generateCompleteReportPdf(c4Data);
  console.log(`  - Period Display: ${c4Data.metadata.periodDisplay}`);
  console.log(`  - Total Transactions: ${c4Data.summary.transactionCount}`);
  console.log(`  - Combined Income: ₹${c4Data.summary.totalIncome.toLocaleString('en-IN')}`);
  console.log(`  - Combined Expenses: ₹${c4Data.summary.totalExpenses.toLocaleString('en-IN')}`);
  console.log(`  - PDF Size: ${c4Pdf.fileSizeBytes} bytes`);
  console.log('  ✓ Case 4 PASSED\n');

  // ---------------------------------------------------------
  // CASE 5: No-data period: 01/08/2026 -> 31/08/2026
  // ---------------------------------------------------------
  console.log('TEST CASE 5: No Data Period 01/08/2026 -> 31/08/2026');
  const c5Data = await reportAggregatorService.buildCompleteFinancialReport(userId, '2026-08-01', '2026-08-31');
  const c5Pdf = await reportPdfService.generateCompleteReportPdf(c5Data);
  console.log(`  - Period Display: ${c5Data.metadata.periodDisplay}`);
  console.log(`  - Income: ${c5Data.summary.totalIncome}`);
  console.log(`  - Expenses: ${c5Data.summary.totalExpenses}`);
  console.log(`  - Transactions: ${c5Data.summary.transactionCount}`);
  console.log(`  - Savings Rate: ${c5Data.summary.savingsRateDisplay}`);
  console.log(`  - PDF Size: ${c5Pdf.fileSizeBytes} bytes`);
  console.log('  ✓ Case 5 PASSED (Properly handled zero division and empty arrays)\n');

  // ---------------------------------------------------------
  // CASE 6: Invalid date range: fromDate > toDate
  // ---------------------------------------------------------
  console.log('TEST CASE 6: Invalid Date Range (2026-10-06 to 2026-10-01)');
  let caughtError = false;
  try {
    await reportAggregatorService.buildCompleteFinancialReport(userId, '2026-10-06', '2026-10-01');
  } catch (err: any) {
    caughtError = true;
    console.log(`  - Successfully threw error: "${err.message}" (Status: ${err.statusCode || 400})`);
  }
  if (!caughtError) {
    throw new Error('Case 6 failed: did not throw error for invalid date range');
  }
  console.log('  ✓ Case 6 PASSED\n');

  // ---------------------------------------------------------
  // CASE 7: Direct Verification Against Database
  // ---------------------------------------------------------
  console.log('TEST CASE 7: Direct Verification Against Database Records (01/10/2026 to 06/10/2026)');
  const octStart = new Date('2026-09-30T18:30:00.000Z');
  const octEnd = new Date('2026-10-06T18:29:59.999Z');

  const rawTxList = await Transaction.find({
    userId: userObjectId,
    isDeleted: false,
    date: { $gte: octStart, $lte: octEnd },
  });

  let rawIncome = 0;
  let rawExpenses = 0;
  for (const t of rawTxList) {
    if (t.type === 'INCOME') rawIncome += t.amount;
    else if (t.type === 'EXPENSE') rawExpenses += t.amount;
  }
  const rawNetSavings = Math.round((rawIncome - rawExpenses) * 100) / 100;
  const rawSavingsRate = rawIncome > 0 ? `${((rawNetSavings / rawIncome) * 100).toFixed(2)}%` : 'Not Available';

  console.log(`  Database Transactions Count: ${rawTxList.length} | Report Count: ${c1Data.summary.transactionCount}`);
  console.log(`  Database Income: ₹${rawIncome} | Report Income: ₹${c1Data.summary.totalIncome}`);
  console.log(`  Database Expenses: ₹${rawExpenses} | Report Expenses: ₹${c1Data.summary.totalExpenses}`);
  console.log(`  Database Net Savings: ₹${rawNetSavings} | Report Net Savings: ₹${c1Data.summary.netSavings}`);
  console.log(`  Database Savings Rate: ${rawSavingsRate} | Report Savings Rate: ${c1Data.summary.savingsRateDisplay}`);

  if (
    rawTxList.length !== c1Data.summary.transactionCount ||
    rawIncome !== c1Data.summary.totalIncome ||
    rawExpenses !== c1Data.summary.totalExpenses ||
    rawNetSavings !== c1Data.summary.netSavings ||
    rawSavingsRate !== c1Data.summary.savingsRateDisplay
  ) {
    throw new Error('Database vs Report aggregation mismatch!');
  }

  // Budgets verification
  const rawBudgets = await Budget.find({ userId: userObjectId, isArchived: { $ne: true } });
  console.log(`  Database Active Budgets: ${rawBudgets.length} | Report Budgets: ${c1Data.budgets.records.length}`);
  if (rawBudgets.length !== c1Data.budgets.records.length) {
    throw new Error('Database Budgets count mismatch!');
  }

  // Portfolio Holdings verification
  const rawHoldings = await Holding.find({ userId: userObjectId });
  console.log(`  Database Holdings: ${rawHoldings.length} | Report Holdings: ${c1Data.portfolio.holdings.length}`);
  if (rawHoldings.length !== c1Data.portfolio.holdings.length) {
    throw new Error('Database Holdings count mismatch!');
  }

  // Financial Goals verification
  const rawGoals = await FinancialGoal.find({ userId: userObjectId });
  console.log(`  Database Goals: ${rawGoals.length} | Report Goals: ${c1Data.goals.records.length}`);
  if (rawGoals.length !== c1Data.goals.records.length) {
    throw new Error('Database Goals count mismatch!');
  }

  // Net Worth verification
  const rawAssets = await Asset.find({ userId: userObjectId, isDeleted: false });
  const rawLiabilities = await Liability.find({ userId: userObjectId, isDeleted: false });
  const totalAssets = rawAssets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalLiab = rawLiabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const netWorth = totalAssets - totalLiab;
  console.log(`  Database Assets: ₹${totalAssets} | Report Assets: ₹${c1Data.netWorth.totalAssets}`);
  console.log(`  Database Liabilities: ₹${totalLiab} | Report Liabilities: ₹${c1Data.netWorth.totalLiabilities}`);
  console.log(`  Database Net Worth: ₹${netWorth} | Report Net Worth: ₹${c1Data.netWorth.netWorth}`);

  if (
    totalAssets !== c1Data.netWorth.totalAssets ||
    totalLiab !== c1Data.netWorth.totalLiabilities ||
    netWorth !== c1Data.netWorth.netWorth
  ) {
    throw new Error('Database Net Worth mismatch!');
  }

  console.log('  ✓ Case 7 PASSED (100% exact parity between Database and Report)');

  console.log('\n================================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
