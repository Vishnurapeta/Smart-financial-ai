import { Repeat, ShieldCheck } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext.tsx';

interface RecurringCommitmentsSectionProps {
  recurringTotalMonthly: number;
  fixedForecastExpense?: number;
  variableForecastExpense?: number;
  currencySymbol?: string;
}

export const RecurringCommitmentsSection: React.FC<RecurringCommitmentsSectionProps> = ({
  recurringTotalMonthly,
  fixedForecastExpense = 0,
  variableForecastExpense = 0,
  currencySymbol: propCurrencySymbol,
}) => {
  const { symbol: userSymbol } = useCurrency();
  const currencySymbol = propCurrencySymbol || userSymbol;
  const totalForecast = fixedForecastExpense + variableForecastExpense;
  const fixedPercent = totalForecast > 0 ? Math.round((fixedForecastExpense / totalForecast) * 100) : 0;
  const variablePercent = totalForecast > 0 ? 100 - fixedPercent : 0;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Repeat className="w-4 h-4 text-cyan-400" />
            Recurring Financial Commitments &amp; Fixed vs. Variable Split
          </h3>
          <p className="text-xs text-slate-400">
            Known monthly recurring obligations (rent, subscriptions, EMIs) serve as the non-negotiable expense baseline.
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400">Monthly Committed Floor:</span>
          <div className="text-base font-extrabold text-cyan-400 font-mono">
            {currencySymbol}
            {recurringTotalMonthly.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-xs text-slate-400 block mb-1">Fixed Obligations</span>
          <span className="text-xl font-bold font-mono text-cyan-300">
            {currencySymbol}{fixedForecastExpense.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">{fixedPercent}% of monthly outflow</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-xs text-slate-400 block mb-1">Discretionary Variable Outflow</span>
          <span className="text-xl font-bold font-mono text-rose-300">
            {currencySymbol}{variableForecastExpense.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">{variablePercent}% of monthly outflow</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-xs text-slate-400 block mb-1">Total Projected Outflow</span>
          <span className="text-xl font-bold font-mono text-white">
            {currencySymbol}{totalForecast.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-emerald-400 block mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Modeled by Champion Algorithm</span>
          </span>
        </div>
      </div>

      {/* Ratio Bar */}
      <div className="space-y-1.5 pt-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Fixed Committed ({fixedPercent}%)</span>
          <span>Variable Discretionary ({variablePercent}%)</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
          <div className="bg-cyan-400 h-full transition-all duration-500" style={{ width: `${fixedPercent}%` }} />
          <div className="bg-rose-400 h-full transition-all duration-500" style={{ width: `${variablePercent}%` }} />
        </div>
      </div>
    </div>
  );
};
