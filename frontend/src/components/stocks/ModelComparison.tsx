import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Layers, ChevronRight, Cpu } from 'lucide-react';
import { ModelMetadataCard } from '../../types/stockPrediction.ts';

interface ModelComparisonProps {
  symbol: string;
  models: ModelMetadataCard[];
  selectedModelName?: string;
  onSelectModel?: (model: ModelMetadataCard) => void;
  loading?: boolean;
}

export const ModelComparison: React.FC<ModelComparisonProps> = ({
  symbol,
  models,
  selectedModelName,
  onSelectModel,
  loading = false,
}) => {
  // Normalize and group models for the active target
  const comparisonData = useMemo(() => {
    if (!models || models.length === 0) return [];

    return models.map((m) => {
      const valMetrics = m.metrics?.validation || {};
      const testMetrics = m.metrics?.test || {};

      const valRmse = typeof valMetrics.rmse === 'number' ? valMetrics.rmse : 0;
      const valMae = typeof valMetrics.mae === 'number' ? valMetrics.mae : 0;
      const valR2 = typeof valMetrics.r2 === 'number' ? valMetrics.r2 : 0;
      const dirAcc =
        typeof valMetrics.directional_accuracy === 'number'
          ? valMetrics.directional_accuracy
          : undefined;

      const testRmse = typeof testMetrics.rmse === 'number' ? testMetrics.rmse : 0;

      return {
        id: m.model_id,
        name: m.model_name,
        target: m.target,
        horizon: m.horizon,
        status: m.status,
        version: m.model_version,
        valRmse: Math.round(valRmse * 10000) / 10000,
        valMae: Math.round(valMae * 10000) / 10000,
        valR2: Math.round(valR2 * 1000) / 1000,
        dirAcc: dirAcc !== undefined ? Math.round(dirAcc * 10) / 10 : undefined,
        testRmse: Math.round(testRmse * 10000) / 10000,
        rawModel: m,
      };
    });
  }, [models]);

  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-center text-xs text-slate-400">
        <Cpu className="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
        Loading registered model metrics...
      </div>
    );
  }

  if (comparisonData.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-center text-xs text-slate-400">
        No registered experimentation models found for {symbol}. Run the experimentation framework to register candidate models.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Model Benchmark &amp; Comparison ({symbol})
          </h3>
          <p className="text-xs text-slate-400">
            Chronological walk-forward validation and test evaluation metrics across registered architectures
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300">
          {comparisonData.length} Models Registered
        </span>
      </div>

      {/* Visual Benchmark Bar Chart */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-300 block">
          Validation Error Comparison (Lower is Better):
        </span>
        <div className="h-56 sm:h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData}
              margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#cbd5e1', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={(props: any) => {
                  const { active, payload, label } = props;
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-xs font-mono space-y-1">
                        <div className="font-bold text-white">{label}</div>
                        {payload.map((p: any) => (
                          <div key={p.dataKey} className="flex justify-between gap-4">
                            <span style={{ color: p.color }}>{p.name}:</span>
                            <span className="font-bold text-white">{p.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="valRmse" name="Validation RMSE" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="valMae" name="Validation MAE" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Architecture</th>
              <th className="py-2.5 px-2">Target</th>
              <th className="py-2.5 px-2">Status</th>
              <th className="py-2.5 px-3 text-right">Val RMSE</th>
              <th className="py-2.5 px-3 text-right">Val MAE</th>
              <th className="py-2.5 px-3 text-right">Val R²</th>
              <th className="py-2.5 px-3 text-right">Dir Acc (%)</th>
              <th className="py-2.5 px-3 text-right">Test RMSE</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {comparisonData.map((row) => {
              const isSelected = selectedModelName?.toLowerCase() === row.name.toLowerCase();

              return (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isSelected ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{row.name}</span>
                      <span className="text-[10px] text-slate-400">v{row.version}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-300 text-[11px] font-sans">
                    {row.target === 'target_next_return' ? 'Return (%)' : 'Price (₹)'} (h=
                    {row.horizon})
                  </td>
                  <td className="py-3 px-2">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        row.status === 'PRODUCTION'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : row.status === 'CANDIDATE'
                            ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-400">{row.valRmse}</td>
                  <td className="py-3 px-3 text-right text-slate-200">{row.valMae}</td>
                  <td
                    className={`py-3 px-3 text-right ${
                      row.valR2 >= 0 ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  >
                    {row.valR2}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {row.dirAcc !== undefined ? (
                      <span
                        className={`font-bold ${
                          row.dirAcc >= 52 ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {row.dirAcc}%
                      </span>
                    ) : (
                      '---'
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-400">{row.testRmse}</td>
                  <td className="py-3 px-3 text-center">
                    {onSelectModel && (
                      <button
                        onClick={() => onSelectModel(row.rawModel)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-sans font-semibold transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Predict'}
                        <ChevronRight className="w-3 h-3" />
                      </button>
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

export default ModelComparison;
