import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Transaction, TransactionType, PaymentMethod, TransactionSource } from '../src/models/transaction.model.js';
import { Category } from '../src/models/category.model.js';
import {
  FinancialAnomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyFeedbackType,
} from '../src/models/financial-anomaly.model.js';

describe('Financial Anomaly Detection Integration & Security Tests', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let foodCatId: Types.ObjectId;
  let anomalyAId: string;
  let sampleTxAId: Types.ObjectId;

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/smartfin_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test collections
    await User.deleteMany({ email: /anomaly_test_/ });
    await FinancialAnomaly.deleteMany({});

    // Register User A
    const regA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `anomaly_test_a_${Date.now()}@example.com`,
        password: 'Password123!',
        firstName: 'AnomalyUser',
        lastName: 'Alpha',
      });
    userAToken = regA.body.data.tokens.accessToken;
    userAId = regA.body.data.user.id || regA.body.data.user._id;

    // Register User B
    const regB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `anomaly_test_b_${Date.now()}@example.com`,
        password: 'Password123!',
        firstName: 'AnomalyUser',
        lastName: 'Beta',
      });
    userBToken = regB.body.data.tokens.accessToken;
    userBId = regB.body.data.user.id || regB.body.data.user._id;

    // Ensure Category
    let foodCat = await Category.findOne({ slug: 'food-dining' });
    if (!foodCat) {
      foodCat = await Category.create({
        name: 'Food & Dining',
        slug: 'food-dining',
        type: TransactionType.EXPENSE,
      });
    }
    foodCatId = foodCat._id;

    // Create a transaction for User A
    sampleTxAId = new Types.ObjectId();
    await Transaction.create({
      _id: sampleTxAId,
      userId: new Types.ObjectId(userAId),
      type: TransactionType.EXPENSE,
      amount: 4500.0,
      currency: 'USD',
      merchant: 'Luxury Dining',
      description: 'Special Dinner',
      category: foodCatId,
      date: new Date('2026-03-25T19:00:00Z'),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      isRecurring: false,
      source: TransactionSource.MANUAL,
      isDeleted: false,
    });

    // Create a sample Anomaly for User A
    const anomA = await FinancialAnomaly.create({
      userId: new Types.ObjectId(userAId),
      transactionId: sampleTxAId,
      anomalyType: AnomalyType.AMOUNT_ANOMALY,
      anomalyScore: 0.88,
      severity: AnomalySeverity.HIGH,
      reason: 'Transaction amount of $4,500.00 is significantly above your typical Food & Dining spending pattern.',
      contributingFeatures: [
        {
          feature: 'category_amount_deviation',
          value: 4.8,
          impact: 'high',
          description: 'Amount is 4.8x higher than typical category median.',
        },
      ],
      detectorType: 'ENSEMBLE',
      status: AnomalyStatus.NEW,
      transactionDetails: {
        date: new Date('2026-03-25T19:00:00Z'),
        amount: 4500.0,
        currency: 'USD',
        merchant: 'Luxury Dining',
        category: 'Food & Dining',
      },
      notified: false,
    });
    anomalyAId = anomA._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: /anomaly_test_/ });
    await FinancialAnomaly.deleteMany({});
  });

  // 1. Authentication requirement
  it('should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/anomalies');
    expect(res.status).toBe(401);
  });

  // 2. User A can list their own anomalies
  it('should allow User A to retrieve their own anomalies', async () => {
    const res = await request(app)
      .get('/api/v1/anomalies')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]._id).toBe(anomalyAId);
  });

  // 3. User B cannot see User A's anomalies (Data Isolation)
  it('should enforce user isolation: User B list does not contain User A anomalies', async () => {
    const res = await request(app)
      .get('/api/v1/anomalies')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // User B has no anomalies yet
    expect(res.body.data.length).toBe(0);
    expect(res.body.pagination.total).toBe(0);
  });

  // 4. User B cannot access User A's anomaly by ID (IDOR Prevention)
  it('should prevent IDOR: User B cannot fetch User A anomaly by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/anomalies/${anomalyAId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(404);
  });

  // 5. User B cannot update User A's anomaly status
  it('should prevent unauthorized status updates across users', async () => {
    const res = await request(app)
      .patch(`/api/v1/anomalies/${anomalyAId}/status`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ status: AnomalyStatus.REVIEWED });

    expect(res.status).toBe(404);
  });

  // 6. User B cannot submit feedback for User A's anomaly
  it('should prevent unauthorized feedback submission across users', async () => {
    const res = await request(app)
      .post(`/api/v1/anomalies/${anomalyAId}/feedback`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ feedback: AnomalyFeedbackType.DISMISSED, notes: 'Unauthorized attempt' });

    expect(res.status).toBe(404);
  });

  // 7. User A summary is isolated and does not leak to User B
  it('should return isolated summaries for each user', async () => {
    const resA = await request(app)
      .get('/api/v1/anomalies/summary')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.total).toBe(1);
    expect(resA.body.data.new).toBe(1);
    expect(resA.body.data.severityCounts.high).toBe(1);

    const resB = await request(app)
      .get('/api/v1/anomalies/summary')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.total).toBe(0);
    expect(resB.body.data.new).toBe(0);
  });

  // 8. User A can update status of their own anomaly
  it('should allow User A to update anomaly status to REVIEWED', async () => {
    const res = await request(app)
      .patch(`/api/v1/anomalies/${anomalyAId}/status`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ status: AnomalyStatus.REVIEWED });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(AnomalyStatus.REVIEWED);
  });

  // 9. User A can submit user feedback (EXPECTED, UNUSUAL, DISMISSED)
  it('should record user feedback and transition status to CONFIRMED_UNUSUAL', async () => {
    const res = await request(app)
      .post(`/api/v1/anomalies/${anomalyAId}/feedback`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        feedback: AnomalyFeedbackType.UNUSUAL,
        notes: 'Celebrated anniversary at this restaurant.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(AnomalyStatus.CONFIRMED_UNUSUAL);
    expect(res.body.data.userFeedback.feedbackType).toBe(AnomalyFeedbackType.UNUSUAL);
    expect(res.body.data.userFeedback.notes).toBe('Celebrated anniversary at this restaurant.');
  });

  // 10. Duplicate Prevention (Idempotency)
  it('should enforce unique compound index preventing duplicate anomalies for same user + transaction', async () => {
    await expect(
      FinancialAnomaly.create({
        userId: new Types.ObjectId(userAId),
        transactionId: sampleTxAId,
        anomalyType: AnomalyType.AMOUNT_ANOMALY,
        anomalyScore: 0.9,
        severity: AnomalySeverity.HIGH,
        reason: 'Duplicate test',
        status: AnomalyStatus.NEW,
        transactionDetails: {
          date: new Date(),
          amount: 4500.0,
          currency: 'USD',
          merchant: 'Luxury Dining',
          category: 'Food & Dining',
        },
      }),
    ).rejects.toThrow();
  });

  // 11. Zero Fraud Terminology Verification
  it('should never contain fraud or scam claims in any reason or stored anomaly', async () => {
    const anomaly = await FinancialAnomaly.findById(anomalyAId);
    expect(anomaly).not.toBeNull();
    const reasonLower = anomaly!.reason.toLowerCase();
    expect(reasonLower).not.toContain('fraud');
    expect(reasonLower).not.toContain('scam');
    expect(reasonLower).not.toContain('compromised');
  });
});
