import { useState, useEffect, useCallback } from 'react';
import { AnomalyService } from '../services/anomaly.service.ts';
import {
  FinancialAnomaly,
  AnomalySummary,
  AnomalyFilters,
  AnomalyStatus,
  AnomalyFeedbackType,
} from '../types/anomaly.ts';

export function useAnomalies() {
  const [anomalies, setAnomalies] = useState<FinancialAnomaly[]>([]);
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<FinancialAnomaly | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const [filters, setFiltersState] = useState<AnomalyFilters>({
    status: undefined,
    anomalyType: undefined,
    severity: undefined,
    category: undefined,
    merchant: undefined,
    page: 1,
    limit: 20,
  });

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1,
  });

  const fetchAnomaliesAndSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, sumRes] = await Promise.all([
        AnomalyService.getAnomalies(filters),
        AnomalyService.getSummary().catch((err) => {
          console.warn('Failed to load anomaly summary:', err);
          return null;
        }),
      ]);

      if (listRes?.data) {
        setAnomalies(listRes.data);
        if (listRes.pagination) {
          setPagination(listRes.pagination);
        }
      }

      if (sumRes) {
        setSummary(sumRes);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch financial anomalies');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAnomaliesAndSummary();
  }, [fetchAnomaliesAndSummary]);

  const setFilters = (newFilters: Partial<AnomalyFilters>) => {
    setFiltersState((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1, // reset page unless explicit
    }));
  };

  const runDetection = async (lookbackDays = 90) => {
    setDetecting(true);
    setError(null);
    try {
      const result = await AnomalyService.detectAnomalies({ lookbackDays, minHistoryCount: 5 });
      await fetchAnomaliesAndSummary();
      return result;
    } catch (err: any) {
      setError(err?.message || 'Failed to run anomaly scan');
      throw err;
    } finally {
      setDetecting(false);
    }
  };

  const updateStatus = async (id: string, status: AnomalyStatus) => {
    try {
      const updated = await AnomalyService.updateStatus(id, status);
      setAnomalies((prev) => prev.map((a) => (a._id === id ? updated : a)));
      if (selectedAnomaly?._id === id) {
        setSelectedAnomaly(updated);
      }
      // Refresh summary counts
      AnomalyService.getSummary().then(setSummary).catch(console.warn);
      return updated;
    } catch (err: any) {
      setError(err?.message || 'Failed to update anomaly status');
      throw err;
    }
  };

  const submitFeedback = async (
    id: string,
    feedback: AnomalyFeedbackType,
    notes?: string,
  ) => {
    try {
      const updated = await AnomalyService.recordFeedback(id, feedback, notes);
      setAnomalies((prev) => prev.map((a) => (a._id === id ? updated : a)));
      if (selectedAnomaly?._id === id) {
        setSelectedAnomaly(updated);
      }
      setFeedbackSuccess('Thanks. Your feedback has been recorded.');
      setTimeout(() => setFeedbackSuccess(null), 4000);
      // Refresh summary counts
      AnomalyService.getSummary().then(setSummary).catch(console.warn);
      return updated;
    } catch (err: any) {
      setError(err?.message || 'Failed to record feedback');
      throw err;
    }
  };

  return {
    anomalies,
    summary,
    loading,
    detecting,
    error,
    filters,
    pagination,
    selectedAnomaly,
    feedbackSuccess,
    setSelectedAnomaly,
    setFilters,
    runDetection,
    updateStatus,
    submitFeedback,
    refresh: fetchAnomaliesAndSummary,
  };
}
