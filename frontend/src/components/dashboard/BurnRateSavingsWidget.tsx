import React from 'react';
import { Flame, PiggyBank, ShieldCheck, AlertTriangle } from 'lucide-react';
import { DashboardKPIMetrics } from '../../types/analytics.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface BurnRateSavingsWidgetProps {
  kpis: DashboardKPIMetrics;
}

export const BurnRateSavingsWidget: React.FC<BurnRateSavingsWidgetProps> = ({ kpis }) => {
  const { format: formatCurrency } = useCurrency();

  // Runway calculation: balance / monthly burn rate
  const runwayMonths =
    kpis.monthlyBurnRate > 0 && kpis.totalBalance > 0
      ? (kpis.totalBalance / kpis.monthlyBurnRate).toFixed(1)
      : kpis.totalBalance <= 0
        ? '0.0'
        : 'Infinite';

  const savingsRate = Math.min(100, Math.max(0, kpis.savingsRate));

  // Determine financial velocity health
  let healthBadge = {
    title: 'Solid Growth Buffer',
    description: 'Saving > 20% of inflow; excellent financial trajectory.',
    color: 'emerald',
    icon: ShieldCheck,
  };

  if (kpis.savingsRate < 0 || (kpis.totalExpenses > kpis.totalIncome && kpis.totalIncome > 0)) {
    healthBadge = {
      title: 'Capital Deficit Warning',
      description: 'Outflow exceeds inflow. Burn rate is exhausting reserves.',
      color: 'rose',
      icon: AlertTriangle,
    };
  } else if (kpis.savingsRate < 10) {
    healthBadge = {
      title: 'Lean Safety Margin',
      description: 'Savings rate is under 10%. Aim for 20% target.',
      color: 'amber',
      icon: AlertTriangle,
    };
  }

  const BadgeIcon = healthBadge.icon;

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Burn Velocity & Runway
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">Runway & Rate</span>
        </div>
        <p className="text-xs text-slate-400">
          Monthly expenditure velocity and financial survival runway
        </p>
      </div>

      {/* Runway Indicator Card */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">Estimated Financial Runway</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-black text-white">{runwayMonths}</span>
            <span className="text-xs text-slate-400">months</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Based on current monthly burn of {formatCurrency(kpis.monthlyBurnRate)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
            Pace
          </span>
          <span className="text-sm font-bold text-amber-400">
            ~{formatCurrency(kpis.monthlyBurnRate / 30)}
          </span>
          <span className="text-[10px] text-slate-500 block">/ day</span>
        </div>
      </div>

      {/* Savings Rate Target Visualization */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
            Savings Rate Efficiency
          </span>
          <span className="font-mono font-bold text-emerald-400">{savingsRate.toFixed(1)}%</span>
        </div>

        {/* Dual Tier Progress Bar with 20% Target Marker */}
        <div className="relative w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${savingsRate}%` }}
          />
          {/* 20% Target Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/70"
            style={{ left: '20%' }}
            title="20% Recommended Savings Rate Benchmark"
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
          <span>0%</span>
          <span className="text-slate-400">20% (Target Rule)</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Health Status Pill */}
      <div
        className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
          healthBadge.color === 'emerald'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : healthBadge.color === 'amber'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}
      >
        <BadgeIcon className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-[11px]">{healthBadge.title}</div>
          <div className="text-[11px] opacity-80 mt-0.5">{healthBadge.description}</div>
        </div>
      </div>
    </div>
  );
};
