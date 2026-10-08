import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { RoleName } from '../src/models/role.model.js';
import { AuditLog, AuditStatus } from '../src/models/audit-log.model.js';
import { AIQuery, AIQueryIntent, AIQueryFeedback } from '../src/models/ai-query.model.js';
import { CategorizationFeedback } from '../src/models/categorization-feedback.model.js';
import { NotificationDelivery, DeliveryStatus } from '../src/models/notification-delivery.model.js';
import { Notification, NotificationChannel, NotificationType, NotificationSeverity, NotificationPriority } from '../src/models/notification.model.js';
import { AuthService } from '../src/services/auth.service.js';
import { signAccessToken } from '../src/utils/token.js';

describe('Production Admin Dashboard & Administration System Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof createApp>;

  let adminUser: InstanceType<typeof User>;
  let adminToken: string;

  let superAdminUser: InstanceType<typeof User>;
  let superAdminToken: string;

  let regularUser: InstanceType<typeof User>;
  let regularUserToken: string;

  let targetUser: InstanceType<typeof User>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    app = createApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await AuditLog.deleteMany({});
    await AIQuery.deleteMany({});
    await CategorizationFeedback.deleteMany({});
    await Notification.deleteMany({});
    await NotificationDelivery.deleteMany({});

    // Seed test users
    adminUser = await User.create({
      email: 'admin@smartfin.ai',
      passwordHash: 'AdminSecurePass123!',
      firstName: 'Admin',
      lastName: 'Officer',
      role: RoleName.ADMIN,
      isEmailVerified: true,
      defaultCurrency: 'USD',
    });

    adminToken = signAccessToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
    });

    superAdminUser = await User.create({
      email: 'superadmin@smartfin.ai',
      passwordHash: 'SuperSecurePass123!',
      firstName: 'Super',
      lastName: 'Administrator',
      role: RoleName.SUPER_ADMIN,
      isEmailVerified: true,
      defaultCurrency: 'USD',
    });

    superAdminToken = signAccessToken({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.email,
      role: superAdminUser.role,
    });

    regularUser = await User.create({
      email: 'user@smartfin.ai',
      passwordHash: 'UserSecurePass123!',
      firstName: 'Regular',
      lastName: 'Trader',
      role: RoleName.USER,
      isEmailVerified: true,
      defaultCurrency: 'USD',
    });

    regularUserToken = signAccessToken({
      userId: regularUser._id.toString(),
      email: regularUser.email,
      role: regularUser.role,
    });

    targetUser = await User.create({
      email: 'target@smartfin.ai',
      passwordHash: 'TargetPass123!',
      firstName: 'Target',
      lastName: 'Client',
      role: RoleName.USER,
      isEmailVerified: false,
      defaultCurrency: 'USD',
    });
  });

  describe('1. RBAC & Security Guarding', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/metrics/overview');
      expect(res.status).toBe(401);
    });

    it('rejects regular USER with 403 Forbidden and writes audit log', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics/overview')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      const deniedLog = await AuditLog.findOne({
        userId: regularUser._id,
        action: 'PRIVILEGED_ACCESS_DENIED',
        status: AuditStatus.FAILURE,
      });
      expect(deniedLog).toBeDefined();
      expect(deniedLog?.actorRole).toBe(RoleName.USER);
    });

    it('allows ADMIN and SUPER_ADMIN users to access admin routes', async () => {
      const resAdmin = await request(app)
        .get('/api/v1/admin/metrics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);

      const resSuper = await request(app)
        .get('/api/v1/admin/metrics/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(resSuper.status).toBe(200);
      expect(resSuper.body.success).toBe(true);
    });
  });

  describe('2. Metrics & Telemetry Services', () => {
    it('returns platform overview metrics correctly', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.total).toBe(4);
      expect(res.body.data.users.pendingVerification).toBe(1); // targetUser
      expect(res.body.data.domainTotals).toBeDefined();
      expect(res.body.data.security).toBeDefined();
    });

    it('returns system health information including MongoDB and Node stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBeDefined();
      expect(res.body.data.node.memory.rssMb).toBeGreaterThan(0);
      expect(res.body.data.databases.mongodb.status).toBe('CONNECTED');
    });

    it('returns queue monitoring structure with job depths', async () => {
      const res = await request(app)
        .get('/api/v1/admin/queues')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(5);
      const queueNames = res.body.data.map((q: { name: string }) => q.name);
      expect(queueNames).toContain('stock-alert-evaluation');
      expect(queueNames).toContain('financial-report-processing');
    });

    it('returns feature metrics (ML, AI Assistant, Stock API, Notifications)', async () => {
      // Seed some AI queries and feedback
      await AIQuery.create({
        userId: regularUser._id,
        sessionId: 'test-session-1',
        prompt: 'How to save for retirement?',
        intent: AIQueryIntent.GENERAL_FINANCE,
        response: 'Start early with compound interest.',
        tokensUsed: 150,
        latencyMs: 320,
        feedback: AIQueryFeedback.HELPFUL,
      });

      await CategorizationFeedback.create({
        userId: regularUser._id,
        rawText: 'Starbucks Coffee',
        predictedCategorySlug: 'food-dining',
        confidence: 0.95,
        userAccepted: true,
      });

      const res = await request(app)
        .get('/api/v1/admin/metrics/features')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.aiAssistant.totalQueries).toBe(1);
      expect(res.body.data.aiAssistant.totalTokensUsed).toBe(150);
      expect(res.body.data.aiAssistant.feedbackBreakdown.helpful).toBe(1);
      expect(res.body.data.ml.categorization.totalFeedback).toBe(1);
      expect(res.body.data.stockApi.activeProvider).toBeDefined();
    });

    it('returns API telemetry and error monitoring statistics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics/telemetry')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRequests).toBeGreaterThanOrEqual(1);
      expect(res.body.data.statusCodes).toBeDefined();
      expect(Array.isArray(res.body.data.recentErrors)).toBe(true);
    });

    it('returns security posture and incident statistics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics/security')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lockedAccountsCount).toBe(0);
      expect(res.body.data.suspendedAccountsCount).toBe(0);
      expect(Array.isArray(res.body.data.recentSecurityIncidents)).toBe(true);
    });
  });

  describe('3. User Management & Least Privilege', () => {
    it('lists users with pagination, role filter, and least privilege projection', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10&role=USER')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBe(2); // regularUser & targetUser
      expect(res.body.data.pagination.total).toBe(2);

      const firstUser = res.body.data.users[0];
      expect(firstUser.email).toBeDefined();
      expect(firstUser.status).toBeDefined();
      // Ensure no password hashes or secret tokens leak
      expect((firstUser as Record<string, unknown>).passwordHash).toBeUndefined();
      expect((firstUser as Record<string, unknown>).mfaSecret).toBeUndefined();
      // Principle of least privilege: no individual transaction items in list
      expect((firstUser as Record<string, unknown>).transactions).toBeUndefined();
    });

    it('searches users by email or name', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=target')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBe(1);
      expect(res.body.data.users[0].email).toBe('target@smartfin.ai');
    });

    it('gets user details without exposing sensitive financial transaction line items', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${targetUser._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(targetUser._id.toString());
      expect(res.body.data.summaryStats).toBeDefined();
      expect(res.body.data.summaryStats.budgetCount).toBe(0);
      // Ensure no transactions array is exposed
      expect((res.body.data as Record<string, unknown>).transactions).toBeUndefined();
    });

    it('suspends an account and prevents subsequent login', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'SUSPEND',
          reason: 'Terms of service violation',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.isSuspended).toBe(true);
      expect(res.body.data.user.suspendedReason).toBe('Terms of service violation');

      // Verify audit log recorded
      const log = await AuditLog.findOne({
        resourceId: targetUser._id.toString(),
        action: 'ADMIN_USER_STATUS_SUSPEND',
      });
      expect(log).toBeDefined();

      // Attempt login with suspended account
      await expect(
        AuthService.login({
          email: targetUser.email,
          password: 'TargetPass123!',
        }),
      ).rejects.toThrow(/suspended/i);
    });

    it('reactivates a suspended user account', async () => {
      // First suspend
      targetUser.isSuspended = true;
      targetUser.suspendedReason = 'Manual suspension';
      await targetUser.save();

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'REACTIVATE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.isSuspended).toBe(false);

      // Verify user can now log in
      const loginRes = await AuthService.login({
        email: targetUser.email,
        password: 'TargetPass123!',
      });
      expect(loginRes.user.id).toBe(targetUser._id.toString());
    });

    it('locks and unlocks an account', async () => {
      // Lock
      const lockRes = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'LOCK' });

      expect(lockRes.status).toBe(200);
      expect(lockRes.body.data.user.lockoutUntil).toBeDefined();

      // Unlock
      const unlockRes = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'UNLOCK' });

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body.data.user.lockoutUntil).toBeUndefined();
    });

    it('prevents an admin from suspending their own account', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'SUSPEND' });

      expect(res.status).toBe(403);
    });
  });

  describe('4. Role & Permission Management', () => {
    it('allows ADMIN to update a USER role to FINANCIAL_ANALYST', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id.toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: RoleName.FINANCIAL_ANALYST });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(RoleName.FINANCIAL_ANALYST);

      const log = await AuditLog.findOne({
        resourceId: targetUser._id.toString(),
        action: 'PRIVILEGED_USER_ROLE_UPDATED',
      });
      expect(log).toBeDefined();
    });

    it('prevents ADMIN from elevating a user to SUPER_ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id.toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: RoleName.SUPER_ADMIN });

      expect(res.status).toBe(403);
    });

    it('allows SUPER_ADMIN to elevate a user to SUPER_ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id.toString()}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: RoleName.SUPER_ADMIN });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(RoleName.SUPER_ADMIN);
    });

    it('prevents admin from altering their own role', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser._id.toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: RoleName.USER });

      expect(res.status).toBe(403);
    });
  });

  describe('5. Audit Logs Trail & Administrative Actions', () => {
    it('manually verifies a user email and records audit log', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUser._id.toString()}/verify-email`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const refreshed = await User.findById(targetUser._id);
      expect(refreshed?.isEmailVerified).toBe(true);

      const log = await AuditLog.findOne({
        action: 'ADMIN_MANUAL_EMAIL_VERIFIED',
        resourceId: targetUser._id.toString(),
      });
      expect(log).toBeDefined();
    });

    it('triggers administrative password reset and returns temporary token', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUser._id.toString()}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.resetToken).toBeDefined();

      const log = await AuditLog.findOne({
        action: 'ADMIN_TRIGGERED_PASSWORD_RESET',
        resourceId: targetUser._id.toString(),
      });
      expect(log).toBeDefined();
    });

    it('lists audit logs with filtering and returns stats', async () => {
      await AuditLog.create({
        actorRole: RoleName.ADMIN,
        action: 'ADMIN_TEST_ACTION',
        resource: 'Test',
        status: AuditStatus.SUCCESS,
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
      });

      const resLogs = await request(app)
        .get('/api/v1/admin/audit-logs?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resLogs.status).toBe(200);
      expect(Array.isArray(resLogs.body.data.logs)).toBe(true);
      expect(resLogs.body.data.pagination).toBeDefined();

      const resStats = await request(app)
        .get('/api/v1/admin/audit-logs/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resStats.status).toBe(200);
      expect(resStats.body.data.totalLogs).toBeGreaterThan(0);
      expect(resStats.body.data.topActions.length).toBeGreaterThan(0);
    });
  });
});
