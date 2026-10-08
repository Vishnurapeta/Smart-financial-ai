import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Target } from 'lucide-react';
import { HistoricalBar } from '../../types/stock.ts';
import { StockPredictionResponse, StockPredictionRecord } from '../../types/stockPrediction.ts';

interface ActualPredictedChartProps {
  symbol: string;
  bars: HistoricalBar[];
  prediction: StockPredictionResponse | null;
  history?: StockPredictionRecord[];
  currencySymbol?: string;
}

export const ActualPredictedChart: React.FC<ActualPredictedChartProps> = ({
  symbol,
  bars,
  prediction,
  history = [],
  currencySymbol = '$',
}) => {
  // Construct timeline combining trailing 30 actual bars + forward forecast step
  const trajectoryData = useMemo(() => {
    if (!bars || bars.length === 0) return [];

    // Take trailing 30 trading sessions
    const trailingBars = bars.slice(-30);

    const points = trailingBars.map((b) => ({
      date: b.timestamp.includes('T') ? b.timestamp.split('T')[0] : b.timestamp,
      actualPrice: Math.round(b.close * 100) / 100,
      predictedPrice: undefined as number | undefined,
      isForecast: false,
    }));

    // If prediction exists, append the current point as bridge and the future forecast target
    if (prediction && points.length > 0) {
      const lastPoint = points[points.length - 1];
      // Set the last point's predicted price to actual price to seamlessly bridge the forecast line
      lastPoint.predictedPrice = lastPoint.actualPrice;

      // Project target date (+horizon trading days)
      const targetDateLabel = `Forecast (+${prediction.horizon}d)`;
      points.push({
        date: targetDateLabel,
        actualPrice: undefined as unknown as number,
        predictedPrice: Math.round(prediction.predicted_value * 100) / 100,
        isForecast: true,
      });
    }

    return points;
  }, [bars, prediction]);

  if (!bars || bars.length === 0) {
    return null;
  }

  const isReturnPositive = (prediction?.predicted_return ?? 0) >= 0;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Actual vs. Model Forecast Trajectory ({symbol})
          </h3>
          <p className="text-xs text-slate-400">
            Recent 30-day closing prices with forward model prediction projection
          </p>
        </div>

        {prediction && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Target Forecast:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-lg border ${
                isReturnPositive
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}
            >
              {currencySymbol}
              {prediction.predicted_value.toFixed(2)} (
              {isReturnPositive ? '+' : ''}
              {(prediction.predicted_return * 100).toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trajectoryData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis
              domain={['auto', 'auto']}
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <Tooltip
              content={(props: any) => {
                const { active, payload, label } = props;
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-2xl shadow-xl text-xs font-mono space-y-1">
                      <div className="font-semibold text-white border-b border-slate-800 pb-1">
                        {label}
                      </div>
                      {payload.map((p: any) => {
                        if (p.value === undefined || p.value === null) return null;
                        return (
                          <div key={p.dataKey} className="flex justify-between gap-4">
                            <span style={{ color: p.color }}>{p.name}:</span>
                            <span className="font-bold text-white">
                              {currencySymbol}
                              {Number(p.value).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />

            {/* Historical Actual Price Line */}
            <Line
              type="monotone"
              dataKey="actualPrice"
              name="Actual Close"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {/* Forward Model Forecast Trajectory */}
            <Line
              type="monotone"
              dataKey="predictedPrice"
              name="Model Forecast"
              stroke="#10b981"
              strokeWidth={2.5}
              strokeDasharray="5 3"
              dot={{ r: 4, fill: '#10b981' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
        <span>* Dashed green line represents model estimated price trajectory over horizon.</span>
        <span>
          {history.length > 0
            ? `${history.length} audit records in store • Zero lookahead guaranteed`
            : 'Zero lookahead guaranteed during inference'}
        </span>
      </div>
    </div>
  );
};

export default ActualPredictedChart;
