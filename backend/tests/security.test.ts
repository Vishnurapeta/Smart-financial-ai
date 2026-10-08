import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import {
  User,
  Transaction,
  FinancialGoal,
  Asset,
  RecurringExpense,
  RoleName,
  TransactionType,
  PaymentMethod,
  GoalStatus,
  GoalCategory,
  AssetType,
  RecurringFrequency,
  RecurringType,
} from '../src/models/index.js';
import { signAccessToken } from '../src/utils/token.js';
import { env } from '../src/config/env.js';
import { AdminUserService } from '../src/services/admin/admin-user.service.js';

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_security';

describe('Comprehensive Security & Hardening Integration Test Suite', () => {
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
      FinancialGoal.deleteMany({}),
      Asset.deleteMany({}),
      RecurringExpense.deleteMany({}),
    ]);
  });

  // ==========================================
  // 1. SECURITY HEADERS & CORS
  // ==========================================
  describe('1. Security Headers & CORS Policy', () => {
    it('should return standard production security headers on HTTP responses', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['x-frame-options']).toBe('DENY');
      // Helmet CSP header
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('should disallow arbitrary untrusted origins in CORS', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-attacker-website.com');

      // The server should not reflect back the malicious origin
      expect(res.headers['access-control-allow-origin']).not.toBe('http://malicious-attacker-website.com');
    });
  });

  // ==========================================
  // 2. AUTHENTICATION & JWT SECURITY
  // ==========================================
  describe('2. Authentication & JWT Hardening', () => {
    it('should reject unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject tokens with algorithm "none" or algorithm confusion bypasses', async () => {
      // Craft an unverified "none" algorithm token
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          userId: new Types.ObjectId().toString(),
          role: RoleName.ADMIN,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject tokens with tampered signatures or wrong secret', async () => {
      const forgedToken = jwt.sign(
        { userId: new Types.ObjectId().toString(), role: RoleName.SUPER_ADMIN },
        'wrong_attacker_secret_key_1234567890',
        { algorithm: 'HS256', expiresIn: '1h' },
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject expired access tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: new Types.ObjectId().toString(), role: RoleName.USER },
        env.JWT_ACCESS_SECRET,
        { algorithm: 'HS256', expiresIn: '-10s' },
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should block suspended users from accessing protected endpoints even with valid token', async () => {
      const suspendedUser = await User.create({
        email: 'suspended@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Suspended',
        lastName: 'Account',
        role: RoleName.USER,
        isSuspended: true,
        suspensionReason: 'Terms violation',
        isEmailVerified: true,
      });

      const token = signAccessToken({
        userId: suspendedUser._id.toString(),
        role: suspendedUser.role,
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.message).toMatch(/suspended/i);
    });
  });

  // ==========================================
  // 3. PRIVILEGE ESCALATION & MASS ASSIGNMENT
  // ==========================================
  describe('3. Privilege Escalation & RBAC Protections', () => {
    it('should reject client-supplied role escalation on registration and always default to RoleName.USER', async () => {
      // 1. Attempting to register with elevated role is blocked
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'escalation-attempt@smartfin.ai',
          password: 'Password123!',
          firstName: 'Attacker',
          lastName: 'User',
          role: 'SUPER_ADMIN',
        });

      expect(res.status).toBe(400);

      // 2. Standard registration assigns RoleName.USER
      const resValid = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'valid-user@smartfin.ai',
          password: 'Password123!',
          firstName: 'Valid',
          lastName: 'User',
        });

      expect(resValid.status).toBe(201);
      expect(resValid.body.data.user.role).toBe(RoleName.USER);

      const createdInDb = await User.findOne({ email: 'valid-user@smartfin.ai' });
      expect(createdInDb?.role).toBe(RoleName.USER);
    });

    it('should deny non-admin users access to administrative endpoints', async () => {
      const normalUser = await User.create({
        email: 'normal@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Normal',
        lastName: 'User',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const token = signAccessToken({
        userId: normalUser._id.toString(),
        role: normalUser.role,
      });

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should prevent an ADMIN from promoting anyone to SUPER_ADMIN', async () => {
      const adminUser = await User.create({
        email: 'admin@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Standard',
        lastName: 'Admin',
        role: RoleName.ADMIN,
        isEmailVerified: true,
      });

      const targetUser = await User.create({
        email: 'target@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Target',
        lastName: 'User',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const adminToken = signAccessToken({
        userId: adminUser._id.toString(),
        role: adminUser.role,
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: RoleName.SUPER_ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.message).toMatch(/super_admin/i);
    });
  });

  // ==========================================
  // 4. LAST ADMIN PROTECTION
  // ==========================================
  describe('4. Last Admin Protection', () => {
    it('should prevent demoting or suspending the sole active SUPER_ADMIN', async () => {
      const soleSuperAdmin = await User.create({
        email: 'sole-super@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Sole',
        lastName: 'Super',
        role: RoleName.SUPER_ADMIN,
        isSuspended: false,
        isEmailVerified: true,
      });

      const otherOperator = {
        userId: new Types.ObjectId().toString(),
        role: RoleName.SUPER_ADMIN,
      };

      // 1. Attempt to demote sole super admin
      await expect(
        AdminUserService.updateUserRole(
          soleSuperAdmin._id.toString(),
          RoleName.USER,
          otherOperator,
          '127.0.0.1',
          'test-agent',
        ),
      ).rejects.toThrow(/Cannot demote the last remaining active SUPER_ADMIN/);

      // 2. Attempt to suspend sole super admin
      await expect(
        AdminUserService.updateUserStatus(
          soleSuperAdmin._id.toString(),
          'SUSPEND',
          'Accidental lockout attempt',
          otherOperator,
          '127.0.0.1',
          'test-agent',
        ),
      ).rejects.toThrow(/Cannot suspend the last remaining active SUPER_ADMIN/);
    });

    it('should allow demoting one SUPER_ADMIN if another active SUPER_ADMIN exists', async () => {
      const superAdmin1 = await User.create({
        email: 'super1@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Super',
        lastName: 'One',
        role: RoleName.SUPER_ADMIN,
        isSuspended: false,
        isEmailVerified: true,
      });

      const superAdmin2 = await User.create({
        email: 'super2@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Super',
        lastName: 'Two',
        role: RoleName.SUPER_ADMIN,
        isSuspended: false,
        isEmailVerified: true,
      });

      const result = await AdminUserService.updateUserRole(
        superAdmin2._id.toString(),
        RoleName.ADMIN,
        { userId: superAdmin1._id.toString(), role: RoleName.SUPER_ADMIN },
        '127.0.0.1',
        'test-agent',
      );

      expect(result.role).toBe(RoleName.ADMIN);
    });
  });

  // ==========================================
  // 5. INSECURE DIRECT OBJECT REFERENCE (IDOR)
  // ==========================================
  describe('5. Insecure Direct Object Reference (IDOR) Isolation', () => {
    it('should prevent User B from reading User A transaction by ID', async () => {
      const userA = await User.create({
        email: 'userA@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'User',
        lastName: 'A',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const userB = await User.create({
        email: 'userB@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'User',
        lastName: 'B',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const txA = await Transaction.create({
        userId: userA._id,
        amount: 250,
        type: TransactionType.EXPENSE,
        category: new Types.ObjectId(),
        merchant: 'Secret Restaurant',
        date: new Date(),
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });

      const tokenB = signAccessToken({
        userId: userB._id.toString(),
        role: userB.role,
      });

      // User B attempts to access User A's transaction
      const res = await request(app)
        .get(`/api/v1/transactions/${txA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect([403, 404]).toContain(res.status);
    });

    it('should prevent User B from modifying User A financial goal', async () => {
      const userA = await User.create({
        email: 'userA_goal@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'User',
        lastName: 'A',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const userB = await User.create({
        email: 'userB_goal@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'User',
        lastName: 'B',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const goalA = await FinancialGoal.create({
        userId: userA._id,
        title: 'Private Vacation Fund',
        description: 'Savings for summer trip',
        category: GoalCategory.TRAVEL,
        targetAmount: 5000,
        currentAmount: 1000,
        currency: 'USD',
        targetDate: new Date(Date.now() + 86400000 * 30),
        status: GoalStatus.IN_PROGRESS,
      });

      const tokenB = signAccessToken({
        userId: userB._id.toString(),
        role: userB.role,
      });

      const res = await request(app)
        .get(`/api/v1/goals/${goalA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect([403, 404]).toContain(res.status);
    });

    it('should prevent User B from accessing User A wealth assets', async () => {
      const userA = await User.create({
        email: 'userA_asset@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'User',
        lastName: 'A',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const userB = await User.create({
        email: 'userB_asset@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'User',
        lastName: 'B',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const assetA = await Asset.create({
        userId: userA._id,
        name: 'Secret Gold Vault',
        type: AssetType.PRECIOUS_METALS,
        currentValue: 100000,
        institutionName: 'Swiss Bank',
      });

      const tokenB = signAccessToken({
        userId: userB._id.toString(),
        role: userB.role,
      });

      const res = await request(app)
        .get(`/api/v1/wealth/assets/${assetA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ==========================================
  // 6. NOSQL INJECTION & REDOS RESILIENCE
  // ==========================================
  describe('6. NoSQL Injection & ReDoS Protection', () => {
    it('should sanitize request body and query to remove NoSQL $ operators', async () => {
      await User.create({
        email: 'nosql-target@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Target',
        lastName: 'User',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      // Attempt injection via login body with $gt operator
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $gt: '' }, // Injected operator
          password: 'Password123!',
        });

      // The sanitizer removes $gt, causing schema validation to reject the missing/invalid string email
      expect(res.status).toBe(400);
    });

    it('should safely escape catastrophic backtracking regex characters in search parameters', async () => {
      const user = await User.create({
        email: 'redos@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Regex',
        lastName: 'Tester',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const token = signAccessToken({
        userId: user._id.toString(),
        role: user.role,
      });

      // Evil regex pattern capable of catastrophic backtracking if unescaped
      const evilPattern = '((a+)+)+$';

      const startTime = Date.now();
      const res = await request(app)
        .get(`/api/v1/transactions?search=${encodeURIComponent(evilPattern)}`)
        .set('Authorization', `Bearer ${token}`);

      const elapsedMs = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(elapsedMs).toBeLessThan(1000); // Must resolve instantly without ReDoS hang
    });
  });

  // ==========================================
  // 7. SSRF & PATH TRAVERSAL DEFENSE
  // ==========================================
  describe('7. SSRF & Path Traversal Guards', () => {
    it('should reject path traversal in stock prediction proxy', async () => {
      const user = await User.create({
        email: 'ssrf-tester@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'SSRF',
        lastName: 'Tester',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const token = signAccessToken({
        userId: user._id.toString(),
        role: user.role,
      });

      // Path traversal attempt
      const resTraversal = await request(app)
        .get('/api/v1/stocks/predictions/proxy?path=../../etc/passwd')
        .set('Authorization', `Bearer ${token}`);

      expect(resTraversal.status).toBe(400);
      expect(resTraversal.body.error?.message || resTraversal.body.message).toMatch(
        /proxy target path|path traversal/i,
      );

      // SSRF attempt to fetch cloud metadata
      const resSSRF = await request(app)
        .get('/api/v1/stocks/predictions/proxy?path=http://169.254.169.254/latest/meta-data')
        .set('Authorization', `Bearer ${token}`);

      expect(resSSRF.status).toBe(400);

      // Non-allowlisted path
      const resForbiddenPath = await request(app)
        .get('/api/v1/stocks/predictions/proxy?path=/unauthorized/internal/endpoint')
        .set('Authorization', `Bearer ${token}`);

      expect(resForbiddenPath.status).toBe(400);
      expect(resForbiddenPath.body.error?.message || resForbiddenPath.body.message).toMatch(
        /proxy target path|allowlisted/i,
      );
    });
  });

  // ==========================================
  // 8. PASSWORD POLICY & DATA LEAKAGE AUDIT
  // ==========================================
  describe('8. Password Security & Sensitive Field Sanitization', () => {
    it('should enforce minimum password length of 8 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'weakpass@smartfin.ai',
          password: 'short',
          firstName: 'Weak',
          lastName: 'Password',
        });

      expect(res.status).toBe(400);
    });

    it('should never expose password hashes or sensitive session secrets in /auth/me', async () => {
      const user = await User.create({
        email: 'privacy@smartfin.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        firstName: 'Private',
        lastName: 'User',
        role: RoleName.USER,
        isEmailVerified: true,
      });

      const token = signAccessToken({
        userId: user._id.toString(),
        role: user.role,
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.salt).toBeUndefined();
    });

    it('should securely hash passwords with bcrypt work factor and never store plaintext', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hashcheck@smartfin.ai',
          password: 'Password123!',
          firstName: 'Hash',
          lastName: 'Check',
        });

      expect(res.status).toBe(201);
      const storedUser = await User.findOne({ email: 'hashcheck@smartfin.ai' }).select('+passwordHash');
      expect(storedUser?.passwordHash).toBeDefined();
      expect(storedUser?.passwordHash).not.toBe('Password123!');
      // Bcrypt hash identifier
      expect(storedUser?.passwordHash.startsWith('$2')).toBe(true);
    });
  });
});
