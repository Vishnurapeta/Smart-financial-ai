import { Types } from 'mongoose';
import { User, IUser } from '../models/user.model.js';
import { Session } from '../models/session.model.js';
import { RoleName } from '../models/role.model.js';
import { AuditStatus } from '../models/audit-log.model.js';
import { AuditService } from './audit.service.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateRandomToken,
} from '../utils/token.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors.js';
import {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from '../validations/auth.validation.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserSessionResponse {
  id: string;
  deviceName?: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  isEmailVerified: boolean;
  defaultCurrency: string;
  locale: string;
  createdAt: Date;
}

export const sanitizeUser = (user: IUser): UserResponse => ({
  id: user._id.toString(),
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  defaultCurrency: user.defaultCurrency || 'USD',
  locale: user.locale || 'en-US',
  createdAt: user.createdAt,
});

export class AuthService {
  /**
   * Register a new user
   */
  static async register(
    input: RegisterInput,
    ip = '127.0.0.1',
    userAgent = 'Unknown',
  ): Promise<{ user: UserResponse; tokens: AuthTokens; verificationToken?: string }> {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      await AuditService.log({
        actorRole: 'ANONYMOUS',
        action: 'AUTH_REGISTRATION_FAILED',
        resource: 'User',
        ipAddress: ip,
        userAgent,
        status: AuditStatus.FAILURE,
        failureReason: `Email already registered: ${input.email}`,
      });
      throw new ConflictError('A user with this email address already exists');
    }

    const rawVerifyToken = generateRandomToken();
    const verifyTokenHash = hashToken(rawVerifyToken);
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = new User({
      email: input.email.toLowerCase(),
      passwordHash: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      role: RoleName.USER, // Prevent privilege escalation & mass assignment
      defaultCurrency: input.defaultCurrency || 'USD',
      emailVerificationToken: verifyTokenHash,
      emailVerificationExpires: verifyExpires,
    });

    await user.save();

    // Create initial session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await Session.create({
      userId: user._id,
      refreshTokenHash: 'pending',
      ipAddress: ip,
      userAgent,
      deviceName: userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
      expiresAt,
    });

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      sessionId: session._id.toString(),
    });

    // Update session with hashed refresh token
    session.refreshTokenHash = hashToken(refreshToken);
    await session.save();

    // Audit log
    await AuditService.log({
      userId: user._id,
      actorRole: user.role,
      action: 'AUTH_REGISTER',
      resource: 'User',
      resourceId: user._id.toString(),
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });

    return {
      user: sanitizeUser(user),
      tokens: { accessToken, refreshToken },
      verificationToken: rawVerifyToken,
    };
  }

  /**
   * Authenticate user with password and create a new session
   */
  static async login(
    input: LoginInput,
    ip = '127.0.0.1',
    userAgent = 'Unknown',
  ): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const user = await User.findOne({ email: input.email.toLowerCase(), isDeleted: false }).select(
      '+passwordHash +lockoutUntil +failedLoginAttempts +isSuspended +suspendedReason',
    );

    if (!user) {
      await AuditService.log({
        actorRole: 'ANONYMOUS',
        action: 'AUTH_LOGIN_FAILED',
        resource: 'User',
        ipAddress: ip,
        userAgent,
        status: AuditStatus.FAILURE,
        failureReason: `Invalid credentials: email ${input.email} not found`,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check account suspension
    if (user.isSuspended) {
      await AuditService.log({
        userId: user._id,
        actorRole: user.role,
        action: 'AUTH_LOGIN_SUSPENDED',
        resource: 'User',
        resourceId: user._id.toString(),
        ipAddress: ip,
        userAgent,
        status: AuditStatus.FAILURE,
        failureReason: user.suspendedReason || 'Account suspended by administrator',
      });
      throw new ForbiddenError(
        `Account is suspended. Reason: ${user.suspendedReason || 'Administrative action'}. Please contact support.`,
      );
    }

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      await AuditService.log({
        userId: user._id,
        actorRole: user.role,
        action: 'AUTH_LOGIN_LOCKED',
        resource: 'User',
        resourceId: user._id.toString(),
        ipAddress: ip,
        userAgent,
        status: AuditStatus.FAILURE,
        failureReason: 'Account temporarily locked due to multiple failed login attempts',
      });
      throw new ForbiddenError(
        `Account is temporarily locked due to excessive failed attempts. Please try again in ${remainingMinutes} minutes.`,
      );
    }

    const isMatch = await user.comparePassword(input.password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
      }
      await user.save();

      await AuditService.log({
        userId: user._id,
        actorRole: user.role,
        action: 'AUTH_LOGIN_FAILED',
        resource: 'User',
        resourceId: user._id.toString(),
        ipAddress: ip,
        userAgent,
        status: AuditStatus.FAILURE,
        failureReason: 'Invalid password provided',
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    // Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockoutUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Create session
    const sessionDurationDays = input.rememberMe ? 30 : 7;
    const expiresAt = new Date(Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000);

    const session = await Session.create({
      userId: user._id,
      refreshTokenHash: 'pending',
      ipAddress: ip,
      userAgent,
      deviceName: userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
      expiresAt,
    });

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      sessionId: session._id.toString(),
    });

    session.refreshTokenHash = hashToken(refreshToken);
    await session.save();

    // Audit log
    await AuditService.log({
      userId: user._id,
      actorRole: user.role,
      action: 'AUTH_LOGIN',
      resource: 'Session',
      resourceId: session._id.toString(),
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });

    return {
      user: sanitizeUser(user),
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Log out session by invalidating the refresh token session
   */
  static async logout(
    refreshToken?: string,
    userId?: string,
    ip = '127.0.0.1',
    userAgent = 'Unknown',
  ): Promise<void> {
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await Session.findOneAndUpdate({ refreshTokenHash: hashed }, { isValid: false });
    }

    if (userId) {
      await AuditService.log({
        userId,
        actorRole: 'USER',
        action: 'AUTH_LOGOUT',
        resource: 'Session',
        ipAddress: ip,
        userAgent,
        status: AuditStatus.SUCCESS,
      });
    }
  }

  /**
   * Rotate refresh token and grant new access token
   */
  static async refreshTokens(
    oldRefreshToken: string,
    ip = '127.0.0.1',
    userAgent = 'Unknown',
  ): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(oldRefreshToken);
    } catch (_err) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const hashedOld = hashToken(oldRefreshToken);
    const session = await Session.findById(payload.sessionId);

    if (!session || !session.isValid || session.refreshTokenHash !== hashedOld) {
      // Suspected token reuse or revoked session: invalidate all sessions for safety
      if (session) {
        await Session.updateMany({ userId: session.userId }, { isValid: false });
      }
      throw new UnauthorizedError('Session has been revoked or expired. Please log in again.');
    }

    if (session.expiresAt < new Date()) {
      session.isValid = false;
      await session.save();
      throw new UnauthorizedError('Session has expired. Please log in again.');
    }

    const user = await User.findById(payload.userId);
    if (!user || user.isDeleted) {
      throw new UnauthorizedError('User account not found or has been deactivated');
    }

    // Generate rotated tokens
    const newAccessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = signRefreshToken({
      userId: user._id.toString(),
      sessionId: session._id.toString(),
    });

    // Update session
    session.refreshTokenHash = hashToken(newRefreshToken);
    session.lastActiveAt = new Date();
    session.ipAddress = ip;
    session.userAgent = userAgent;
    await session.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Get current authenticated user profile
   */
  static async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundError('User not found');
    }
    return sanitizeUser(user);
  }

  /**
   * Update user profile settings (currency, locale, name)
   */
  static async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserResponse> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundError('User not found');
    }

    if (input.defaultCurrency) {
      user.defaultCurrency = input.defaultCurrency.toUpperCase().trim();
    }
    if (input.locale) {
      user.locale = input.locale.trim();
    }
    if (input.firstName) {
      user.firstName = input.firstName.trim();
    }
    if (input.lastName) {
      user.lastName = input.lastName.trim();
    }

    await user.save();
    return sanitizeUser(user);
  }

  /**
   * Change user password and invalidate previous sessions
   */
  static async changePassword(
    userId: string,
    input: ChangePasswordInput,
    ip = '127.0.0.1',
    userAgent = 'Unknown',
  ): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user || user.isDeleted) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await user.comparePassword(input.currentPassword);
    if (!isMatch) {
      await AuditService.log({
        userId: user._id,
        actorRole: user.role,
        action: 'AUTH_PASSWORD_CHANGE_FAILED',
        resource: 'User',
        resourceId: user._id.toString(),
        ipAddress: ip,
        userAgent,
        status: AuditStatus.FAILURE,
        failureReason: 'Current password incorrect',
      });
      throw new UnauthorizedError('Current password is incorrect');
    }

    user.passwordHash = input.newPassword;
    await user.save();

    // Revoke all existing sessions for security
    await Session.updateMany({ userId: user._id }, { isValid: false });

    await AuditService.log({
      userId: user._id,
      actorRole: user.role,
      action: 'AUTH_PASSWORD_CHANGE',
      resource: 'User',
      resourceId: user._id.toString(),
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });
  }

  /**
   * Generate password reset token
   */
  static async forgotPassword(
    email: string,
    ip = '127.0.0.1',
    userAgent = 'Unknown',
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });

    // Anti-enumeration: Return success response even if email doesn't exist
    if (!user) {
      return {
        message:
          'If an account with that email exists, password reset instructions have been sent.',
      };
    }

    const rawToken = generateRandomToken();
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await AuditService.log({
      userId: user._id,
      actorRole: user.role,
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      resource: 'User',
      resourceId: user._id.toString(),
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });

    return {
      message: 'If an account with that email exists, password reset instructions have been sent.',
      resetToken: rawToken, // Provided for direct API confirmation & testing
    };
  }

  /**
   * Reset password using token
   */
  static async resetPassword(
    token: string,
    newPassword: string,
    ip = '127.0.0.1',
    userAgent = 'Unknown',
  ): Promise<void> {
    const hashed = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
      isDeleted: false,
    });

    if (!user) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    user.passwordHash = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Revoke all existing sessions
    await Session.updateMany({ userId: user._id }, { isValid: false });

    await AuditService.log({
      userId: user._id,
      actorRole: user.role,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resource: 'User',
      resourceId: user._id.toString(),
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });
  }

  /**
   * Verify email address using token
   */
  static async verifyEmail(token: string, ip = '127.0.0.1', userAgent = 'Unknown'): Promise<void> {
    const hashed = hashToken(token);
    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: new Date() },
      isDeleted: false,
    });

    if (!user) {
      throw new BadRequestError('Email verification token is invalid or has expired');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    await AuditService.log({
      userId: user._id,
      actorRole: user.role,
      action: 'AUTH_EMAIL_VERIFIED',
      resource: 'User',
      resourceId: user._id.toString(),
      ipAddress: ip,
      userAgent,
      status: AuditStatus.SUCCESS,
    });
  }

  /**
   * Get active sessions for a user
   */
  static async getUserSessions(
    userId: string,
    currentSessionToken?: string,
  ): Promise<UserSessionResponse[]> {
    const sessions = await Session.find({
      userId: new Types.ObjectId(userId),
      isValid: true,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActiveAt: -1 });

    const currentHash = currentSessionToken ? hashToken(currentSessionToken) : null;

    return sessions.map((s) => ({
      id: s._id.toString(),
      deviceName: s.deviceName,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: currentHash ? s.refreshTokenHash === currentHash : false,
    }));
  }

  /**
   * Revoke a specific session
   */
  static async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await Session.findOne({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    session.isValid = false;
    await session.save();
  }
}
