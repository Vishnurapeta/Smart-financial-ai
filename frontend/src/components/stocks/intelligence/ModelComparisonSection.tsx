import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Cpu, Award } from 'lucide-react';
import { ModelMetadataCard } from '../../../types/stockPrediction.ts';
import { StockPredictionService } from '../../../services/stockPrediction.service.ts';

interface ModelComparisonSectionProps {
  availableStocks: string[];
}

export const ModelComparisonSection: React.FC<ModelComparisonSectionProps> = ({
  availableStocks,
}) => {
  const [selectedStock, setSelectedStock] = useState<string>(availableStocks[0] || 'TCS');
  const [selectedMetric, setSelectedMetric] = useState<
    'directional_accuracy' | 'rmse' | 'mae' | 'r2' | 'mape'
  >('directional_accuracy');
  const [models, setModels] = useState<ModelMetadataCard[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Sync selected stock if availableStocks changes
  useEffect(() => {
    if (availableStocks.length > 0 && !availableStocks.includes(selectedStock)) {
      setSelectedStock(availableStocks[0]);
    }
  }, [availableStocks, selectedStock]);

  // Fetch models for active stock
  useEffect(() => {
    let isCancelled = false;
    const fetchModels = async () => {
      setLoading(true);
      try {
        const res = await StockPredictionService.listModels({ symbol: selectedStock });
        if (!isCancelled) {
          setModels(res.models || []);
        }
      } catch {
        if (!isCancelled) setModels([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchModels();
    return () => {
      isCancelled = true;
    };
  }, [selectedStock]);

  // Deduplicate and aggregate latest/best model per architecture
  const comparisonItems = useMemo(() => {
    const archMap = new Map<
      string,
      {
        id: string;
        name: string;
        algorithm: string;
        target: string;
        horizon: number;
        status: string;
        version: string;
        da: number;
        rmse: number;
        mae: number;
        r2: number;
        mape: number;
      }
    >();

    models.forEach((m) => {
      const valM = m.metrics?.validation || {};
      const archName = m.model_name;

      const da = typeof valM.directional_accuracy === 'number' ? valM.directional_accuracy : 0;
      const rmse = typeof valM.rmse === 'number' ? valM.rmse : 0;
      const mae = typeof valM.mae === 'number' ? valM.mae : 0;
      const r2 = typeof valM.r2 === 'number' ? valM.r2 : 0;
      const mape = typeof valM.mape === 'number' ? valM.mape : 0;

      // Keep production models preferred, or replace if better metric
      const existing = archMap.get(archName);
      if (!existing || (m.status === 'PRODUCTION' && existing.status !== 'PRODUCTION')) {
        archMap.set(archName, {
          id: m.model_id,
          name: archName,
          algorithm: archName,
          target: m.target,
          horizon: m.horizon,
          status: m.status,
          version: m.model_version,
          da,
          rmse,
          mae,
          r2,
          mape,
        });
      }
    });

    return Array.from(archMap.values());
  }, [models]);

  // Find best model based on chosen metric
  const bestModelName = useMemo(() => {
    if (comparisonItems.length === 0) return null;

    if (selectedMetric === 'directional_accuracy') {
      let maxVal = -Infinity;
      let bestName = comparisonItems[0].name;
      comparisonItems.forEach((item) => {
        if (item.da > maxVal) {
          maxVal = item.da;
          bestName = item.name;
        }
      });
      return bestName;
    }

    if (selectedMetric === 'r2') {
      let maxVal = -Infinity;
      let bestName = comparisonItems[0].name;
      comparisonItems.forEach((item) => {
        if (item.r2 > maxVal) {
          maxVal = item.r2;
          bestName = item.name;
        }
      });
      return bestName;
    }

    // For RMSE, MAE, MAPE: lower is better
    let minVal = Infinity;
    let bestName = comparisonItems[0].name;
    comparisonItems.forEach((item) => {
      const val = item[selectedMetric];
      if (val > 0 && val < minVal) {
        minVal = val;
        bestName = item.name;
      }
    });
    return bestName;
  }, [comparisonItems, selectedMetric]);

  // Format data for chart
  const chartData = comparisonItems.map((item) => {
    let displayVal = 0;
    if (selectedMetric === 'directional_accuracy') displayVal = item.da;
    else if (selectedMetric === 'rmse') displayVal = Number(item.rmse.toFixed(4));
    else if (selectedMetric === 'mae') displayVal = Number(item.mae.toFixed(4));
    else if (selectedMetric === 'r2') displayVal = Number(item.r2.toFixed(3));
    else if (selectedMetric === 'mape') displayVal = Number(item.mape.toFixed(2));

    return {
      name: item.name,
      value: displayVal,
      isBest: item.name === bestModelName,
    };
  });

  const METRIC_LABELS = {
    directional_accuracy: 'Directional Accuracy (%)',
    rmse: 'RMSE (Lower is Better)',
    mae: 'MAE (Lower is Better)',
    r2: 'R² Score (Higher is Better)',
    mape: 'MAPE (%)',
  };

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header with Stock & Metric Selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            <span>Model Comparison & Algorithmic Benchmarks</span>
          </h2>
          <p className="text-xs text-slate-400">
            Side-by-side performance evaluation across trained model families on identical holdout data
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Stock selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-500 font-sans px-2">Stock:</span>
            {availableStocks.map((sym) => (
              <button
                key={sym}
                onClick={() => setSelectedStock(sym)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  selectedStock === sym
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Metric selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[11px] text-slate-500 font-sans px-2">Metric:</span>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="bg-transparent text-emerald-400 font-mono font-bold focus:outline-none cursor-pointer pr-2"
            >
              <option value="directional_accuracy" className="bg-slate-950 text-white">
                Directional Accuracy (%)
              </option>
              <option value="rmse" className="bg-slate-950 text-white">
                Root Mean Squared Error (RMSE)
              </option>
              <option value="mae" className="bg-slate-950 text-white">
                Mean Absolute Error (MAE)
              </option>
              <option value="r2" className="bg-slate-950 text-white">
                R² Determination
              </option>
              <option value="mape" className="bg-slate-950 text-white">
                Mean Absolute % Error (MAPE)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Chart Canvas */}
      <div className="h-64 w-full pt-1">
        {loading ? (
          <div className="h-full w-full bg-slate-950/40 rounded-2xl flex items-center justify-center animate-pulse">
            <span className="text-xs text-slate-500 font-mono">Loading model comparisons...</span>
          </div>
        ) : comparisonItems.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-slate-500 font-mono">
            No trained models registered for {selectedStock}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  borderColor: '#334155',
                  borderRadius: '1rem',
                  fontSize: '11px',
                }}
                formatter={(val: any) => [val, METRIC_LABELS[selectedMetric]]}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isBest ? '#10B981' : '#6366F1'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 font-mono">
            <tr>
              <th className="py-3 px-4">Architecture</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">MAE</th>
              <th className="py-3 px-4">RMSE</th>
              <th className="py-3 px-4">R² Score</th>
              <th className="py-3 px-4">Direction Acc</th>
              <th className="py-3 px-4 text-right">Performance Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {comparisonItems.map((item) => {
              const isBest = item.name === bestModelName;
              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-850/50 transition-colors ${
                    isBest ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  {/* Architecture */}
                  <td className="py-3.5 px-4 font-bold text-white font-sans text-sm flex items-center gap-2">
                    <span>{item.name}</span>
                    {isBest && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                        <Award className="w-3 h-3" />
                        BEST
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.status === 'PRODUCTION'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  {/* Version */}
                  <td className="py-3.5 px-4 text-slate-400">{item.version}</td>

                  {/* MAE */}
                  <td className="py-3.5 px-4 text-slate-200">{item.mae ? item.mae.toFixed(4) : 'N/A'}</td>

                  {/* RMSE */}
                  <td className="py-3.5 px-4 text-slate-200">{item.rmse ? item.rmse.toFixed(4) : 'N/A'}</td>

                  {/* R² */}
                  <td className="py-3.5 px-4 text-slate-200">{item.r2 ? item.r2.toFixed(3) : 'N/A'}</td>

                  {/* Direction Acc */}
                  <td className="py-3.5 px-4 font-bold text-emerald-400">
                    {item.da ? `${item.da.toFixed(1)}%` : 'N/A'}
                  </td>

                  {/* Rank Badge */}
                  <td className="py-3.5 px-4 text-right">
                    {isBest ? (
                      <span className="text-emerald-400 font-bold text-xs">★ Top Performer</span>
                    ) : (
                      <span className="text-slate-500 text-xs">Baseline / Alternative</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModelComparisonSection;
