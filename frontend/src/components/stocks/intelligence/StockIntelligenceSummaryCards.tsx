import React from 'react';
import { UniverseIntelligenceSummary } from '../../../types/stockPrediction.ts';
import { Database, BrainCircuit, Award, TrendingUp, CheckCircle, Clock } from 'lucide-react';

interface Props {
  summary: UniverseIntelligenceSummary | null;
  loading: boolean;
}

export const StockIntelligenceSummaryCards: React.FC<Props> = ({ summary, loading }) => {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-800/60 rounded-xl border border-gray-700/50" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Supported Stocks',
      value: summary.total_supported.toLocaleString(),
      subtext: `${summary.predictions_available} predictions ready`,
      icon: Database,
      color: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Coverage Ready',
      value: `${summary.predictions_available} / ${summary.total_supported}`,
      subtext: summary.stocks_without_valid_models > 0
        ? `${summary.stocks_without_valid_models} insufficient data`
        : '100% Universe active',
      icon: CheckCircle,
      color: 'from-emerald-500/20 to-teal-500/20',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Registered Models',
      value: summary.registered_models.toLocaleString(),
      subtext: 'Walk-forward evaluated',
      icon: BrainCircuit,
      color: 'from-purple-500/20 to-indigo-500/20',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      title: 'Production Models',
      value: summary.production_models.toLocaleString(),
      subtext: 'Best candidate selected',
      icon: Award,
      color: 'from-amber-500/20 to-yellow-500/20',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      title: 'Avg Directional Acc.',
      value: `${summary.avg_directional_accuracy.toFixed(1)}%`,
      subtext: 'Historical out-of-sample',
      icon: TrendingUp,
      color: 'from-rose-500/20 to-pink-500/20',
      border: 'border-rose-500/30',
      iconColor: 'text-rose-400',
    },
    {
      title: 'Last Retrained',
      value: summary.last_training_time
        ? new Date(summary.last_training_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Active',
      subtext: summary.last_training_time
        ? new Date(summary.last_training_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : 'Auto-sync',
      icon: Clock,
      color: 'from-slate-500/20 to-gray-500/20',
      border: 'border-gray-600/30',
      iconColor: 'text-gray-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className={`p-3.5 rounded-xl border bg-gradient-to-br ${card.color} ${card.border} backdrop-blur-md flex flex-col justify-between transition-all hover:scale-[1.01]`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                {card.title}
              </span>
              <Icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-white tracking-tight">{card.value}</div>
              <div className="text-[11px] text-gray-400 truncate mt-0.5">{card.subtext}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
