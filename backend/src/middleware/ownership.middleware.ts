import { Request, Response, NextFunction } from 'express';
import { Model, Types } from 'mongoose';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
} from '../utils/errors.js';
import { AuditService } from '../services/audit.service.js';
import { AuditStatus } from '../models/audit-log.model.js';
import { RoleName } from '../models/role.model.js';

export interface OwnershipOptions {
  paramName?: string;
  ownerField?: string;
  allowAdmin?: boolean;
}

export const verifyOwnership = <T>(model: Model<T>, options: OwnershipOptions = {}) => {
  const { paramName = 'id', ownerField = 'userId', allowAdmin = false } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const resourceId = req.params[paramName];
      if (!resourceId) {
        return next(new BadRequestError(`Missing required route parameter: ${paramName}`));
      }

      if (!Types.ObjectId.isValid(resourceId)) {
        return next(new BadRequestError('Invalid resource identifier format'));
      }

      const doc = await model.findById(resourceId);
      if (!doc) {
        return next(new NotFoundError(`${model.modelName} not found`));
      }

      const rawOwner = (doc as unknown as Record<string, unknown>)[ownerField];
      const ownerId = rawOwner ? (rawOwner as { toString(): string }).toString() : null;
      const requesterId = req.user.userId;

      // Allow admin or super admin if explicitly configured
      if (allowAdmin && (req.user.role === RoleName.ADMIN || req.user.role === RoleName.SUPER_ADMIN)) {
        req.resource = doc as unknown as Record<string, unknown>;
        return next();
      }

      if (!ownerId || ownerId !== requesterId) {
        // Log potential authorization attack / IDOR attempt in immutable audit trail
        await AuditService.log({
          userId: requesterId,
          actorRole: req.user.role,
          action: 'AUTHORIZATION_ATTACK_DETECTED',
          resource: model.modelName,
          resourceId,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Unknown',
          status: AuditStatus.FAILURE,
          failureReason: `User ${requesterId} attempted to access ${model.modelName} owned by user ${ownerId}`,
        });

        return next(
          new ForbiddenError(
            'Access denied: You do not have permission to access or modify this resource',
          ),
        );
      }

      // Attach resolved resource to request for controller efficiency
      req.resource = doc as unknown as Record<string, unknown>;
      next();
    } catch (error) {
      next(error);
    }
  };
};
