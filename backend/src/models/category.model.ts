import { Schema, model, Document, Types } from 'mongoose';

export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export interface ICategory extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  name: string;
  slug: string;
  type: CategoryType;
  parentId?: Types.ObjectId;
  icon: string;
  color: string;
  isSystem: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: 60,
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(CategoryType),
      required: [true, 'Category type is required'],
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    icon: {
      type: String,
      default: 'tag',
      trim: true,
    },
    color: {
      type: String,
      default: '#10B981',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex code'],
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

categorySchema.index({ userId: 1, slug: 1 }, { unique: true });
categorySchema.index({ type: 1, isSystem: 1 });

export const Category = model<ICategory>('Category', categorySchema);
