import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { RoleName } from './role.model.js';

export interface IUserPreferences {
  theme: 'dark' | 'light' | 'system';
  emailAlerts: boolean;
  pushAlerts: boolean;
  weeklyDigest: boolean;
  stockAlertsEnabled?: boolean;
  minCooldownMinutes?: number;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  roleId?: Types.ObjectId;
  isEmailVerified: boolean;
  isMfaEnabled: boolean;
  mfaSecret?: string;
  defaultCurrency: string;
  locale: string;
  preferences: IUserPreferences;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  lastLoginAt?: Date;
  isSuspended: boolean;
  suspendedReason?: string;
  suspendedAt?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 50,
    },
    role: {
      type: String,
      enum: Object.values(RoleName),
      default: RoleName.USER,
      index: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isMfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    defaultCurrency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    locale: {
      type: String,
      default: 'en-US',
      trim: true,
    },
    preferences: {
      theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
      emailAlerts: { type: Boolean, default: true },
      pushAlerts: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
      stockAlertsEnabled: { type: Boolean, default: true },
      minCooldownMinutes: { type: Number, default: 60, min: 5 },
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
    isSuspended: {
      type: Boolean,
      default: false,
      index: true,
    },
    suspendedReason: {
      type: String,
      trim: true,
    },
    suspendedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = model<IUser>('User', userSchema);
