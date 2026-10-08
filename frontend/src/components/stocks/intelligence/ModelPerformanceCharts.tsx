import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { StockPerformanceMetric, ModelArchitecturePerformance } from '../../../types/stockPrediction.ts';

interface ModelPerformanceChartsProps {
  performanceByStock: StockPerformanceMetric[];
  performanceByModel: ModelArchitecturePerformance[];
  loading: boolean;
}

export const ModelPerformanceCharts: React.FC<ModelPerformanceChartsProps> = ({
  performanceByStock,
  performanceByModel,
  loading,
}) => {
  const [activeTab, setActiveTab] = useState<'accuracy' | 'rmse' | 'mae' | 'architectures'>('accuracy');

  // Format stock data for Recharts
  const stockChartData = performanceByStock.map((s) => ({
    name: s.symbol,
    accuracy: Number(s.directional_accuracy.toFixed(1)),
    rmse: Number(s.rmse.toFixed(4)),
    mae: Number(s.mae.toFixed(4)),
    r2: Number(s.r2.toFixed(3)),
    model: s.model_name,
  }));

  // Format model architecture comparison data
  const modelChartData = performanceByModel.map((m) => ({
    name: m.model_name,
    accuracy: Number(m.avg_directional_accuracy.toFixed(1)),
    rmse: Number((m.avg_rmse * 100).toFixed(2)), // Scaled percentage for clear comparative view
    mae: Number((m.avg_mae * 100).toFixed(2)),
    count: m.count,
  }));

  const COLORS = ['#10B981', '#14B8A6', '#06B6D4', '#6366F1', '#8B5CF6'];

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header and Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-400" />
            <span>Model Performance Overview</span>
          </h2>
          <p className="text-xs text-slate-400">
            Chronological holdout validation metrics (MAE, RMSE, MAPE, R², Directional Accuracy)
          </p>
        </div>

        {/* Tab selection */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('accuracy')}
            className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'accuracy'
                ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Directional Accuracy
          </button>
          <button
            onClick={() => setActiveTab('rmse')}
            className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'rmse'
                ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            RMSE by Stock
          </button>
          <button
            onClick={() => setActiveTab('mae')}
            className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'mae'
                ? 'bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            MAE by Stock
          </button>
          <button
            onClick={() => setActiveTab('architectures')}
            className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'architectures'
                ? 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Architectures Benchmark
          </button>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-72 w-full pt-2">
        {loading ? (
          <div className="h-full w-full bg-slate-950/40 rounded-2xl flex items-center justify-center animate-pulse">
            <span className="text-xs text-slate-500 font-mono">Loading performance charts...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'accuracy' ? (
              <BarChart data={stockChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  stroke="#64748b"
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderColor: '#334155',
                    borderRadius: '1rem',
                    fontSize: '11px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Directional Accuracy']}
                />
                <Bar dataKey="accuracy" radius={[8, 8, 0, 0]}>
                  {stockChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : activeTab === 'rmse' ? (
              <BarChart data={stockChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
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
                  formatter={(val: any) => [val, 'Root Mean Squared Error (RMSE)']}
                />
                <Bar dataKey="rmse" fill="#06B6D4" radius={[8, 8, 0, 0]} />
              </BarChart>
            ) : activeTab === 'mae' ? (
              <BarChart data={stockChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
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
                  formatter={(val: any) => [val, 'Mean Absolute Error (MAE)']}
                />
                <Bar dataKey="mae" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={modelChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
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
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="accuracy" name="Avg Direction Acc (%)" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="rmse" name="Avg RMSE (scaled %)" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="mae" name="Avg MAE (scaled %)" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Metrics Legend Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800 font-mono">
        <div>
          <span className="text-[10px] text-slate-500 font-sans block">Evaluation Horizon</span>
          <strong className="text-white">Chronological Holdout</strong>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 font-sans block">Regression Metric</span>
          <strong className="text-cyan-400">MAE & RMSE (Zero Lookahead)</strong>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 font-sans block">Classification Metric</span>
          <strong className="text-emerald-400">Directional Accuracy (%)</strong>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 font-sans block">Best Estimator</span>
          <strong className="text-teal-300">XGBoost Production v1.0.0</strong>
        </div>
      </div>
    </div>
  );
};

export default ModelPerformanceCharts;
