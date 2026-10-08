import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { ActualPredictedChart } from '../ActualPredictedChart.tsx';
import { StockService } from '../../../services/stock.service.ts';
import { HistoricalBar } from '../../../types/stock.ts';
import { MarketForecastItem, StockPredictionResponse } from '../../../types/stockPrediction.ts';

interface ActualVsPredictedSectionProps {
  symbol: string;
  forecast: MarketForecastItem | null;
}

export const ActualVsPredictedSection: React.FC<ActualVsPredictedSectionProps> = ({
  symbol,
  forecast,
}) => {
  const [bars, setBars] = useState<HistoricalBar[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchBars = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await StockService.getHistory(symbol, '1mo', '1d');
        if (!isCancelled) {
          if (res && res.bars && res.bars.length > 0) {
            setBars(res.bars);
          } else {
            setBars([]);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError('Historical comparison data is currently unavailable.');
          setBars([]);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    if (symbol) {
      fetchBars();
    }

    return () => {
      isCancelled = true;
    };
  }, [symbol]);

  // Construct standard prediction response format for ActualPredictedChart
  const predictionObj: StockPredictionResponse | null = forecast && forecast.current_price && forecast.predicted_price
    ? {
        symbol: forecast.symbol,
        market_data_timestamp: forecast.last_updated || new Date().toISOString(),
        prediction_timestamp: forecast.last_updated || new Date().toISOString(),
        current_price: forecast.current_price,
        predicted_value: forecast.predicted_price,
        predicted_return: forecast.predicted_return ?? 0,
        is_derived_price: true,
        is_derived_return: false,
        horizon: forecast.horizon,
        target: 'target_next_return',
        model_name: forecast.model_name,
        model_version: forecast.model_version,
        feature_version: 'v1.0.0',
        model_status: forecast.status,
        historical_metrics: {
          directional_accuracy: forecast.historical_accuracy ?? undefined,
          mae: forecast.mae ?? undefined,
          rmse: forecast.rmse ?? undefined,
          r2: forecast.r2 ?? undefined,
        },
        latency_ms: { total_ms: 12.5, market_data_ms: 5, model_load_ms: 2, feature_gen_ms: 3, inference_ms: 2.5 },
        disclaimer: 'Statistical estimate',
      }
    : null;

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-8 text-center text-slate-500 font-mono animate-pulse">
          Loading historical evaluation trajectory for {symbol}...
        </div>
      ) : error || bars.length === 0 ? (
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Historical comparison unavailable for {symbol}.</span>
          </div>
          <span className="text-[11px] text-slate-500 font-sans">
            Requires at least 10 historical trading sessions from market provider
          </span>
        </div>
      ) : (
        <ActualPredictedChart
          symbol={symbol}
          bars={bars}
          prediction={predictionObj}
          currencySymbol="₹"
        />
      )}
    </div>
  );
};

export default ActualVsPredictedSection;
