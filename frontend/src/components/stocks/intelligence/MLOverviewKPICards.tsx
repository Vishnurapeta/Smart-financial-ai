import React from 'react';
import { Database, Layers, ShieldCheck, Activity, Target, Clock } from 'lucide-react';
import { MLOverviewData } from '../../../types/stockPrediction.ts';

interface MLOverviewKPICardsProps {
  overview: MLOverviewData | null;
  loading: boolean;
}

export const MLOverviewKPICards: React.FC<MLOverviewKPICardsProps> = ({ overview, loading }) => {
  // Format time relative helper
  const formatTimeAgo = (iso?: string | null) => {
    if (!iso) return 'N/A';
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins > 0) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      return 'Just now';
    } catch {
      return 'N/A';
    }
  };

  const cards = [
    {
      id: 'reg_models',
      label: 'Registered Models',
      value: overview ? overview.total_models.toLocaleString() : 'N/A',
      subtext: `${overview ? overview.candidate_models : 0} in candidate validation`,
      icon: Database,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      id: 'supp_stocks',
      label: 'Supported Stocks',
      value: overview ? overview.supported_stocks_count.toLocaleString() : 'N/A',
      subtext: `${overview ? overview.unsupported_stocks.length : 0} market universe queued`,
      icon: Layers,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      id: 'prod_models',
      label: 'Production Models',
      value: overview ? overview.production_models.toLocaleString() : 'N/A',
      subtext: 'Active live inference estimators',
      icon: ShieldCheck,
      color: 'text-teal-300',
      bgColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/20',
    },
    {
      id: 'pred_requests',
      label: 'Prediction Requests',
      value: overview ? overview.total_prediction_requests.toLocaleString() : 'N/A',
      subtext: 'Persisted inference audit logs',
      icon: Activity,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
    {
      id: 'avg_acc',
      label: 'Avg Directional Accuracy',
      value:
        overview && overview.average_directional_accuracy !== null && overview.average_directional_accuracy !== undefined
          ? `${overview.average_directional_accuracy.toFixed(1)}%`
          : 'N/A',
      subtext: 'Out-of-sample chronological holdout',
      icon: Target,
      color: 'text-emerald-300',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      id: 'last_training',
      label: 'Last Training',
      value: formatTimeAgo(overview?.last_training_timestamp),
      subtext: overview?.last_training_timestamp
        ? new Date(overview.last_training_timestamp).toLocaleDateString()
        : 'N/A',
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`rounded-2xl bg-slate-900/80 border ${card.borderColor} p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] sm:text-xs font-medium text-slate-400 leading-tight">
                {card.label}
              </span>
              <div className={`w-8 h-8 rounded-xl ${card.bgColor} ${card.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-7 w-20 bg-slate-800 animate-pulse rounded" />
              ) : (
                <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                  {card.value}
                </div>
              )}
              <p className="text-[10px] text-slate-500 truncate" title={card.subtext}>
                {card.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MLOverviewKPICards;
