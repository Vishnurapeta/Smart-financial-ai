import { Schema, model, Document, Types } from 'mongoose';

export enum ReportType {
  MONTHLY_FINANCIAL_REPORT = 'MONTHLY_FINANCIAL_REPORT',
  WEEKLY_SUMMARY = 'WEEKLY_SUMMARY',
  QUARTERLY_REPORT = 'QUARTERLY_REPORT',
  ANNUAL_REPORT = 'ANNUAL_REPORT',
  INVESTMENT_REPORT = 'INVESTMENT_REPORT',
  TAX_SUMMARY = 'TAX_SUMMARY',
  CUSTOM = 'CUSTOM',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  READY = 'READY',
  READY_WITH_LIMITATIONS = 'READY_WITH_LIMITATIONS',
  NO_DATA = 'NO_DATA',
  FAILED = 'FAILED',
}

export enum EmailDeliveryStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface IFinancialReport extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  reportType: ReportType;
  title: string;
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  timezone: string;
  currency: string;
  status: ReportStatus;
  reportVersion: string;
  templateVersion: string;
  dataSnapshot: Record<string, unknown>;
  fileReference?: string;
  pdfSize?: number;
  generationDurationMs?: number;
  pdfGenerationDurationMs?: number;
  errorMessage?: string;
  limitations: string[];
  emailDeliveryStatus: EmailDeliveryStatus;
  emailSentAt?: Date;
  generatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const financialReportSchema = new Schema<IFinancialReport>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    reportType: {
      type: String,
      enum: Object.values(ReportType),
      default: ReportType.MONTHLY_FINANCIAL_REPORT,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true,
      maxlength: 150,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
      index: true,
    },
    reportVersion: {
      type: String,
      default: '1.0',
    },
    templateVersion: {
      type: String,
      default: '2026.09',
    },
    dataSnapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },
    fileReference: {
      type: String,
      trim: true,
    },
    pdfSize: {
      type: Number,
      default: 0,
    },
    generationDurationMs: {
      type: Number,
      default: 0,
    },
    pdfGenerationDurationMs: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    limitations: {
      type: [String],
      default: [],
    },
    emailDeliveryStatus: {
      type: String,
      enum: Object.values(EmailDeliveryStatus),
      default: EmailDeliveryStatus.NOT_REQUESTED,
      index: true,
    },
    emailSentAt: {
      type: Date,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
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

financialReportSchema.index(
  { userId: 1, year: 1, month: 1, reportType: 1, isDeleted: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
financialReportSchema.index({ userId: 1, status: 1 });
financialReportSchema.index({ userId: 1, createdAt: -1 });

export const FinancialReport = model<IFinancialReport>('FinancialReport', financialReportSchema);
