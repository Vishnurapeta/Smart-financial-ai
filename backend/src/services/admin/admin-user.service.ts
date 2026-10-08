import { Types } from 'mongoose';
import { User, IUser } from '../../models/user.model.js';
import { RoleName } from '../../models/role.model.js';
import { AuditService } from '../audit.service.js';
import { AuditStatus } from '../../models/audit-log.model.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { Budget } from '../../models/budget.model.js';
import { Portfolio } from '../../models/portfolio.model.js';
import { StockAlert } from '../../models/stock-alert.model.js';
import { FinancialReport } from '../../models/financial-report.model.js';
import { generateRandomToken, hashToken } from '../../utils/token.js';
import { escapeRegex, safeSortField } from '../../utils/security.util.js';

export interface AdminUserFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'UNVERIFIED';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING_VERIFICATION';
  isEmailVerified: boolean;
  isMfaEnabled: boolean;
  isSuspended: boolean;
  suspendedReason?: string;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  lastLoginAt?: Date;
  defaultCurrency: string;
  locale: string;
  createdAt: Date;
}

export interface AdminUserDetails extends AdminUserListItem {
  summaryStats: {
    budgetCount: number;
    portfolioCount: number;
    activeAlertsCount: number;
    reportsGeneratedCount: number;
  };
}

export class AdminUserService {
  /**
   * List users with least privilege projection and robust filtering
   */
  static async listUsers(filter: AdminUserFilter): Promise<{
    users: AdminUserListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { isDeleted: false };

    // Search by email, firstName, or lastName with ReDoS protection
    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(escapeRegex(filter.search.trim()), 'i');
      query.$or = [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ];
    }

    // Filter by role
    if (filter.role && Object.values(RoleName).includes(filter.role as RoleName)) {
      query.role = filter.role;
    }

    // Filter by account status
    const now = new Date();
    if (filter.status === 'SUSPENDED') {
      query.isSuspended = true;
    } else if (filter.status === 'LOCKED') {
      query.lockoutUntil = { $gt: now };
      query.isSuspended = { $ne: true };
    } else if (filter.status === 'UNVERIFIED') {
      query.isEmailVerified = false;
      query.isSuspended = { $ne: true };
    } else if (filter.status === 'ACTIVE') {
      query.isSuspended = { $ne: true };
      query.$and = [
        { $or: [{ lockoutUntil: { $exists: false } }, { lockoutUntil: { $lte: now } }, { lockoutUntil: null }] },
        { isEmailVerified: true },
      ];
    }

    const ALLOWED_USER_SORT_FIELDS = ['createdAt', 'email', 'firstName', 'lastName', 'lastLoginAt', 'role'] as const;
    const sortField = safeSortField(filter.sortBy, ALLOWED_USER_SORT_FIELDS, 'createdAt');
    const sortDirection = filter.sortOrder === 'asc' ? 1 : -1;
    const sortOptions: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [rawUsers, total] = await Promise.all([
      User.find(query)
        .select(
          '_id email firstName lastName role isEmailVerified isMfaEnabled isSuspended suspendedReason failedLoginAttempts lockoutUntil lastLoginAt defaultCurrency locale createdAt',
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const users: AdminUserListItem[] = rawUsers.map((u) => {
      let status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING_VERIFICATION' = 'ACTIVE';
      if (u.isSuspended) {
        status = 'SUSPENDED';
      } else if (u.lockoutUntil && new Date(u.lockoutUntil) > now) {
        status = 'LOCKED';
      } else if (!u.isEmailVerified) {
        status = 'PENDING_VERIFICATION';
      }

      return {
        id: u._id.toString(),
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status,
        isEmailVerified: u.isEmailVerified,
        isMfaEnabled: u.isMfaEnabled,
        isSuspended: !!u.isSuspended,
        suspendedReason: u.suspendedReason,
        failedLoginAttempts: u.failedLoginAttempts || 0,
        lockoutUntil: u.lockoutUntil,
        lastLoginAt: u.lastLoginAt,
        defaultCurrency: u.defaultCurrency || 'USD',
        locale: u.locale || 'en-US',
        createdAt: u.createdAt,
      };
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user details with non-sensitive account metadata summary (Least Privilege: Zero Transaction Line Items)
   */
  static async getUserDetails(userId: string): Promise<AdminUserDetails> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    const user = await User.findOne({ _id: userId, isDeleted: false })
      .select(
        '_id email firstName lastName role isEmailVerified isMfaEnabled isSuspended suspendedReason failedLoginAttempts lockoutUntil lastLoginAt defaultCurrency locale createdAt',
      )
      .lean();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    // High-level aggregate counts only - No detailed financial item snooping
    const [budgetCount, portfolioCount, activeAlertsCount, reportsGeneratedCount] =
      await Promise.all([
        Budget.countDocuments({ userId: userObjectId, isDeleted: false }),
        Portfolio.countDocuments({ userId: userObjectId, isDeleted: false }),
        StockAlert.countDocuments({ userId: userObjectId, isActive: true }),
        FinancialReport.countDocuments({ userId: userObjectId }),
      ]);

    let status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING_VERIFICATION' = 'ACTIVE';
    if (user.isSuspended) {
      status = 'SUSPENDED';
    } else if (user.lockoutUntil && new Date(user.lockoutUntil) > now) {
      status = 'LOCKED';
    } else if (!user.isEmailVerified) {
      status = 'PENDING_VERIFICATION';
    }

    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status,
      isEmailVerified: user.isEmailVerified,
      isMfaEnabled: user.isMfaEnabled,
      isSuspended: !!user.isSuspended,
      suspendedReason: user.suspendedReason,
      failedLoginAttempts: user.failedLoginAttempts || 0,
      lockoutUntil: user.lockoutUntil,
      lastLoginAt: user.lastLoginAt,
      defaultCurrency: user.defaultCurrency || 'USD',
      locale: user.locale || 'en-US',
      createdAt: user.createdAt,
      summaryStats: {
        budgetCount,
        portfolioCount,
        activeAlertsCount,
        reportsGeneratedCount,
      },
    };
  }

  /**
   * Update account status (SUSPEND, REACTIVATE, LOCK, UNLOCK)
   */
  static async updateUserStatus(
    userId: string,
    action: 'SUSPEND' | 'REACTIVATE' | 'LOCK' | 'UNLOCK',
    reason: string | undefined,
    adminUser: { userId: string; role: string },
    ip: string,
    userAgent: string,
  ): Promise<IUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    const targetUser = await User.findOne({ _id: userId, isDeleted: false });
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    // Safety: prevent admin from suspending themselves
    if (targetUser._id.toString() === adminUser.userId) {
      throw new ForbiddenError('Administrators cannot suspend or lock their own account');
    }

    // Last Admin Protection: Prevent suspending the final active SUPER_ADMIN
    if (action === 'SUSPEND' && targetUser.role === RoleName.SUPER_ADMIN) {
      const remainingActive = await User.countDocuments({
        role: RoleName.SUPER_ADMIN,
        isDeleted: false,
        isSuspended: false,
        _id: { $ne: targetUser._id },
      });
      if (remainingActive === 0) {
        throw new ForbiddenError('Cannot suspend the last remaining active SUPER_ADMIN');
      }
    }

    const previousState = {
      isSuspended: targetUser.isSuspended,
      suspendedReason: targetUser.suspendedReason,
      lockoutUntil: targetUser.lockoutUntil,
      failedLoginAttempts: targetUser.failedLoginAttempts,
    };

    switch (action) {
      case 'SUSPEND':
        targetUser.isSuspended = true;
        targetUser.suspendedReason = reason || 'Administrative suspension';
        targetUser.suspendedAt = new Date();
        break;

      case 'REACTIVATE':
        targetUser.isSuspended = false;
        targetUser.suspendedReason = undefined;
        targetUser.suspendedAt = undefined;
        break;

      case 'LOCK':
        // Lock for 24 hours
        targetUser.lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        break;

      case 'UNLOCK':
        targetUser.lockoutUntil = undefined;
        targetUser.failedLoginAttempts = 0;
        break;

      default:
        throw new BadRequestError('Invalid account action requested');
    }

    await targetUser.save();

    await AuditService.log({
      userId: adminUser.userId,
      actorRole: adminUser.role,
      action: `ADMIN_USER_STATUS_${action}`,
      resource: 'User',
      resourceId: userId,
      changes: {
        before: previousState,
        after: {
          isSuspended: targetUser.isSuspended,
          suspendedReason: targetUser.suspendedReason,
          lockoutUntil: targetUser.lockoutUntil,
          failedLoginAttempts: targetUser.failedLoginAttempts,
        },
      },
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });

    return targetUser;
  }

  /**
   * Update user role with least privilege checks & role hierarchy enforcement
   */
  static async updateUserRole(
    userId: string,
    newRole: RoleName,
    adminUser: { userId: string; role: string },
    ip: string,
    userAgent: string,
  ): Promise<IUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    if (!Object.values(RoleName).includes(newRole)) {
      throw new BadRequestError(
        `Invalid role. Valid options: ${Object.values(RoleName).join(', ')}`,
      );
    }

    const targetUser = await User.findOne({ _id: userId, isDeleted: false });
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    // Role Hierarchy & Self-Lockout Protections:
    if (targetUser._id.toString() === adminUser.userId && targetUser.role !== newRole) {
      throw new ForbiddenError('You cannot alter your own administrative role');
    }

    // Only SUPER_ADMIN can assign SUPER_ADMIN role
    if (newRole === RoleName.SUPER_ADMIN && adminUser.role !== RoleName.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN users can grant the SUPER_ADMIN role');
    }

    // Non-SUPER_ADMIN cannot modify a SUPER_ADMIN user
    if (targetUser.role === RoleName.SUPER_ADMIN && adminUser.role !== RoleName.SUPER_ADMIN) {
      throw new ForbiddenError('Only a SUPER_ADMIN can modify another SUPER_ADMIN');
    }

    // Last Admin Protection: Prevent demoting the final SUPER_ADMIN
    if (targetUser.role === RoleName.SUPER_ADMIN && newRole !== RoleName.SUPER_ADMIN) {
      const remainingSuperAdmins = await User.countDocuments({
        role: RoleName.SUPER_ADMIN,
        isDeleted: false,
        isSuspended: false,
        _id: { $ne: targetUser._id },
      });
      if (remainingSuperAdmins === 0) {
        throw new ForbiddenError('Cannot demote the last remaining active SUPER_ADMIN');
      }
    }

    const previousRole = targetUser.role;
    targetUser.role = newRole;
    await targetUser.save();

    await AuditService.log({
      userId: adminUser.userId,
      actorRole: adminUser.role,
      action: 'PRIVILEGED_USER_ROLE_UPDATED',
      resource: 'User',
      resourceId: userId,
      changes: {
        before: { role: previousRole },
        after: { role: newRole },
      },
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });

    return targetUser;
  }

  /**
   * Administrative email verification
   */
  static async verifyEmail(
    userId: string,
    adminUser: { userId: string; role: string },
    ip: string,
    userAgent: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    const targetUser = await User.findOne({ _id: userId, isDeleted: false });
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    targetUser.isEmailVerified = true;
    targetUser.emailVerificationToken = undefined;
    targetUser.emailVerificationExpires = undefined;
    await targetUser.save();

    await AuditService.log({
      userId: adminUser.userId,
      actorRole: adminUser.role,
      action: 'ADMIN_MANUAL_EMAIL_VERIFIED',
      resource: 'User',
      resourceId: userId,
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });
  }

  /**
   * Admin triggered password reset token generation
   */
  static async triggerPasswordReset(
    userId: string,
    adminUser: { userId: string; role: string },
    ip: string,
    userAgent: string,
  ): Promise<{ resetToken: string; expiresAt: Date }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    const targetUser = await User.findOne({ _id: userId, isDeleted: false });
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    const rawToken = generateRandomToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    targetUser.passwordResetToken = tokenHash;
    targetUser.passwordResetExpires = expiresAt;
    await targetUser.save();

    await AuditService.log({
      userId: adminUser.userId,
      actorRole: adminUser.role,
      action: 'ADMIN_TRIGGERED_PASSWORD_RESET',
      resource: 'User',
      resourceId: userId,
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });

    return { resetToken: rawToken, expiresAt };
  }
}
