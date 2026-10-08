import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
} from 'recharts';
import { Activity, Eye, EyeOff } from 'lucide-react';
import { HistoricalBar } from '../../types/stock.ts';

interface PriceChartProps {
  symbol: string;
  bars: HistoricalBar[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  currencySymbol?: string;
  loading?: boolean;
}

const TIMEFRAMES = [
  { label: '1W', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

export const PriceChart: React.FC<PriceChartProps> = ({
  bars,
  timeframe,
  onTimeframeChange,
  currencySymbol = '$',
  loading = false,
}) => {
  // Indicator toggles
  const [showSMA20, setShowSMA20] = useState(false);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [chartType, setChartType] = useState<'area' | 'line'>('area');

  // Compute technical indicators client-side from historical bars
  const chartData = useMemo(() => {
    if (!bars || bars.length === 0) return [];

    return bars.map((bar, idx) => {
      // SMA 20
      let sma20: number | undefined = undefined;
      if (idx >= 19) {
        const slice20 = bars.slice(idx - 19, idx + 1);
        sma20 = slice20.reduce((acc, b) => acc + b.close, 0) / 20;
      }

      // SMA 50
      let sma50: number | undefined = undefined;
      if (idx >= 49) {
        const slice50 = bars.slice(idx - 49, idx + 1);
        sma50 = slice50.reduce((acc, b) => acc + b.close, 0) / 50;
      }

      // Bollinger Bands (20 periods, 2 std dev)
      let bbUpper: number | undefined = undefined;
      let bbLower: number | undefined = undefined;
      if (sma20 !== undefined && idx >= 19) {
        const slice = bars.slice(idx - 19, idx + 1);
        const variance =
          slice.reduce((acc, b) => acc + Math.pow(b.close - sma20!, 2), 0) / 20;
        const std = Math.sqrt(variance);
        bbUpper = sma20 + 2 * std;
        bbLower = sma20 - 2 * std;
      }

      // RSI (14 periods)
      let rsi: number | undefined = undefined;
      if (idx >= 14) {
        let gains = 0;
        let losses = 0;
        for (let i = idx - 13; i <= idx; i++) {
          const diff = bars[i].close - bars[i - 1].close;
          if (diff >= 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        if (avgLoss === 0) {
          rsi = 100;
        } else {
          const rs = avgGain / avgLoss;
          rsi = 100 - 100 / (1 + rs);
        }
      }

      const dateStr = bar.timestamp.includes('T')
        ? bar.timestamp.split('T')[0]
        : bar.timestamp;

      return {
        date: dateStr,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        sma20: sma20 ? Math.round(sma20 * 100) / 100 : undefined,
        sma50: sma50 ? Math.round(sma50 * 100) / 100 : undefined,
        bbUpper: bbUpper ? Math.round(bbUpper * 100) / 100 : undefined,
        bbLower: bbLower ? Math.round(bbLower * 100) / 100 : undefined,
        rsi: rsi ? Math.round(rsi * 10) / 10 : undefined,
      };
    });
  }, [bars]);

  // Overall trend color
  const isUpTrend = useMemo(() => {
    if (chartData.length < 2) return true;
    return chartData[chartData.length - 1].close >= chartData[0].close;
  }, [chartData]);

  const strokeColor = isUpTrend ? '#10b981' : '#f43f5e';
  const fillColor = isUpTrend ? 'url(#greenGradient)' : 'url(#redGradient)';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-white flex items-center gap-1.5 mr-1">
            <Activity className="w-4 h-4 text-emerald-400" />
            Chart &amp; Technicals:
          </span>

          {/* Timeframe Buttons */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-950/70 border border-slate-800">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  timeframe === tf.value
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Type Toggle */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-950/70 border border-slate-800 ml-1">
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                chartType === 'area'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Area
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                chartType === 'line'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Line
            </button>
          </div>
        </div>

        {/* Technical Overlays Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setShowSMA20(!showSMA20)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] transition border cursor-pointer ${
              showSMA20
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {showSMA20 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            SMA 20
          </button>

          <button
            onClick={() => setShowSMA50(!showSMA50)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] transition border cursor-pointer ${
              showSMA50
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {showSMA50 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            SMA 50
          </button>

          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] transition border cursor-pointer ${
              showBollinger
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {showBollinger ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            BBands
          </button>

          <button
            onClick={() => setShowRSI(!showRSI)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] transition border cursor-pointer ${
              showRSI
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {showRSI ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            RSI (14)
          </button>
        </div>
      </div>

      {/* Main Price Chart */}
      <div className="h-72 sm:h-96 w-full relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Loading chart data...
            </div>
          </div>
        )}

        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            No historical price bars available for timeframe {timeframe}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="90%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="90%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />

              <YAxis
                domain={['auto', 'auto']}
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${currencySymbol}${val}`}
              />

              <Tooltip
                content={(props: any) => {
                  const { active, payload, label } = props;
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-2xl shadow-2xl text-xs space-y-1.5 min-w-[200px]">
                        <div className="font-semibold text-white border-b border-slate-800 pb-1 flex justify-between">
                          <span>{label}</span>
                          <span className="font-mono text-emerald-400">
                            {currencySymbol}
                            {data.close.toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                          <span className="text-slate-400">Open:</span>
                          <span className="text-right text-slate-200">
                            {currencySymbol}
                            {data.open.toFixed(2)}
                          </span>
                          <span className="text-slate-400">High:</span>
                          <span className="text-right text-emerald-400">
                            {currencySymbol}
                            {data.high.toFixed(2)}
                          </span>
                          <span className="text-slate-400">Low:</span>
                          <span className="text-right text-rose-400">
                            {currencySymbol}
                            {data.low.toFixed(2)}
                          </span>
                          <span className="text-slate-400">Volume:</span>
                          <span className="text-right text-cyan-400">
                            {data.volume ? data.volume.toLocaleString() : '---'}
                          </span>
                          {data.sma20 && (
                            <>
                              <span className="text-amber-400">SMA 20:</span>
                              <span className="text-right text-amber-300">
                                {currencySymbol}
                                {data.sma20}
                              </span>
                            </>
                          )}
                          {data.sma50 && (
                            <>
                              <span className="text-indigo-400">SMA 50:</span>
                              <span className="text-right text-indigo-300">
                                {currencySymbol}
                                {data.sma50}
                              </span>
                            </>
                          )}
                          {data.bbUpper && (
                            <>
                              <span className="text-cyan-400">BB Upper:</span>
                              <span className="text-right text-cyan-300">
                                {currencySymbol}
                                {data.bbUpper}
                              </span>
                            </>
                          )}
                          {data.bbLower && (
                            <>
                              <span className="text-cyan-400">BB Lower:</span>
                              <span className="text-right text-cyan-300">
                                {currencySymbol}
                                {data.bbLower}
                              </span>
                            </>
                          )}
                          {data.rsi && (
                            <>
                              <span className="text-purple-400">RSI (14):</span>
                              <span className="text-right text-purple-300">{data.rsi}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {chartType === 'area' ? (
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={strokeColor}
                  strokeWidth={2}
                  fill={fillColor}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={strokeColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Technical Indicator Lines */}
              {showSMA20 && (
                <Line
                  type="monotone"
                  dataKey="sma20"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  name="SMA 20"
                  isAnimationActive={false}
                />
              )}

              {showSMA50 && (
                <Line
                  type="monotone"
                  dataKey="sma50"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  dot={false}
                  name="SMA 50"
                  isAnimationActive={false}
                />
              )}

              {showBollinger && (
                <>
                  <Line
                    type="monotone"
                    dataKey="bbUpper"
                    stroke="#06b6d4"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    dot={false}
                    name="BB Upper"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="bbLower"
                    stroke="#06b6d4"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    dot={false}
                    name="BB Lower"
                    isAnimationActive={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* RSI Sub-Panel */}
      {showRSI && (
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-purple-300 font-mono">
              Relative Strength Index (RSI 14)
            </span>
            <span className="font-mono text-[10px]">
              Overbought: 70 • Neutral: 50 • Oversold: 30
            </span>
          </div>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 100]} ticks={[30, 50, 70]} stroke="#64748b" tick={{ fontSize: 9 }} />
                <Tooltip
                  content={(props: any) => {
                    const { active, payload } = props;
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[11px] font-mono text-purple-300">
                          RSI: {data.rsi}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rsi"
                  stroke="#c084fc"
                  fill="#c084fc"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceChart;
