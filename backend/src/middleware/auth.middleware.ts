import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { User } from '../models/user.model.js';
import { RoleName } from '../models/role.model.js';
import { env } from '../config/env.js';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.access_token) {
      // 2. Fallback to HTTP-only cookie
      token = req.cookies.access_token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token is missing');
    }

    // Allow internal service-to-service communication via ML_SERVICE_SECRET_TOKEN
    if (env.ML_SERVICE_SECRET_TOKEN && token === env.ML_SERVICE_SECRET_TOKEN) {
      req.user = {
        userId: 'service-ml-internal',
        email: 'ml-service@smartfin.ai',
        role: RoleName.ADMIN,
      };
      return next();
    }

    // 3. Verify JWT token signature and expiration
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (_err) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    // 4. Verify user exists and is active
    const user = await User.findById(payload.userId).select('+lockoutUntil +isDeleted +isSuspended');
    if (!user || user.isDeleted) {
      throw new UnauthorizedError('User account not found or has been deactivated');
    }

    // 5. Check if user is suspended
    if (user.isSuspended) {
      throw new ForbiddenError('Account has been suspended. Please contact support.');
    }

    // 6. Check if user is locked out
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new ForbiddenError('Account is temporarily locked. Please try again later.');
    }

    // 7. Attach to request
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role as RoleName,
    };

    next();
  } catch (error) {
    next(error);
  }
};
