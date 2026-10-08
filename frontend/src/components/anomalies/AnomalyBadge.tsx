import React from 'react';
import { AnomalySeverity, AnomalyStatus } from '../../types/anomaly.ts';

interface AnomalyBadgeProps {
  severity?: AnomalySeverity;
  status?: AnomalyStatus;
  score?: number;
  compact?: boolean;
  onClick?: () => void;
}

export const AnomalyBadge: React.FC<AnomalyBadgeProps> = ({
  severity,
  status,
  score,
  compact = false,
  onClick,
}) => {
  const getSeverityStyle = () => {
    switch (severity) {
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'LOW':
      default:
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'NEW':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'CONFIRMED_UNUSUAL':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case 'REVIEWED':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'DISMISSED':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const formatStatus = (s: string) => {
    switch (s) {
      case 'NEW':
        return 'Needs Review';
      case 'CONFIRMED_UNUSUAL':
        return 'Confirmed Unusual';
      case 'REVIEWED':
        return 'Expected';
      case 'DISMISSED':
        return 'Dismissed';
      default:
        return s;
    }
  };

  if (compact && severity) {
    return (
      <span
        onClick={onClick}
        title={`Unusual Spending (${severity} Unusualness)`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${getSeverityStyle()} ${
          onClick ? 'cursor-pointer hover:opacity-80' : ''
        }`}
      >
        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span>Unusual Pattern</span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {severity && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${getSeverityStyle()}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {severity.charAt(0) + severity.slice(1).toLowerCase()} Unusualness
          {score !== undefined && ` (${Math.round(score * 100)}%)`}
        </span>
      )}
      {status && (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${getStatusBadge()}`}
        >
          {formatStatus(status)}
        </span>
      )}
    </div>
  );
};
