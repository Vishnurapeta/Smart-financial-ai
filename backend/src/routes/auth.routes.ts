import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  authRateLimiter,
  passwordResetRateLimiter,
} from '../middleware/rate-limiter.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
} from '../validations/auth.validation.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', authRateLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authRateLimiter, validate(loginSchema), AuthController.login);
router.post(
  '/refresh-token',
  authRateLimiter,
  validate(refreshTokenSchema),
  AuthController.refreshTokens,
);
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword,
);
router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  AuthController.resetPassword,
);
router.get('/verify-email/:token', validate(verifyEmailSchema), AuthController.verifyEmail);

// Protected Authentication & Session Endpoints
router.use(authenticate);

router.get('/me', AuthController.getCurrentUser);
router.patch('/me', validate(updateProfileSchema), AuthController.updateProfile);
router.patch('/profile', validate(updateProfileSchema), AuthController.updateProfile);
router.post('/logout', AuthController.logout);
router.post('/change-password', validate(changePasswordSchema), AuthController.changePassword);
router.get('/sessions', AuthController.getSessions);
router.delete('/sessions/:id', AuthController.revokeSession);

export default router;
