import React, { useState } from 'react';
import {
  FinancialAnomaly,
  AnomalyFeedbackType,
  AnomalyStatus,
} from '../../types/anomaly.ts';
import { AnomalyBadge } from './AnomalyBadge.tsx';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface AnomalyDetailDrawerProps {
  anomaly: FinancialAnomaly | null;
  onClose: () => void;
  onSubmitFeedback: (
    id: string,
    feedback: AnomalyFeedbackType,
    notes?: string,
  ) => Promise<any>;
  onUpdateStatus: (id: string, status: AnomalyStatus) => Promise<any>;
  feedbackSuccessMessage: string | null;
}

export const AnomalyDetailDrawer: React.FC<AnomalyDetailDrawerProps> = ({
  anomaly,
  onClose,
  onSubmitFeedback,
  onUpdateStatus,
  feedbackSuccessMessage,
}) => {
  const { currency: userCurrency, format } = useCurrency();
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!anomaly) return null;

  const handleFeedback = async (feedback: AnomalyFeedbackType) => {
    setIsSubmitting(true);
    try {
      await onSubmitFeedback(anomaly._id, feedback, notes || undefined);
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setIsSubmitting(true);
    try {
      await onUpdateStatus(anomaly._id, 'RESOLVED');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(anomaly.transactionDetails.date).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  );

  const getScoreWidth = (score: number) => {
    return `${Math.min(100, Math.max(10, Math.round(score * 100)))}%`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.85) return 'bg-rose-500';
    if (score >= 0.70) return 'bg-amber-500';
    return 'bg-sky-500';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full min-h-screen shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto p-6">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Unusual Pattern Review
                </span>
                <AnomalyBadge severity={anomaly.severity} status={anomaly.status} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {anomaly.transactionDetails.merchant}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Feedback Success Notification */}
          {feedbackSuccessMessage && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{feedbackSuccessMessage}</span>
            </div>
          )}

          {/* Transaction Snapshot Card */}
          <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                  Amount
                </span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {format(anomaly.transactionDetails.amount, {
                    currency: anomaly.transactionDetails.currency || userCurrency,
                  })}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                  Category
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {anomaly.transactionDetails.category}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                  Transaction Date
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {formattedDate}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                  Detection Method
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {anomaly.detectorType}
                </span>
              </div>
            </div>

            {/* Score Visual Bar */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  Unusualness Score
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {anomaly.anomalyScore.toFixed(2)} / 1.00 (
                  {Math.round(anomaly.anomalyScore * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${getScoreColor(anomaly.anomalyScore)}`}
                  style={{ width: getScoreWidth(anomaly.anomalyScore) }}
                />
              </div>
            </div>
          </div>

          {/* Explanation Section */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why was this flagged?
            </h3>
            <div className="p-3.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {anomaly.reason}
            </div>
          </div>

          {/* Contributing Signals */}
          {anomaly.contributingFeatures && anomaly.contributingFeatures.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Contributing Behavioral Signals
              </h3>
              <div className="space-y-2.5">
                {anomaly.contributingFeatures.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {feat.feature.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          feat.impact === 'high'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {feat.impact} impact
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      {feat.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Feedback Record if any */}
          {anomaly.userFeedback && (
            <div className="mt-6 p-3.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Your Recorded Feedback:
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Marked as{' '}
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {anomaly.userFeedback.feedbackType}
                </span>{' '}
                on {new Date(anomaly.userFeedback.timestamp).toLocaleDateString()}.
                {anomaly.userFeedback.notes && ` ("${anomaly.userFeedback.notes}")`}
              </p>
            </div>
          )}
        </div>

        {/* User Feedback Action Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Optional Notes or Context
          </label>
          <input
            type="text"
            placeholder="e.g., Annual renewal, family vacation dinner..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFeedback('EXPECTED')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
            >
              This was expected
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFeedback('UNUSUAL')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
            >
              This was unusual
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFeedback('DISMISSED')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
          {anomaly.status !== 'RESOLVED' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleResolve}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Mark as Resolved
            </button>
          )}
          <p className="mt-2 text-[11px] text-slate-400 text-center">
            Your feedback helps calibrate your personal baseline. Anomalies indicate statistical patterns and do not establish fraud.
          </p>
        </div>
      </div>
    </div>
  );
};
