import { useState, useEffect, useCallback } from 'react';
import { StockPredictionService } from '../services/stockPrediction.service.ts';
import {
  StockPredictionResponse,
  ModelMetadataCard,
  StockPredictionRecord,
} from '../types/stockPrediction.ts';

interface UseStockPredictionOptions {
  initialSymbol?: string;
  initialHorizon?: number;
  initialTarget?: string;
  autoFetch?: boolean;
}

export function useStockPrediction({
  initialSymbol = 'TCS',
  initialHorizon = 1,
  initialTarget = 'target_next_return',
  autoFetch = true,
}: UseStockPredictionOptions = {}) {
  const [symbol, setSymbol] = useState<string>(initialSymbol.trim().toUpperCase());
  const [horizon, setHorizon] = useState<number>(initialHorizon);
  const [target, setTarget] = useState<string>(initialTarget);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [allowCandidate, setAllowCandidate] = useState<boolean>(true);

  // Data states
  const [prediction, setPrediction] = useState<StockPredictionResponse | null>(null);
  const [models, setModels] = useState<ModelMetadataCard[]>([]);
  const [history, setHistory] = useState<StockPredictionRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState<number>(0);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // 1. Fetch prediction
  const fetchPrediction = useCallback(
    async (overrideSymbol?: string, overrideHorizon?: number, overrideTarget?: string) => {
      const activeSym = (overrideSymbol || symbol).trim().toUpperCase();
      const activeHor = overrideHorizon ?? horizon;
      const activeTar = overrideTarget ?? target;

      if (!activeSym) return;

      setLoading(true);
      setError(null);
      setErrorStatus(null);
      setPrediction(null);

      try {
        const resp = await StockPredictionService.predict({
          symbol: activeSym,
          horizon: activeHor,
          target: activeTar,
          model_version: modelVersion,
          allow_candidate: allowCandidate,
        });
        setPrediction(resp);
        return resp;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to generate stock prediction';
        const status =
          (err as { status?: number })?.status ||
          ((err as { detail?: string })?.detail ? 400 : 500);

        setError(message);
        setErrorStatus(status);
        setPrediction(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [symbol, horizon, target, modelVersion, allowCandidate],
  );

  // 2. Fetch models & evaluation metrics
  const fetchModels = useCallback(async (targetSymbol?: string) => {
    const activeSym = (targetSymbol || symbol).trim().toUpperCase();
    if (!activeSym) return;

    setModelsLoading(true);
    try {
      const resp = await StockPredictionService.getModelMetrics(activeSym);
      setModels(resp.models || []);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [symbol]);

  // 3. Fetch prediction audit history
  const fetchHistory = useCallback(
    async (targetSymbol?: string, targetHorizon?: number) => {
      const activeSym = (targetSymbol || symbol).trim().toUpperCase();
      if (!activeSym) return;

      setHistoryLoading(true);
      try {
        const resp = await StockPredictionService.getPredictionHistory(activeSym, {
          limit: 20,
          horizon: targetHorizon,
        });
        setHistory(resp.items || []);
        setHistoryTotal(resp.total_count || 0);
      } catch {
        setHistory([]);
        setHistoryTotal(0);
      } finally {
        setHistoryLoading(false);
      }
    },
    [symbol],
  );

  // Automatically fetch when symbol changes or on mount
  useEffect(() => {
    if (autoFetch && symbol) {
      fetchPrediction();
      fetchModels();
      fetchHistory();
    }
  }, [symbol, autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Automatically re-fetch prediction when horizon or target changes
  useEffect(() => {
    if (autoFetch && symbol) {
      fetchPrediction();
    }
  }, [horizon, target]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    symbol,
    setSymbol,
    horizon,
    setHorizon,
    target,
    setTarget,
    modelVersion,
    setModelVersion,
    allowCandidate,
    setAllowCandidate,
    prediction,
    models,
    history,
    historyTotal,
    loading,
    modelsLoading,
    historyLoading,
    error,
    errorStatus,
    refetchPrediction: fetchPrediction,
    refetchModels: fetchModels,
    refetchHistory: fetchHistory,
  };
}

export default useStockPrediction;
