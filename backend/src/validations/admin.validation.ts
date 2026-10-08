import { z } from 'zod';
import { RoleName } from '../models/role.model.js';

export const updateUserStatusSchema = z.object({
  body: z.object({
    action: z.enum(['SUSPEND', 'REACTIVATE', 'LOCK', 'UNLOCK']),
    reason: z.string().max(255).optional(),
  }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(RoleName),
  }),
});

export const listUsersQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    role: z.nativeEnum(RoleName).optional(),
    status: z.enum(['ALL', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'UNVERIFIED']).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const listAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    action: z.string().optional(),
    actorRole: z.string().optional(),
    status: z.enum(['SUCCESS', 'FAILURE']).optional(),
    resource: z.string().optional(),
    userId: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});
