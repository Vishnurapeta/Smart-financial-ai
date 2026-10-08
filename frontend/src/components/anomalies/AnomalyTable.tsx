import React from 'react';
import { FinancialAnomaly } from '../../types/anomaly.ts';
import { AnomalyBadge } from './AnomalyBadge.tsx';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface AnomalyTableProps {
  anomalies: FinancialAnomaly[];
  loading: boolean;
  onSelectAnomaly: (anomaly: FinancialAnomaly) => void;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  onPageChange: (newPage: number) => void;
}

export const AnomalyTable: React.FC<AnomalyTableProps> = ({
  anomalies,
  loading,
  onSelectAnomaly,
  pagination,
  onPageChange,
}) => {
  const { currency: userCurrency, format } = useCurrency();
  const formatType = (type: string) => {
    switch (type) {
      case 'AMOUNT_ANOMALY':
        return 'Amount Outlier';
      case 'CATEGORY_ANOMALY':
        return 'Category Pattern';
      case 'MERCHANT_ANOMALY':
        return 'Merchant Outlier';
      case 'FREQUENCY_ANOMALY':
        return 'Burst Frequency';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Analyzing spending patterns...
        </p>
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          No Unusual Spending Detected
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Your recent transactions adhere closely to your typical baseline patterns.
          New transactions will be analyzed automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3.5">Date</th>
              <th className="px-6 py-3.5">Merchant</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5">Amount</th>
              <th className="px-6 py-3.5">Pattern Type</th>
              <th className="px-6 py-3.5">Score</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {anomalies.map((anom) => {
              const formattedDate = new Date(
                anom.transactionDetails.date,
              ).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <tr
                  key={anom._id}
                  onClick={() => onSelectAnomaly(anom)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                    {formattedDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                    {anom.transactionDetails.merchant}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      {anom.transactionDetails.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                    {format(anom.transactionDetails.amount, {
                      currency: anom.transactionDetails.currency || userCurrency,
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatType(anom.anomalyType)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {anom.anomalyScore.toFixed(2)}
                      </span>
                      <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            anom.anomalyScore >= 0.85
                              ? 'bg-rose-500'
                              : anom.anomalyScore >= 0.70
                              ? 'bg-amber-500'
                              : 'bg-sky-500'
                          }`}
                          style={{ width: `${Math.round(anom.anomalyScore * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <AnomalyBadge severity={anom.severity} status={anom.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAnomaly(anom);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.pages > 1 && (
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} records
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="px-2">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
