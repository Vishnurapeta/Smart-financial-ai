import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface BudgetMonthSelectorProps {
  currentMonth: string; // YYYY-MM
  onChange: (newMonth: string) => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const BudgetMonthSelector: React.FC<BudgetMonthSelectorProps> = ({
  currentMonth,
  onChange,
}) => {
  const parts = currentMonth.split('-');
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;

  const handlePrev = () => {
    const d = new Date(Date.UTC(year, monthIdx - 1, 1));
    const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    onChange(nextKey);
  };

  const handleNext = () => {
    const d = new Date(Date.UTC(year, monthIdx + 1, 1));
    const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    onChange(nextKey);
  };

  const handleResetCurrent = () => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    onChange(currentKey);
  };

  const now = new Date();
  const actualCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isViewingCurrent = currentMonth === actualCurrentMonth;

  return (
    <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl shadow-sm">
      <button
        onClick={handlePrev}
        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        title="Previous Month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 px-3">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-white min-w-[130px] text-center">
          {MONTH_NAMES[monthIdx]} {year}
        </span>
      </div>

      <button
        onClick={handleNext}
        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        title="Next Month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {!isViewingCurrent && (
        <button
          onClick={handleResetCurrent}
          className="ml-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition cursor-pointer"
        >
          Today
        </button>
      )}
    </div>
  );
};
