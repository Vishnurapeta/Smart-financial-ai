import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  updateUserStatusSchema,
  updateUserRoleSchema,
  listUsersQuerySchema,
  listAuditLogsQuerySchema,
} from '../validations/admin.validation.js';

import { adminApiRateLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

// All admin routes strictly require authentication, ADMIN/SUPER_ADMIN role, and rate limiting
router.use(authenticate, requireAdmin, adminApiRateLimiter);

// Platform & Subsystem Metrics
router.get('/metrics/overview', AdminController.getOverviewMetrics);
router.get('/metrics/features', AdminController.getFeatureMetrics);
router.get('/metrics/telemetry', AdminController.getTelemetryMetrics);
router.get('/metrics/security', AdminController.getSecurityMetrics);

// Infrastructure & Queue Monitoring
router.get('/system/health', AdminController.getSystemHealth);
router.get('/queues', AdminController.getQueueMetrics);

// User & Account Status Management (Least Privilege: Zero Transaction Snooping)
router.get('/users', validate(listUsersQuerySchema), AdminController.listUsers);
router.get('/users/:id', AdminController.getUserDetails);
router.patch('/users/:id/status', validate(updateUserStatusSchema), AdminController.updateUserStatus);
router.patch('/users/:id/role', validate(updateUserRoleSchema), AdminController.updateUserRole);
router.post('/users/:id/verify-email', AdminController.verifyUserEmail);
router.post('/users/:id/reset-password', AdminController.triggerPasswordReset);

// Immutable Audit Trail
router.get('/audit-logs', validate(listAuditLogsQuerySchema), AdminController.listAuditLogs);
router.get('/audit-logs/stats', AdminController.getAuditStats);

export default router;
