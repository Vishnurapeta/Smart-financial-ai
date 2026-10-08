import { Request, Response, NextFunction } from 'express';
import { RoleName } from '../models/role.model.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { AuditService } from '../services/audit.service.js';
import { AuditStatus } from '../models/audit-log.model.js';

export const requireRoles = (...allowedRoles: (RoleName | string)[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Record failed privileged operation audit log
      await AuditService.log({
        userId: req.user.userId,
        actorRole: req.user.role,
        action: 'PRIVILEGED_ACCESS_DENIED',
        resource: req.originalUrl,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown',
        status: AuditStatus.FAILURE,
        failureReason: `Role '${req.user.role}' attempted unauthorized access to endpoint requiring: [${allowedRoles.join(', ')}]`,
      });

      return next(
        new ForbiddenError(
          `Access denied: requires one of the following roles: [${allowedRoles.join(', ')}]`,
        ),
      );
    }

    next();
  };
};

export const requireAdmin = requireRoles(RoleName.ADMIN, RoleName.SUPER_ADMIN);
export const requireSuperAdmin = requireRoles(RoleName.SUPER_ADMIN);
