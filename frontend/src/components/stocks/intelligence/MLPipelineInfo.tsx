import React from 'react';
import { Database, Cpu, ShieldCheck, Activity, Layers, GitBranch, Terminal } from 'lucide-react';

export const MLPipelineInfo: React.FC = () => {
  const pipelineSteps = [
    {
      title: 'Data Source',
      value: 'Historical OHLCV',
      desc: 'Validated chronological market bars from live exchange feeds and Yahoo Finance fallback.',
      icon: Database,
      color: 'text-emerald-400',
    },
    {
      title: 'Feature Engineering',
      value: 'Technical Indicators + Lags',
      desc: '58 quantitative features (SMA, EMA, RSI, MACD, Bollinger, Volatility, Multi-session Lags).',
      icon: Cpu,
      color: 'text-cyan-400',
    },
    {
      title: 'Validation',
      value: 'Walk-Forward Holdout',
      desc: 'Chronological time-series split (70% train, 15% validation, 15% test) without shuffling.',
      icon: GitBranch,
      color: 'text-teal-300',
    },
    {
      title: 'Leakage Prevention',
      value: 'Strictly Enabled',
      desc: 'Mathematical guarantees that feature calculations never incorporate future timestamps.',
      icon: ShieldCheck,
      color: 'text-emerald-300',
    },
    {
      title: 'Model Registry',
      value: 'Connected & Versioned',
      desc: 'Centralized model artifact storage with audit lineage, versioning, and status promotion.',
      icon: Layers,
      color: 'text-purple-400',
    },
    {
      title: 'Inference Service',
      value: 'FastAPI Microservice',
      desc: 'Asynchronous Python ASGI service serving low-latency forecasts via REST endpoints.',
      icon: Terminal,
      color: 'text-blue-400',
    },
    {
      title: 'Prediction Engine',
      value: 'Production Estimators',
      desc: 'Gradient boosted trees (XGBoost), ensemble Random Forests, and linear baselines.',
      icon: Activity,
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
      <div className="border-b border-slate-800/80 pb-4">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Terminal className="w-5 h-5 text-teal-400" />
          <span>Machine Learning Pipeline Architecture</span>
        </h2>
        <p className="text-xs text-slate-400">
          Enterprise technical design specifications and data governance principles
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {pipelineSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <Icon className={`w-3.5 h-3.5 ${step.color}`} />
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  {step.title}
                </span>
              </div>
              <div className="font-bold text-white text-sm font-mono">{step.value}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MLPipelineInfo;
