import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import {
  User,
  Session,
  AuditLog,
  Transaction,
  Category,
  CategoryType,
  RoleName,
} from '../src/models/index.js';
import { signAccessToken } from '../src/utils/token.js';

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_auth';

describe('Production-Grade Authentication & Authorization Integration Tests', () => {
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
      Session.deleteMany({}),
      AuditLog.deleteMany({}),
      Transaction.deleteMany({}),
      Category.deleteMany({}),
    ]);
  });

  describe('1. Registration & Validation', () => {
    it('should successfully register a new user and return tokens and cookies', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'alice@smartfin.ai',
          password: 'Password123!',
          firstName: 'Alice',
          lastName: 'Smith',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@smartfin.ai');
      expect(res.body.data.user.role).toBe(RoleName.USER);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.verificationToken).toBeDefined();

      // Verify Set-Cookie header contains HTTP-only cookies
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('access_token='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('refresh_token='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);

      // Verify audit log created
      const audit = await AuditLog.findOne({ action: 'AUTH_REGISTER' });
      expect(audit).not.toBeNull();
      expect(audit?.actorRole).toBe('USER');
    });

    it('should reject registration with weak password (missing special char or uppercase)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'weak@smartfin.ai',
          password: 'weakpassword',
          firstName: 'Weak',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@smartfin.ai',
          password: 'Password123!',
          firstName: 'First',
          lastName: 'User',
        });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@smartfin.ai',
          password: 'Password123!',
          firstName: 'Second',
          lastName: 'User',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('2. Login, Lockout & Failed Attempts Audit Logging', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'bob@smartfin.ai',
          password: 'Password123!',
          firstName: 'Bob',
          lastName: 'Jones',
        });
    });

    it('should successfully log in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@smartfin.ai',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('bob@smartfin.ai');
      expect(res.body.data.tokens.accessToken).toBeDefined();

      const audit = await AuditLog.findOne({ action: 'AUTH_LOGIN' });
      expect(audit).not.toBeNull();
      expect(audit?.status).toBe('SUCCESS');
    });

    it('should record failed authentication attempt on wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@smartfin.ai',
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');

      const failedAudit = await AuditLog.findOne({ action: 'AUTH_LOGIN_FAILED' });
      expect(failedAudit).not.toBeNull();
      expect(failedAudit?.status).toBe('FAILURE');
      expect(failedAudit?.failureReason).toContain('Invalid password');
    });

    it('should lock out account after 5 consecutive failed login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'bob@smartfin.ai',
            password: 'WrongPassword999!',
          });
      }

      // 6th attempt should be rejected with 403 Forbidden due to lockout
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@smartfin.ai',
          password: 'Password123!', // Even with correct password
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('locked');

      const lockedAudit = await AuditLog.findOne({ action: 'AUTH_LOGIN_LOCKED' });
      expect(lockedAudit).not.toBeNull();
    });
  });

  describe('3. Current User, Refresh Tokens & Logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'charlie@smartfin.ai',
          password: 'Password123!',
          firstName: 'Charlie',
          lastName: 'Brown',
        });

      accessToken = reg.body.data.tokens.accessToken;
      refreshToken = reg.body.data.tokens.refreshToken;
    });

    it('should return current user profile via GET /api/v1/auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('charlie@smartfin.ai');
      expect(res.body.data.user.firstName).toBe('Charlie');
    });

    it('should reject unauthenticated request to /api/v1/auth/me', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should rotate tokens via POST /api/v1/auth/refresh-token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).not.toBe(refreshToken);
    });

    it('should successfully log out and invalidate session', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .send();

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('logged out');

      // Refreshing with invalidated token should now fail
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .send();

      expect(refreshRes.status).toBe(401);

      // Verify logout audit log
      const audit = await AuditLog.findOne({ action: 'AUTH_LOGOUT' });
      expect(audit).not.toBeNull();
    });
  });

  describe('4. Password Change, Password Reset & Email Verification Architectures', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'diana@smartfin.ai',
          password: 'Password123!',
          firstName: 'Diana',
          lastName: 'Prince',
        });

      accessToken = reg.body.data.tokens.accessToken;
      userId = reg.body.data.user.id;
    });

    it('should allow user to change password and audit log the change', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword999!',
          confirmPassword: 'NewPassword999!',
        });

      expect(res.status).toBe(200);

      // Login with old password should fail
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'diana@smartfin.ai',
          password: 'Password123!',
        });
      expect(oldLogin.status).toBe(401);

      // Login with new password should succeed
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'diana@smartfin.ai',
          password: 'NewPassword999!',
        });
      expect(newLogin.status).toBe(200);

      // Check audit log
      const audit = await AuditLog.findOne({ action: 'AUTH_PASSWORD_CHANGE' });
      expect(audit).not.toBeNull();
    });

    it('should execute full password reset architecture', async () => {
      // 1. Request reset token
      const forgotRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'diana@smartfin.ai' });

      expect(forgotRes.status).toBe(200);
      const resetToken = forgotRes.body.data.resetToken;
      expect(resetToken).toBeDefined();

      // 2. Reset password using the token
      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'ResetPassword555!',
          confirmPassword: 'ResetPassword555!',
        });

      expect(resetRes.status).toBe(200);

      // 3. Login with reset password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'diana@smartfin.ai',
          password: 'ResetPassword555!',
        });

      expect(loginRes.status).toBe(200);
    });

    it('should execute email verification architecture', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'eva@smartfin.ai',
          password: 'Password123!',
          firstName: 'Eva',
          lastName: 'Mendez',
        });

      const verificationToken = regRes.body.data.verificationToken;
      expect(verificationToken).toBeDefined();

      // Verify email via endpoint
      const verifyRes = await request(app).get(`/api/v1/auth/verify-email/${verificationToken}`);
      expect(verifyRes.status).toBe(200);

      // Check DB
      const verifiedUser = await User.findOne({ email: 'eva@smartfin.ai' });
      expect(verifiedUser?.isEmailVerified).toBe(true);

      // Check audit log
      const audit = await AuditLog.findOne({ action: 'AUTH_EMAIL_VERIFIED' });
      expect(audit).not.toBeNull();
    });
  });

  describe('5. RBAC Middleware & Privileged Operations', () => {
    let userToken: string;
    let adminToken: string;

    beforeEach(async () => {
      // Register standard USER
      const userReg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'regular_user@smartfin.ai',
          password: 'Password123!',
          firstName: 'Regular',
          lastName: 'User',
          role: RoleName.USER,
        });
      userToken = userReg.body.data.tokens.accessToken;

      // Seed ADMIN user
      const adminUser = await User.create({
        email: 'admin_user@smartfin.ai',
        passwordHash: 'Password123!',
        firstName: 'Admin',
        lastName: 'System',
        role: RoleName.ADMIN,
        isEmailVerified: true,
      });
      adminToken = signAccessToken({
        userId: adminUser._id.toString(),
        email: adminUser.email,
        role: adminUser.role,
      });
    });

    it('should strictly deny normal USER from accessing admin APIs (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Access denied');

      // Verify audit log captured privileged access denial
      const deniedAudit = await AuditLog.findOne({ action: 'PRIVILEGED_ACCESS_DENIED' });
      expect(deniedAudit).not.toBeNull();
      expect(deniedAudit?.actorRole).toBe(RoleName.USER);
    });

    it('should allow ADMIN to access admin endpoints and view audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users).toBeDefined();
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);

      const auditRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.logs).toBeDefined();
    });
  });

  describe('6. User-Owned Resource Ownership & Authorization Attacks', () => {
    let userAToken: string;
    let userBToken: string;
    let userAId: string;
    let userBId: string;
    let userATransactionId: string;

    beforeEach(async () => {
      // User A
      const regA = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'usera@smartfin.ai',
          password: 'Password123!',
          firstName: 'User',
          lastName: 'A',
        });
      userAToken = regA.body.data.tokens.accessToken;
      userAId = regA.body.data.user.id;

      // User B (Attacker)
      const regB = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'userb@smartfin.ai',
          password: 'Password123!',
          firstName: 'User',
          lastName: 'B',
        });
      userBToken = regB.body.data.tokens.accessToken;
      userBId = regB.body.data.user.id;

      // Create category for transaction
      const testCategory = await Category.create({
        name: 'Hardware & Gear',
        slug: 'hardware-gear',
        type: CategoryType.EXPENSE,
        isSystem: true,
      });

      // User A creates a private transaction
      const txRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'EXPENSE',
          amount: 1450.75,
          currency: 'USD',
          merchant: 'Apple Store',
          description: 'MacBook Pro M3 Max for development',
          category: testCategory._id,
          date: new Date(),
        });

      expect(txRes.status).toBe(201);
      userATransactionId = txRes.body.data.transaction._id;
    });

    it('should allow User A to access their own transaction', async () => {
      const res = await request(app)
        .get(`/api/v1/transactions/${userATransactionId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transaction._id).toBe(userATransactionId);
      expect(res.body.data.transaction.merchant).toBe('Apple Store');
    });

    it('should thwart authorization attack: User B attempting to access User A transaction returns 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/transactions/${userATransactionId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      // Must be strictly forbidden
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('You do not have permission');

      // Verify that authorization attack was permanently logged in AuditLog
      const attackAudit = await AuditLog.findOne({
        action: 'AUTHORIZATION_ATTACK_DETECTED',
      });
      expect(attackAudit).not.toBeNull();
      expect(attackAudit?.userId?.toString()).toBe(userBId);
      expect(attackAudit?.resource).toBe('Transaction');
      expect(attackAudit?.resourceId).toBe(userATransactionId);
      expect(attackAudit?.failureReason).toContain(userAId);
    });

    it('should thwart authorization attack: User B attempting to delete User A transaction returns 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/v1/transactions/${userATransactionId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);

      // Verify transaction is not deleted in DB
      const tx = await Transaction.findById(userATransactionId);
      expect(tx).not.toBeNull();
      expect(tx?.isDeleted).toBe(false);
    });
  });

  describe('7. Device & Session Management', () => {
    let accessToken: string;
    let sessionId: string;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'device_user@smartfin.ai',
          password: 'Password123!',
          firstName: 'Device',
          lastName: 'Tester',
        });
      accessToken = reg.body.data.tokens.accessToken;
    });

    it('should retrieve active user sessions and allow revoking an individual session', async () => {
      const sessionsRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(sessionsRes.status).toBe(200);
      expect(sessionsRes.body.data.sessions.length).toBeGreaterThanOrEqual(1);

      sessionId = sessionsRes.body.data.sessions[0].id;
      expect(sessionId).toBeDefined();

      const revokeRes = await request(app)
        .delete(`/api/v1/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(revokeRes.status).toBe(200);

      // Session in DB should now be marked isValid = false
      const session = await Session.findById(sessionId);
      expect(session?.isValid).toBe(false);
    });
  });
});
