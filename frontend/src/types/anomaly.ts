export type AnomalyType =
  | 'AMOUNT_ANOMALY'
  | 'CATEGORY_ANOMALY'
  | 'MERCHANT_ANOMALY'
  | 'FREQUENCY_ANOMALY';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type AnomalyStatus =
  | 'NEW'
  | 'REVIEWED'
  | 'DISMISSED'
  | 'CONFIRMED_UNUSUAL'
  | 'RESOLVED';

export type AnomalyFeedbackType = 'EXPECTED' | 'UNUSUAL' | 'DISMISSED';

export interface ContributingFeature {
  feature: string;
  value: number;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface TransactionDetailsSnapshot {
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
}

export interface UserFeedbackRecord {
  feedbackType: AnomalyFeedbackType;
  timestamp: string;
  notes?: string;
}

export interface FinancialAnomaly {
  _id: string;
  transactionId: string;
  anomalyType: AnomalyType;
  anomalyScore: number;
  severity: AnomalySeverity;
  reason: string;
  contributingFeatures: ContributingFeature[];
  detectorType: 'STATISTICAL' | 'ISOLATION_FOREST' | 'ENSEMBLE';
  detectorMetadata?: {
    detectorName?: string;
    version?: string;
    featureVersion?: string;
  };
  status: AnomalyStatus;
  userFeedback?: UserFeedbackRecord;
  transactionDetails: TransactionDetailsSnapshot;
  notified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnomalySummary {
  total: number;
  new: number;
  reviewed: number;
  dismissed: number;
  confirmedUnusual: number;
  resolved: number;
  severityCounts: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface AnomalyFilters {
  status?: string;
  anomalyType?: string;
  severity?: string;
  category?: string;
  merchant?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
