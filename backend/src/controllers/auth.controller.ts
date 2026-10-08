import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { CookieOptions } from 'express';

const getCookieOptions = (maxAgeMs: number): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: maxAgeMs,
  path: '/',
});

export class AuthController {
  /**
   * Register user
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const result = await AuthService.register(req.body, ip, userAgent);

      // Set HTTP-only cookies
      res.cookie('access_token', result.tokens.accessToken, getCookieOptions(15 * 60 * 1000));
      res.cookie(
        'refresh_token',
        result.tokens.refreshToken,
        getCookieOptions(7 * 24 * 60 * 60 * 1000),
      );

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens,
          verificationToken: result.verificationToken,
        },
        message: 'Registration successful. Please verify your email.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const result = await AuthService.login(req.body, ip, userAgent);

      const refreshDuration = req.body.rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;

      res.cookie('access_token', result.tokens.accessToken, getCookieOptions(15 * 60 * 1000));
      res.cookie('refresh_token', result.tokens.refreshToken, getCookieOptions(refreshDuration));

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens,
        },
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user and clear cookies
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const userId = req.user?.userId;

      await AuthService.logout(refreshToken, userId, ip, userAgent);

      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });

      res.status(200).json({
        success: true,
        data: null,
        message: 'Successfully logged out',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh JWT token
   */
  static async refreshTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const tokens = await AuthService.refreshTokens(refreshToken, ip, userAgent);

      res.cookie('access_token', tokens.accessToken, getCookieOptions(15 * 60 * 1000));
      res.cookie('refresh_token', tokens.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

      res.status(200).json({
        success: true,
        data: { tokens },
        message: 'Tokens refreshed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current authenticated user
   */
  static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.getCurrentUser(req.user!.userId);

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile settings
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.updateProfile(req.user!.userId, req.body);

      res.status(200).json({
        success: true,
        data: { user },
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      await AuthService.changePassword(req.user!.userId, req.body, ip, userAgent);

      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });

      res.status(200).json({
        success: true,
        data: null,
        message: 'Password changed successfully. Please log in with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset token
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const result = await AuthService.forgotPassword(req.body.email, ip, userAgent);

      // In production, resetToken is strictly omitted from HTTP responses to prevent credential exposure.
      // It is only included when NODE_ENV === 'test' to support test automation.
      const data = env.NODE_ENV === 'test' && result.resetToken ? { resetToken: result.resetToken } : null;

      res.status(200).json({
        success: true,
        data,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password using token
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      await AuthService.resetPassword(req.body.token, req.body.newPassword, ip, userAgent);

      res.status(200).json({
        success: true,
        data: null,
        message: 'Password reset successfully. You can now log in with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email using token
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      await AuthService.verifyEmail(req.params.token, ip, userAgent);

      res.status(200).json({
        success: true,
        data: null,
        message: 'Email address successfully verified.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active sessions / devices
   */
  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentToken = req.cookies?.refresh_token;
      const sessions = await AuthService.getUserSessions(req.user!.userId, currentToken);

      res.status(200).json({
        success: true,
        data: { sessions },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke session
   */
  static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.revokeSession(req.user!.userId, req.params.id);

      res.status(200).json({
        success: true,
        data: null,
        message: 'Session revoked successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}
