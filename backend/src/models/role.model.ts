import { Schema, model, Document } from 'mongoose';

export enum RoleName {
  USER = 'USER',
  ADMIN = 'ADMIN',
  PREMIUM_USER = 'PREMIUM_USER',
  FINANCIAL_ANALYST = 'FINANCIAL_ANALYST',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface IRole extends Document {
  name: RoleName;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      enum: Object.values(RoleName),
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Role = model<IRole>('Role', roleSchema);
