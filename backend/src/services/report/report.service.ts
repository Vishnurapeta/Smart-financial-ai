import fs from 'fs';
import { Types } from 'mongoose';
import {
  FinancialReport,
  IFinancialReport,
  ReportType,
  ReportStatus,
  EmailDeliveryStatus,
} from '../../models/financial-report.model.js';
import { User } from '../../models/user.model.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { enqueueReportGeneration, enqueueReportEmail } from '../../queues/report.queue.js';
import { reportPdfService } from './report-pdf.service.js';
import {
  reportAggregatorService,
  MonthlyReportSnapshot,
  CompleteFinancialReportData,
  getMonthBoundsIST,
} from './report-aggregator.service.js';

export interface GenerateReportOptions {
  forceRegenerate?: boolean;
  sendEmail?: boolean;
}

export interface GetReportsFilter {
  year?: number;
  month?: number;
  status?: ReportStatus | string;
  reportType?: ReportType | string;
  page?: number;
  limit?: number;
}

export class FinancialReportService {
  private static instance: FinancialReportService;

  private constructor() {}

  public static getInstance(): FinancialReportService {
    if (!FinancialReportService.instance) {
      FinancialReportService.instance = new FinancialReportService();
    }
    return FinancialReportService.instance;
  }

  /**
   * Dynamically calculate and return fresh monthly financial report from user's actual transactions
   * Automatically upserts or refreshes stored report document in MongoDB
   */
  public async getMonthlyReport(
    userId: string,
    year: number,
    month: number,
    _forceRefresh = false,
  ): Promise<{ report: IFinancialReport; snapshot: MonthlyReportSnapshot }> {
    const userObjectId = new Types.ObjectId(userId);

    // Validate boundaries
    const now = new Date();
    if (year < 2000 || year > now.getFullYear() + 1) {
      throw new BadRequestError('Invalid report year provided');
    }
    if (month < 1 || month > 12) {
      throw new BadRequestError('Month must be an integer between 1 and 12');
    }

    // Build real-time aggregated snapshot directly from active transaction records
    const snapshot = await reportAggregatorService.buildMonthlySnapshot(userId, year, month);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const title = `Monthly Financial Report - ${monthNames[month - 1]} ${year}`;

    // Upsert snapshot document in MongoDB for persistent archiving and vector PDF reference
    const report = await FinancialReport.findOneAndUpdate(
      {
        userId: userObjectId,
        reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
        year,
        month,
        isDeleted: false,
      },
      {
        $set: {
          title,
          periodStart: new Date(snapshot.metadata.periodStart),
          periodEnd: new Date(snapshot.metadata.periodEnd),
          timezone: snapshot.metadata.timezone,
          currency: snapshot.metadata.currency,
          status: snapshot.metadata.status,
          dataSnapshot: snapshot,
          limitations: snapshot.metadata.limitations,
          generatedAt: new Date(),
        },
        $setOnInsert: {
          userId: userObjectId,
          reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
          year,
          month,
          emailDeliveryStatus: EmailDeliveryStatus.NOT_REQUESTED,
          isDeleted: false,
        },
      },
      { upsert: true, new: true },
    );

    return { report, snapshot };
  }

  /**
   * Get 12-month annual cash-flow and savings trends for authenticated user
   */
  public async getMonthlyTrends(
    userId: string,
    year: number,
  ): Promise<MonthlyReportSnapshot['monthlyTrends']> {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const { snapshot } = await this.getMonthlyReport(userId, targetYear, now.getMonth() + 1);
    return snapshot.monthlyTrends;
  }

  /**
   * Request or regenerate a Monthly Financial Report
   */
  public async requestMonthlyReport(
    userId: string,
    year: number,
    month: number,
    options: GenerateReportOptions = {},
  ): Promise<{ report: IFinancialReport; isCached: boolean }> {
    const userObjectId = new Types.ObjectId(userId);

    // Validate boundaries
    const now = new Date();
    if (year < 2000 || year > now.getFullYear() + 1) {
      throw new BadRequestError('Invalid report year provided');
    }
    if (month < 1 || month > 12) {
      throw new BadRequestError('Month must be an integer between 1 and 12');
    }

    const { startDate: periodStart, endDate: periodEnd } = getMonthBoundsIST(year, month);

    // Check if report already exists for this exact period
    let report = await FinancialReport.findOne({
      userId: userObjectId,
      reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
      year,
      month,
      isDeleted: false,
    });

    if (report && !options.forceRegenerate) {
      if (
        report.status === ReportStatus.READY ||
        report.status === ReportStatus.READY_WITH_LIMITATIONS ||
        report.status === ReportStatus.NO_DATA
      ) {
        if (options.sendEmail) {
          await enqueueReportEmail({ reportId: report._id.toString(), userId });
        }
        return { report, isCached: true };
      }

      if (report.status === ReportStatus.GENERATING || report.status === ReportStatus.PENDING) {
        return { report, isCached: true };
      }
    }

    const user = await User.findById(userId).select('defaultCurrency locale timezone');
    const currency = user?.defaultCurrency || 'INR';
    const timezone = (user as any)?.timezone || 'Asia/Kolkata';

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const title = `Monthly Financial Report - ${monthNames[month - 1]} ${year}`;

    if (!report) {
      report = await FinancialReport.create({
        userId: userObjectId,
        reportType: ReportType.MONTHLY_FINANCIAL_REPORT,
        title,
        year,
        month,
        periodStart,
        periodEnd,
        timezone,
        currency,
        status: ReportStatus.PENDING,
        emailDeliveryStatus: options.sendEmail
          ? EmailDeliveryStatus.QUEUED
          : EmailDeliveryStatus.NOT_REQUESTED,
      });
    } else {
      report.status = ReportStatus.PENDING;
      report.errorMessage = undefined;
      if (options.sendEmail) {
        report.emailDeliveryStatus = EmailDeliveryStatus.QUEUED;
      }
      await report.save();
    }

    // Enqueue generation job in BullMQ worker or fallback directly
    await enqueueReportGeneration({
      reportId: report._id.toString(),
      userId,
      year,
      month,
      sendEmail: options.sendEmail,
    });

    return { report, isCached: false };
  }

  /**
   * List reports for authenticated user with pagination and filters
   */
  public async getUserReports(
    userId: string,
    filter: GetReportsFilter = {},
  ): Promise<{ reports: IFinancialReport[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(50, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    };

    if (filter.year) query.year = filter.year;
    if (filter.month) query.month = filter.month;
    if (filter.status) query.status = filter.status;
    if (filter.reportType) query.reportType = filter.reportType;

    const [reports, total] = await Promise.all([
      FinancialReport.find(query)
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-dataSnapshot.largestTransactions'), // Omit large inner arrays for lightweight list view
      FinancialReport.countDocuments(query),
    ]);

    return { reports, total, page, limit };
  }

  /**
   * Get single report by ID (with strict user ownership verification)
   */
  public async getReportById(userId: string, reportId: string): Promise<IFinancialReport> {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new BadRequestError('Invalid report ID format');
    }

    const report = await FinancialReport.findOne({
      _id: new Types.ObjectId(reportId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!report) {
      throw new NotFoundError('Financial report not found or access denied');
    }

    return report;
  }

  /**
   * Stream report PDF file (with ownership check & safe regeneration fallback)
   */
  public async getReportPdfStream(
    userId: string,
    reportId: string,
  ): Promise<{ stream: fs.ReadStream; filename: string; sizeBytes: number }> {
    const report = await this.getReportById(userId, reportId);

    if (
      report.status !== ReportStatus.READY &&
      report.status !== ReportStatus.READY_WITH_LIMITATIONS &&
      report.status !== ReportStatus.NO_DATA
    ) {
      throw new BadRequestError(`Report is not ready yet (Current status: ${report.status})`);
    }

    let filePath = report.fileReference;

    // If PDF file is missing on disk, regenerate on the fly
    if (!filePath || !fs.existsSync(filePath)) {
      if (!report.dataSnapshot || Object.keys(report.dataSnapshot).length === 0) {
        throw new BadRequestError('Report data snapshot missing; cannot regenerate PDF');
      }

      const generated = await reportPdfService.generatePdf(
        reportId,
        report.dataSnapshot as unknown as MonthlyReportSnapshot,
      );
      filePath = generated.filePath;
      report.fileReference = filePath;
      report.pdfSize = generated.fileSizeBytes;
      await report.save();
    }

    const stat = fs.statSync(filePath);
    const filename = `SmartFin-Financial-Report-${report.year}-${String(report.month).padStart(2, '0')}.pdf`;
    const stream = fs.createReadStream(filePath);

    return { stream, filename, sizeBytes: stat.size };
  }

  /**
   * Stream report PDF directly for a selected month/year
   */
  public async getReportPdfStreamByMonth(
    userId: string,
    year: number,
    month: number,
  ): Promise<{ stream: fs.ReadStream; filename: string; sizeBytes: number }> {
    const { report } = await this.getMonthlyReport(userId, year, month);
    return await this.getReportPdfStream(userId, report._id.toString());
  }

  /**
   * Trigger email delivery for an existing report
   */
  public async sendReportEmail(userId: string, reportId: string): Promise<void> {
    const report = await this.getReportById(userId, reportId);

    if (
      report.status !== ReportStatus.READY &&
      report.status !== ReportStatus.READY_WITH_LIMITATIONS &&
      report.status !== ReportStatus.NO_DATA
    ) {
      throw new BadRequestError('Report must be generated before emailing');
    }

    await enqueueReportEmail({ reportId, userId });
  }

  /**
   * Trigger email delivery for a selected month/year
   */
  public async sendReportEmailByMonth(userId: string, year: number, month: number): Promise<void> {
    const { report } = await this.getMonthlyReport(userId, year, month);
    await this.sendReportEmail(userId, report._id.toString());
  }

  /**
   * Soft-delete a report snapshot without deleting any transaction records
   */
  public async deleteReport(userId: string, reportId: string): Promise<void> {
    const report = await this.getReportById(userId, reportId);
    report.isDeleted = true;
    report.deletedAt = new Date();
    await report.save();
  }

  /**
   * Builds Complete Financial Report for arbitrary date range
   */
  public async getCompleteFinancialReport(
    userId: string,
    from: string,
    to: string,
  ): Promise<CompleteFinancialReportData> {
    return reportAggregatorService.buildCompleteFinancialReport(userId, from, to);
  }

  /**
   * Generates Complete Financial Report PDF stream for arbitrary date range
   */
  public async getCompleteFinancialReportPdf(
    userId: string,
    from: string,
    to: string,
  ): Promise<{
    data: CompleteFinancialReportData;
    filePath: string;
    fileSizeBytes: number;
    buffer: Buffer;
    filename: string;
  }> {
    const data = await reportAggregatorService.buildCompleteFinancialReport(userId, from, to);
    const pdfResult = await reportPdfService.generateCompleteReportPdf(data);
    const filename = `SMARTFIN_Financial_Report_${data.metadata.fromDateStr}_to_${data.metadata.toDateStr}.pdf`;
    return {
      data,
      filePath: pdfResult.filePath,
      fileSizeBytes: pdfResult.fileSizeBytes,
      buffer: pdfResult.buffer,
      filename,
    };
  }
}

export const financialReportService = FinancialReportService.getInstance();
