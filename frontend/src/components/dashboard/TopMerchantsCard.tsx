import React from 'react';
import { TopMerchantItem } from '../../types/analytics.ts';
import { Store } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface TopMerchantsCardProps {
  merchants: TopMerchantItem[];
}

export const TopMerchantsCard: React.FC<TopMerchantsCardProps> = ({ merchants }) => {
  const { format: formatCurrency } = useCurrency();

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Store className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Top Payees & Merchants
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">By Outflow</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">Vendors receiving highest cumulative payments</p>

        {merchants.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
            No merchant spending recorded yet
          </div>
        ) : (
          <div className="space-y-3.5">
            {merchants.map((item, idx) => (
              <div key={item.merchant || idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700/60 text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-white truncate max-w-[130px] sm:max-w-[160px]">
                      {item.merchant}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({item.count} {item.count === 1 ? 'txn' : 'txns'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-200">{formatCurrency(item.amount)}</span>
                    <span className="text-[11px] text-blue-400 w-10 text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
