import { api } from './api.ts';
import {
  FinancialReport,
  GetReportsResponse,
  SingleReportResponse,
  RequestMonthlyReportRequest,
  RequestMonthlyReportResponse,
  GetMonthlyReportResponse,
  GetMonthlyTrendsResponse,
  CompleteFinancialReportData,
  GetCompleteFinancialReportResponse,
} from '../types/report.ts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export class ReportService {
  /**
   * Fetch dynamic real-time monthly financial report calculated directly from transactions
   */
  public async getMonthlyReport(
    year?: number,
    month?: number,
    refresh = false,
  ): Promise<GetMonthlyReportResponse['data']> {
    const query = new URLSearchParams();
    if (year) query.set('year', year.toString());
    if (month) query.set('month', month.toString());
    if (refresh) query.set('refresh', 'true');

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await api.request<GetMonthlyReportResponse>(`/reports/monthly${queryString}`);
    return res.data;
  }

  /**
   * Fetch 12-month annual comparison trends for the selected year
   */
  public async getMonthlyTrends(year?: number): Promise<GetMonthlyTrendsResponse['data']> {
    const query = new URLSearchParams();
    if (year) query.set('year', year.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await api.request<GetMonthlyTrendsResponse>(`/reports/trends${queryString}`);
    return res.data;
  }

  /**
   * List archived reports for authenticated user with filters & pagination
   */
  public async getReports(params: {
    year?: number;
    month?: number;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<GetReportsResponse> {
    const query = new URLSearchParams();
    if (params.year) query.set('year', params.year.toString());
    if (params.month) query.set('month', params.month.toString());
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await api.request<GetReportsResponse>(`/reports${queryString}`);
  }

  /**
   * Get single report by ID
   */
  public async getReportById(id: string): Promise<FinancialReport> {
    const res = await api.request<SingleReportResponse>(`/reports/${id}`);
    return res.data;
  }

  /**
   * Request / trigger generation of monthly report snapshot
   */
  public async requestMonthlyReport(
    payload: RequestMonthlyReportRequest,
  ): Promise<RequestMonthlyReportResponse> {
    return await api.request<RequestMonthlyReportResponse>('/reports/monthly', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Trigger email delivery of report by reportId
   */
  public async sendReportEmail(reportId: string): Promise<{ success: boolean; message: string }> {
    return await api.request<{ success: boolean; message: string }>(`/reports/${reportId}/email`, {
      method: 'POST',
    });
  }

  /**
   * Trigger email delivery of report by selected year/month
   */
  public async sendMonthlyEmail(year: number, month: number): Promise<{ success: boolean; message: string }> {
    return await api.request<{ success: boolean; message: string }>(
      `/reports/monthly/${year}/${month}/email`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Soft-delete a report snapshot
   */
  public async deleteReport(reportId: string): Promise<void> {
    await api.request<{ success: boolean; message: string }>(`/reports/${reportId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Securely download vector PDF report by reportId
   */
  public async downloadPdf(reportId: string, filename?: string): Promise<void> {
    const token = api.getAccessToken();
    const res = await fetch(`${API_BASE}/reports/${reportId}/pdf`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      let errMessage = 'Failed to download report PDF';
      try {
        const errorJson = await res.json();
        if (errorJson?.message) errMessage = errorJson.message;
      } catch {
        // use default error message
      }
      throw new Error(errMessage);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || `SmartFin-Report-${reportId}.pdf`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(link);
  }

  /**
   * Securely download vector PDF report for selected year & month
   */
  public async downloadMonthlyPdf(year: number, month: number, filename?: string): Promise<void> {
    const token = api.getAccessToken();
    const res = await fetch(`${API_BASE}/reports/monthly/${year}/${month}/pdf`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      let errMessage = 'Failed to download report PDF';
      try {
        const errorJson = await res.json();
        if (errorJson?.message) errMessage = errorJson.message;
      } catch {
        // use default error message
      }
      throw new Error(errMessage);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || `SmartFin-Financial-Report-${year}-${String(month).padStart(2, '0')}.pdf`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(link);
  }

  /**
   * Fetch complete financial report covering all modules for arbitrary date range
   */
  public async getFinancialReport(from: string, to: string): Promise<CompleteFinancialReportData> {
    const query = new URLSearchParams({ from, to });
    const res = await api.request<GetCompleteFinancialReportResponse>(`/reports/financial?${query.toString()}`);
    return res.data;
  }

  /**
   * Securely download Complete Financial Report PDF for arbitrary date range
   */
  public async downloadCompleteFinancialReportPdf(from: string, to: string): Promise<void> {
    const token = api.getAccessToken();
    const query = new URLSearchParams({ from, to });
    const res = await fetch(`${API_BASE}/reports/financial/pdf?${query.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      let errMessage = 'Failed to download complete report PDF';
      try {
        const errorJson = await res.json();
        if (errorJson?.message) errMessage = errorJson.message;
        else if (errorJson?.error?.message) errMessage = errorJson.error.message;
      } catch {
        // use default error message
      }
      throw new Error(errMessage);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `SMARTFIN_Financial_Report_${from}_to_${to}.pdf`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(link);
  }
}

export const reportService = new ReportService();
