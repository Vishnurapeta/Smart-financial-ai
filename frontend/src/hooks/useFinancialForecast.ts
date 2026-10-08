import { useState, useEffect, useCallback } from 'react';
import { FinancialForecastService } from '../services/financialForecast.service.ts';
import {
  ExpenseForecastResponse,
  CashFlowForecastResponse,
  ForecastHistoryRecord,
} from '../types/forecasting.ts';

export function useFinancialForecast() {
  const [horizon, setHorizon] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<'expenses' | 'cash_flow'>('cash_flow');
  const [category, setCategory] = useState<string>('all');
  const [preferredModel, setPreferredModel] = useState<string>('auto');

  const [expenseData, setExpenseData] = useState<ExpenseForecastResponse | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowForecastResponse | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ForecastHistoryRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, cfRes, histRes] = await Promise.all([
        FinancialForecastService.getExpenseForecast({
          horizon,
          frequency: 'monthly',
          category: category !== 'all' ? category : undefined,
          preferredModel: preferredModel !== 'auto' ? preferredModel : undefined,
        }).catch((err) => {
          console.warn('Expense forecast fetch warning:', err);
          return null;
        }),
        FinancialForecastService.getCashFlowForecast({
          horizon,
          frequency: 'monthly',
        }).catch((err) => {
          console.warn('Cash flow forecast fetch warning:', err);
          return null;
        }),
        FinancialForecastService.getForecastHistory({ limit: 15 }).catch(() => []),
      ]);

      if (expRes) setExpenseData(expRes);
      if (cfRes) setCashFlowData(cfRes);
      if (histRes) setHistoryRecords(histRes);

      if (!expRes && !cfRes) {
        setError('Unable to load forecasting data. Please check connection and try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch financial forecast');
    } finally {
      setLoading(false);
    }
  }, [horizon, category, preferredModel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Determine if history is insufficient
  const isInsufficient =
    expenseData?.status === 'insufficient_data' ||
    cashFlowData?.status === 'insufficient_data';

  return {
    horizon,
    setHorizon,
    activeTab,
    setActiveTab,
    category,
    setCategory,
    preferredModel,
    setPreferredModel,
    expenseData,
    cashFlowData,
    historyRecords,
    loading,
    error,
    isInsufficient,
    refresh: fetchData,
  };
}
