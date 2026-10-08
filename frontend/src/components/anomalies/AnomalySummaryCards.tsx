import React from 'react';
import { AnomalySummary } from '../../types/anomaly.ts';

interface AnomalySummaryCardsProps {
  summary: AnomalySummary | null;
  activeStatusFilter?: string;
  onSelectStatusFilter: (status?: string) => void;
}

export const AnomalySummaryCards: React.FC<AnomalySummaryCardsProps> = ({
  summary,
  activeStatusFilter,
  onSelectStatusFilter,
}) => {
  const cards = [
    {
      id: 'NEW',
      title: 'New for Review',
      count: summary?.new ?? 0,
      description: 'Unusual patterns pending your feedback',
      icon: (
        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20',
    },
    {
      id: 'CONFIRMED_UNUSUAL',
      title: 'Confirmed Unusual',
      count: summary?.confirmedUnusual ?? 0,
      description: 'Transactions you verified as unusual',
      icon: (
        <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
      activeBorder: 'border-purple-500 ring-2 ring-purple-500/20',
    },
    {
      id: 'REVIEWED',
      title: 'Expected Spending',
      count: summary?.reviewed ?? 0,
      description: 'Reviewed and confirmed as normal',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      activeBorder: 'border-blue-500 ring-2 ring-blue-500/20',
    },
    {
      id: 'DISMISSED',
      title: 'Dismissed',
      count: summary?.dismissed ?? 0,
      description: 'Flagged anomalies dismissed',
      icon: (
        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      badgeBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
      activeBorder: 'border-slate-500 ring-2 ring-slate-500/20',
    },
    {
      id: 'ALL',
      title: 'Total Flagged',
      count: summary?.total ?? 0,
      description: `High: ${summary?.severityCounts.high ?? 0} | Med: ${summary?.severityCounts.medium ?? 0}`,
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const isSelected =
          (card.id === 'ALL' && !activeStatusFilter) ||
          activeStatusFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectStatusFilter(card.id === 'ALL' ? undefined : card.id)}
            className={`p-4 rounded-xl text-left transition-all duration-200 bg-white dark:bg-slate-900 border ${
              isSelected
                ? `${card.activeBorder} shadow-md`
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-2 rounded-lg ${card.badgeBg}`}>
                {card.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {card.count}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {card.description}
            </div>
          </button>
        );
      })}
    </div>
  );
};
