import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '../components/Header.tsx';
import {
  Target,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Sparkles,
  Edit2,
  Trash2,
  Shield,
  Plane,
  Home,
  Briefcase,
  X,
  Loader2,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { WealthService } from '../services/wealth.service.ts';
import {
  FinancialGoal,
  GoalsSummary,
  GoalCategory,
  CreateGoalDTO,
  UpdateGoalDTO,
} from '../types/wealth.ts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { useCurrency } from '../context/CurrencyContext.tsx';

interface GoalTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      current: number;
      target: number;
      progress: number;
    };
  }>;
}

const GoalChartTooltip: React.FC<GoalTooltipProps> = ({ active, payload }) => {
  const { format } = useCurrency();

  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
        <div className="font-semibold text-white">{data.name}</div>
        <div className="text-emerald-400">Saved: {format(data.current)}</div>
        <div className="text-slate-400">Target: {format(data.target)}</div>
        <div className="text-indigo-300 font-bold">Progress: {data.progress.toFixed(1)}%</div>
      </div>
    );
  }
  return null;
};

export const GoalsPage: React.FC = () => {
  const { format, symbol } = useCurrency();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);

  const [activeGoal, setActiveGoal] = useState<FinancialGoal | null>(null);
  const [contributionAmount, setContributionAmount] = useState<string>('');
  const [contributionNote, setContributionNote] = useState<string>('');

  // Form states for Create / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetAmount, setFormTargetAmount] = useState('');
  const [formCurrentAmount, setFormCurrentAmount] = useState('0');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formCategory, setFormCategory] = useState<GoalCategory>(GoalCategory.EMERGENCY_FUND);
  const [formAutoContribute, setFormAutoContribute] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedGoals, fetchedSummary] = await Promise.all([
        WealthService.getGoals(),
        WealthService.getGoalsSummary(),
      ]);
      setGoals(fetchedGoals);
      setSummary(fetchedSummary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load financial goals');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormTitle('');
    setFormDescription('');
    setFormTargetAmount('');
    setFormCurrentAmount('0');
    // Default target date to 1 year ahead
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormTargetDate(nextYear.toISOString().split('T')[0]);
    setFormCategory(GoalCategory.EMERGENCY_FUND);
    setFormAutoContribute('0');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (goal: FinancialGoal) => {
    setActiveGoal(goal);
    setFormTitle(goal.title);
    setFormDescription(goal.description || '');
    setFormTargetAmount(goal.targetAmount.toString());
    setFormCurrentAmount(goal.currentAmount.toString());
    setFormTargetDate(new Date(goal.targetDate).toISOString().split('T')[0]);
    setFormCategory(goal.category);
    setFormAutoContribute((goal.autoContributeMonthly || 0).toString());
    setIsEditModalOpen(true);
  };

  const handleOpenContribute = (goal: FinancialGoal) => {
    setActiveGoal(goal);
    setContributionAmount('');
    setContributionNote('');
    setIsContributeModalOpen(true);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formTargetAmount || !formTargetDate) return;

    try {
      setSubmitting(true);
      const payload: CreateGoalDTO = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        targetAmount: parseFloat(formTargetAmount),
        currentAmount: parseFloat(formCurrentAmount) || 0,
        targetDate: new Date(formTargetDate).toISOString(),
        category: formCategory,
        autoContributeMonthly: parseFloat(formAutoContribute) || 0,
      };

      await WealthService.createGoal(payload);
      setIsCreateModalOpen(false);
      await fetchGoals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal) return;

    try {
      setSubmitting(true);
      const goalId = activeGoal.id || activeGoal._id;
      const payload: UpdateGoalDTO = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        targetAmount: parseFloat(formTargetAmount),
        currentAmount: parseFloat(formCurrentAmount) || 0,
        targetDate: new Date(formTargetDate).toISOString(),
        category: formCategory,
        autoContributeMonthly: parseFloat(formAutoContribute) || 0,
      };

      await WealthService.updateGoal(goalId, payload);
      setIsEditModalOpen(false);
      await fetchGoals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal || !contributionAmount) return;

    try {
      setSubmitting(true);
      const goalId = activeGoal.id || activeGoal._id;
      await WealthService.contributeToGoal(goalId, {
        amount: parseFloat(contributionAmount),
        notes: contributionNote.trim() || undefined,
      });

      setIsContributeModalOpen(false);
      await fetchGoals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to contribute to goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goal: FinancialGoal) => {
    if (!confirm(`Are you sure you want to delete "${goal.title}"?`)) return;

    try {
      const goalId = goal.id || goal._id;
      await WealthService.deleteGoal(goalId);
      await fetchGoals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  };

  // Filtered goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      const matchesSearch =
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory = categoryFilter === 'ALL' || g.category === categoryFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACHIEVED' && g.isAchieved) ||
        (statusFilter === 'IN_PROGRESS' && !g.isAchieved);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [goals, search, categoryFilter, statusFilter]);

  // Chart data: Top goals progress
  const chartData = useMemo(() => {
    return goals.slice(0, 6).map((g) => ({
      name: g.title.length > 15 ? `${g.title.slice(0, 15)}...` : g.title,
      current: g.currentAmount,
      target: g.targetAmount,
      progress: g.progressPercentage,
    }));
  }, [goals]);

  const getCategoryIcon = (category: GoalCategory) => {
    switch (category) {
      case GoalCategory.EMERGENCY_FUND:
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case GoalCategory.RETIREMENT:
        return <Briefcase className="w-4 h-4 text-cyan-400" />;
      case GoalCategory.HOME_PURCHASE:
        return <Home className="w-4 h-4 text-amber-400" />;
      case GoalCategory.TRAVEL:
        return <Plane className="w-4 h-4 text-indigo-400" />;
      case GoalCategory.DEBT_PAYOFF:
        return <CheckCircle2 className="w-4 h-4 text-rose-400" />;
      case GoalCategory.INVESTMENT:
        return <TrendingUp className="w-4 h-4 text-teal-400" />;
      default:
        return <Target className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Financial Goals</h1>
                <p className="text-xs text-slate-400">
                  Plan, monitor, and calculate required monthly contributions automatically
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create New Goal
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Target */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Targeted</span>
              <div className="p-2 rounded-xl bg-slate-800 text-emerald-400">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {format(summary?.totalTarget ?? 0, { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Across {goals.length} target portfolio goals
            </div>
          </div>

          {/* Total Saved */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Saved</span>
              <div className="p-2 rounded-xl bg-slate-800 text-teal-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {format(summary?.totalCurrent ?? 0, { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{(summary?.overallProgress || 0).toFixed(1)}% overall progress</span>
            </div>
          </div>

          {/* Required Monthly Contribution */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Required Monthly Commitment</span>
              <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-300 font-mono">
              {format(summary?.totalRequiredMonthly ?? 0, { maximumFractionDigits: 0 })}
              <span className="text-xs font-normal text-slate-400 ml-1">/mo</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Needed each month to meet deadlines
            </div>
          </div>

          {/* Milestones Achieved */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Goals Status</span>
              <div className="p-2 rounded-xl bg-slate-800 text-amber-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">
                {summary?.achievedCount || 0}
              </span>
              <span className="text-xs text-slate-400">achieved /</span>
              <span className="text-base font-semibold text-emerald-400 font-mono">
                {summary?.inProgressCount || 0}
              </span>
              <span className="text-xs text-slate-400">in progress</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {summary?.overdueCount ? (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {summary.overdueCount} goals overdue
                </span>
              ) : (
                <span className="text-emerald-400">All targets on schedule</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Chart (if goals exist) */}
        {goals.length > 0 && (
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <PieChartIcon className="w-4 h-4 text-emerald-400" />
                <span>Goal Capital Accumulation & Completion Progress</span>
              </div>
              <span className="text-xs text-slate-400">Current vs Target</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `${symbol}${(val / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip content={<GoalChartTooltip />} />
                  <Bar dataKey="target" fill="#1e293b" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="current" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.progress >= 100 ? '#10b981' : '#06b6d4'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search goals by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Categories</option>
              {Object.values(GoalCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace('_', ' ')}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Status</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ACHIEVED">Achieved</option>
            </select>
          </div>
        </div>

        {/* Goals Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs">Loading financial goals...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
            {error}
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/30 border border-slate-800/80 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No Financial Goals Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Create your first target like an Emergency Fund, Retirement, or Dream Vacation.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGoals.map((goal) => {
              const isAchieved = goal.isAchieved;
              const isOverdue = goal.isOverdue;

              return (
                <div
                  key={goal._id || goal.id}
                  className={`p-5 rounded-3xl border transition-all duration-300 relative flex flex-col justify-between ${
                    isAchieved
                      ? 'bg-gradient-to-br from-emerald-950/20 via-slate-900/80 to-slate-900/80 border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-500/5'
                      : isOverdue
                        ? 'bg-slate-900/80 border-rose-500/30 hover:border-rose-500/50'
                        : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-800">
                          {getCategoryIcon(goal.category)}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          {goal.category.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isAchieved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Achieved
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            {goal.monthsRemaining} mo remaining
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-base font-bold text-white tracking-tight line-clamp-1">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {goal.description}
                      </p>
                    )}

                    {/* Progress Bar & Amount */}
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-baseline text-xs">
                        <div>
                          <span className="text-slate-400 text-[11px]">Saved: </span>
                          <span className="font-bold text-white font-mono">
                            {format(goal.currentAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px]">Target: </span>
                          <span className="font-bold text-slate-300 font-mono">
                            {format(goal.targetAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isAchieved
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : isOverdue
                                ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                                : 'bg-gradient-to-r from-teal-500 to-cyan-400'
                          }`}
                          style={{ width: `${goal.progressPercentage}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{goal.progressPercentage.toFixed(1)}% complete</span>
                        <span>
                          {goal.remainingAmount > 0
                            ? `${format(goal.remainingAmount)} remaining`
                            : 'Target reached!'}
                        </span>
                      </div>
                    </div>

                    {/* Required Monthly Contribution Highlight */}
                    {!isAchieved && (
                      <div className="mt-4 p-3 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">
                            Required Monthly
                          </div>
                          <div className="text-sm font-black text-white font-mono">
                            {format(goal.requiredMonthlyContribution)}{' '}
                            <span className="text-[10px] font-normal text-slate-400">/ mo</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Target Date</div>
                          <div className="text-[11px] font-medium text-slate-300">
                            {new Date(goal.targetDate).toLocaleDateString(undefined, {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenContribute(goal)}
                      disabled={isAchieved}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Contribute
                    </button>

                    <button
                      onClick={() => handleOpenEdit(goal)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
                      title="Edit Goal"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteGoal(goal)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors cursor-pointer"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* CREATE GOAL MODAL */}
        {/* ========================================================= */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Create Financial Goal</h3>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Goal Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 6-Month Emergency Fund"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as GoalCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {Object.values(GoalCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Target Amount ({symbol}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="10000"
                      value={formTargetAmount}
                      onChange={(e) => setFormTargetAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Already Saved ({symbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formCurrentAmount}
                      onChange={(e) => setFormCurrentAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Notes about why this goal matters or bank account link..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Goal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* EDIT GOAL MODAL */}
        {/* ========================================================= */}
        {isEditModalOpen && activeGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Edit Goal</h3>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateGoal} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Goal Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as GoalCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {Object.values(GoalCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Target Amount ({symbol})
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formTargetAmount}
                      onChange={(e) => setFormTargetAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Current Saved ({symbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formCurrentAmount}
                      onChange={(e) => setFormCurrentAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* QUICK CONTRIBUTE MODAL */}
        {/* ========================================================= */}
        {isContributeModalOpen && activeGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Add Contribution</h3>
                </div>
                <button
                  onClick={() => setIsContributeModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Allocating to:</div>
                <div className="text-sm font-bold text-white">{activeGoal.title}</div>
                <div className="text-[11px] text-emerald-400">
                  {format(activeGoal.currentAmount)} of {format(activeGoal.targetAmount)} saved
                </div>
              </div>

              <form onSubmit={handleContribute} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Contribution Amount ({symbol}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly salary savings"
                    value={contributionNote}
                    onChange={(e) => setContributionNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsContributeModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {submitting ? 'Allocating...' : 'Confirm Contribution'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
