import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '../components/Header.tsx';
import {
  TrendingUp,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Layers,
  ShieldCheck,
  CreditCard,
  Building2,
  PiggyBank,
  Wallet,
  Car,
  Coins,
  Camera,
  X,
  History,
  Loader2,
} from 'lucide-react';
import { WealthService } from '../services/wealth.service.ts';
import {
  NetWorthOverview,
  NetWorthHistory,
  NetWorthSnapshot,
  Asset,
  AssetType,
  CreateAssetDTO,
  UpdateAssetDTO,
  Liability,
  LiabilityType,
  CreateLiabilityDTO,
  UpdateLiabilityDTO,
  CreateSnapshotDTO,
} from '../types/wealth.ts';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useCurrency } from '../context/CurrencyContext.tsx';

interface NetWorthTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number;
  }>;
  label?: string;
}

const NetWorthChartTooltip: React.FC<NetWorthTooltipProps> = ({ active, payload, label }) => {
  const { format } = useCurrency();

  if (active && payload && payload.length) {
    const nwVal = payload.find((p) => p.dataKey === 'NetWorth')?.value || 0;
    const astVal = payload.find((p) => p.dataKey === 'Assets')?.value || 0;
    const libVal = payload.find((p) => p.dataKey === 'Liabilities')?.value || 0;
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 min-w-[180px]">
        <div className="font-semibold text-white border-b border-slate-800 pb-1">{label}</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-emerald-400 font-bold">
            <span>Net Worth:</span>
            <span className="font-mono">{format(nwVal)}</span>
          </div>
          <div className="flex justify-between items-center text-cyan-400">
            <span>Assets:</span>
            <span className="font-mono">{format(astVal)}</span>
          </div>
          <div className="flex justify-between items-center text-rose-400">
            <span>Liabilities:</span>
            <span className="font-mono">{format(libVal)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const NetWorthPage: React.FC = () => {
  const { format, symbol } = useCurrency();
  const [netWorth, setNetWorth] = useState<NetWorthOverview | null>(null);
  const [history, setHistory] = useState<NetWorthHistory | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab for details
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ASSETS' | 'LIABILITIES' | 'HISTORY'>(
    'OVERVIEW',
  );

  // Modals
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);

  // Form states for Snapshot
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');

  // Form states for Asset
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(AssetType.BANK_ACCOUNT);
  const [assetValue, setAssetValue] = useState('');
  const [assetInstitution, setAssetInstitution] = useState('');
  const [assetAccountMask, setAssetAccountMask] = useState('');
  const [assetIsLiquid, setAssetIsLiquid] = useState(true);
  const [assetNotes, setAssetNotes] = useState('');

  // Form states for Liability
  const [liabilityName, setLiabilityName] = useState('');
  const [liabilityType, setLiabilityType] = useState<LiabilityType>(LiabilityType.CREDIT_CARD);
  const [liabilityBalance, setLiabilityBalance] = useState('');
  const [liabilityPrincipal, setLiabilityPrincipal] = useState('');
  const [liabilityLender, setLiabilityLender] = useState('');
  const [liabilityInterestRate, setLiabilityInterestRate] = useState('0');
  const [liabilityMinPayment, setLiabilityMinPayment] = useState('0');
  const [liabilityNotes, setLiabilityNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [nw, hist, asts, liabs] = await Promise.all([
        WealthService.getNetWorth(),
        WealthService.getNetWorthHistory(),
        WealthService.getAssets(),
        WealthService.getLiabilities(),
      ]);

      setNetWorth(nw);
      setHistory(hist);
      setAssets(asts);
      setLiabilities(liabs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wealth intelligence data');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SNAPSHOT HANDLERS
  // ==========================================

  const handleOpenSnapshot = () => {
    setSnapshotNotes('');
    setSnapshotDate(new Date().toISOString().split('T')[0]);
    setIsSnapshotModalOpen(true);
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload: CreateSnapshotDTO = {
        date: snapshotDate ? new Date(snapshotDate).toISOString() : undefined,
        notes: snapshotNotes.trim() || undefined,
        source: 'MANUAL',
      };
      await WealthService.createSnapshot(payload);
      setIsSnapshotModalOpen(false);
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to record snapshot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSnapshot = async (snapshot: NetWorthSnapshot) => {
    if (!confirm('Are you sure you want to delete this historical snapshot?')) return;
    try {
      const snapId = snapshot.id || snapshot._id;
      await WealthService.deleteSnapshot(snapId);
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete snapshot');
    }
  };

  // ==========================================
  // ASSET HANDLERS
  // ==========================================

  const handleOpenAddAsset = () => {
    setEditingAsset(null);
    setAssetName('');
    setAssetType(AssetType.BANK_ACCOUNT);
    setAssetValue('');
    setAssetInstitution('');
    setAssetAccountMask('');
    setAssetIsLiquid(true);
    setAssetNotes('');
    setIsAssetModalOpen(true);
  };

  const handleOpenEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetName(asset.name);
    setAssetType(asset.type);
    setAssetValue(asset.currentValue.toString());
    setAssetInstitution(asset.institutionName || '');
    setAssetAccountMask(asset.accountNumberMasked || '');
    setAssetIsLiquid(asset.isLiquid);
    setAssetNotes(asset.notes || '');
    setIsAssetModalOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim() || !assetValue) return;

    try {
      setSubmitting(true);
      const val = parseFloat(assetValue);

      if (editingAsset) {
        const assetId = editingAsset.id || editingAsset._id;
        const payload: UpdateAssetDTO = {
          name: assetName.trim(),
          type: assetType,
          currentValue: val,
          institutionName: assetInstitution.trim() || undefined,
          accountNumberMasked: assetAccountMask.trim() || undefined,
          isLiquid: assetIsLiquid,
          notes: assetNotes.trim() || undefined,
        };
        await WealthService.updateAsset(assetId, payload);
      } else {
        const payload: CreateAssetDTO = {
          name: assetName.trim(),
          type: assetType,
          currentValue: val,
          institutionName: assetInstitution.trim() || undefined,
          accountNumberMasked: assetAccountMask.trim() || undefined,
          isLiquid: assetIsLiquid,
          notes: assetNotes.trim() || undefined,
        };
        await WealthService.createAsset(payload);
      }

      setIsAssetModalOpen(false);
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!confirm(`Are you sure you want to delete asset "${asset.name}"?`)) return;
    try {
      const assetId = asset.id || asset._id;
      await WealthService.deleteAsset(assetId);
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  };

  // ==========================================
  // LIABILITY HANDLERS
  // ==========================================

  const handleOpenAddLiability = () => {
    setEditingLiability(null);
    setLiabilityName('');
    setLiabilityType(LiabilityType.CREDIT_CARD);
    setLiabilityBalance('');
    setLiabilityPrincipal('');
    setLiabilityLender('');
    setLiabilityInterestRate('0');
    setLiabilityMinPayment('0');
    setLiabilityNotes('');
    setIsLiabilityModalOpen(true);
  };

  const handleOpenEditLiability = (liability: Liability) => {
    setEditingLiability(liability);
    setLiabilityName(liability.name);
    setLiabilityType(liability.type);
    setLiabilityBalance(liability.currentBalance.toString());
    setLiabilityPrincipal((liability.principalAmount || liability.currentBalance).toString());
    setLiabilityLender(liability.lender || '');
    setLiabilityInterestRate((liability.interestRateApr || 0).toString());
    setLiabilityMinPayment((liability.minimumPaymentMonthly || 0).toString());
    setLiabilityNotes(liability.notes || '');
    setIsLiabilityModalOpen(true);
  };

  const handleSaveLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liabilityName.trim() || !liabilityBalance) return;

    try {
      setSubmitting(true);
      const bal = parseFloat(liabilityBalance);
      const princ = parseFloat(liabilityPrincipal) || bal;
      const apr = parseFloat(liabilityInterestRate) || 0;
      const minPay = parseFloat(liabilityMinPayment) || 0;

      if (editingLiability) {
        const liabilityId = editingLiability.id || editingLiability._id;
        const payload: UpdateLiabilityDTO = {
          name: liabilityName.trim(),
          type: liabilityType,
          currentBalance: bal,
          principalAmount: princ,
          interestRateApr: apr,
          minimumPaymentMonthly: minPay,
          lender: liabilityLender.trim() || undefined,
          notes: liabilityNotes.trim() || undefined,
        };
        await WealthService.updateLiability(liabilityId, payload);
      } else {
        const payload: CreateLiabilityDTO = {
          name: liabilityName.trim(),
          type: liabilityType,
          currentBalance: bal,
          principalAmount: princ,
          interestRateApr: apr,
          minimumPaymentMonthly: minPay,
          lender: liabilityLender.trim() || undefined,
          notes: liabilityNotes.trim() || undefined,
        };
        await WealthService.createLiability(payload);
      }

      setIsLiabilityModalOpen(false);
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save liability');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLiability = async (liability: Liability) => {
    if (!confirm(`Are you sure you want to delete liability "${liability.name}"?`)) return;
    try {
      const liabilityId = liability.id || liability._id;
      await WealthService.deleteLiability(liabilityId);
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete liability');
    }
  };

  // Chart data: Net worth snapshots time series
  const chartData = useMemo(() => {
    if (!history?.snapshots || history.snapshots.length === 0) return [];
    return history.snapshots.map((s) => ({
      date: new Date(s.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      }),
      NetWorth: s.netWorth,
      Assets: s.totalAssets,
      Liabilities: s.totalLiabilities,
    }));
  }, [history]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Net Worth & Balance Sheet
                </h1>
                <p className="text-xs text-slate-400">
                  Formula: Assets - Liabilities • Track wealth progression and historical snapshots
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSnapshot}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              Record Snapshot
            </button>

            <button
              onClick={handleOpenAddAsset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Asset
            </button>

            <button
              onClick={handleOpenAddLiability}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs hover:bg-rose-500/30 border border-rose-500/30 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Debt
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 bg-slate-900/40 rounded-3xl border border-slate-800">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs">Calculating real-time balance sheet metrics...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
            {error}
          </div>
        ) : (
          <>
            {/* Main KPI Hero Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Net Worth */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/30 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Total Net Worth
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div
                  className={`text-3xl font-black font-mono tracking-tight ${
                    (netWorth?.netWorth || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {format(netWorth?.netWorth || 0)}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Formula: Assets - Liabilities</span>
                  <span className="font-semibold text-emerald-400 font-mono">
                    +{(history?.percentageChange || 0).toFixed(1)}% growth
                  </span>
                </div>
              </div>

              {/* Total Assets */}
              <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Total Assets
                  </span>
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {format(netWorth?.totalAssets || 0)}
                </div>
                <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                  <span>Liquid Capital:</span>
                  <span className="text-cyan-300 font-semibold font-mono">
                    {format(netWorth?.assetBreakdown.liquidAssets || 0)}
                  </span>
                </div>
              </div>

              {/* Total Liabilities */}
              <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                    Total Liabilities
                  </span>
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-400 font-mono">
                  {format(netWorth?.totalLiabilities || 0)}
                </div>
                <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                  <span>Min Monthly Payment:</span>
                  <span className="text-rose-300 font-semibold font-mono">
                    {format(netWorth?.liabilityBreakdown.totalMonthlyMinimumPayment || 0)}/mo
                  </span>
                </div>
              </div>

              {/* Financial Health Ratios */}
              <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Debt-to-Asset Ratio
                  </span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {(netWorth?.debtToAssetRatio || 0).toFixed(1)}%
                </div>
                <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                  <span>Liquidity Ratio:</span>
                  <span className="text-emerald-400 font-semibold font-mono">
                    {(netWorth?.liquidityRatio || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Historical Net-Worth Chart */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white tracking-tight">
                    Historical Net-Worth Trend & Progression
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {history?.snapshots.length || 0} recorded snapshots
                </span>
              </div>

              {chartData.length > 0 ? (
                <div className="h-72 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorLiabilities" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(val) => `${symbol}${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<NetWorthChartTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: '10px' }}
                        formatter={(val: string) => (
                          <span className="text-xs text-slate-300 font-medium">{val}</span>
                        )}
                      />
                      <Area
                        type="monotone"
                        dataKey="NetWorth"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorNetWorth)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Assets"
                        stroke="#06b6d4"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#colorAssets)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Liabilities"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#colorLiabilities)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                  No snapshots recorded yet. Click "Record Snapshot" above to establish baseline
                  tracking.
                </div>
              )}
            </div>

            {/* Tabs Switcher for Detailed Views */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setActiveTab('OVERVIEW')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Buckets & Balance Sheet
              </button>
              <button
                onClick={() => setActiveTab('ASSETS')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'ASSETS'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Assets List ({assets.length})
              </button>
              <button
                onClick={() => setActiveTab('LIABILITIES')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'LIABILITIES'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Liabilities List ({liabilities.length})
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Snapshots Ledger ({history?.snapshots.length || 0})
              </button>
            </div>

            {/* ========================================================= */}
            {/* VIEW 1: BUCKETS & BALANCE SHEET (4 ASSET + 3 LIABILITY BUCKETS) */}
            {/* ========================================================= */}
            {activeTab === 'OVERVIEW' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ASSETS BUCKET */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="w-5 h-5 text-emerald-400" />
                      <h2 className="text-base font-bold text-white">Asset Breakdown</h2>
                    </div>
                    <button
                      onClick={handleOpenAddAsset}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Asset
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* 1. Cash */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <span>Cash</span>
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {format(netWorth?.assetBreakdown.cash || 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Physical & petty cash</div>
                    </div>

                    {/* 2. Bank Balance */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Building2 className="w-4 h-4 text-cyan-400" />
                        <span>Bank Balance</span>
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {format(netWorth?.assetBreakdown.bankBalance || 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Checking & savings accounts</div>
                    </div>

                    {/* 3. Investments */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Coins className="w-4 h-4 text-teal-400" />
                        <span>Investments</span>
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {format(netWorth?.assetBreakdown.investments || 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Stocks, mutual funds, crypto</div>
                    </div>

                    {/* 4. Other Assets */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Car className="w-4 h-4 text-purple-400" />
                        <span>Other Assets</span>
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {format(netWorth?.assetBreakdown.otherAssets || 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Real estate, vehicles, gold</div>
                    </div>
                  </div>
                </div>

                {/* LIABILITIES BUCKET */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-rose-400" />
                      <h2 className="text-base font-bold text-white">Liabilities Breakdown</h2>
                    </div>
                    <button
                      onClick={handleOpenAddLiability}
                      className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Liability
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. Loans */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        <span>Loans</span>
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {format(netWorth?.liabilityBreakdown.loans || 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Mortgage, student, personal</div>
                    </div>

                    {/* 2. Credit Card Debt */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <CreditCard className="w-4 h-4 text-rose-400" />
                        <span>Credit Card Debt</span>
                      </div>
                      <div className="text-lg font-black text-rose-400 font-mono">
                        {format(netWorth?.liabilityBreakdown.creditCardDebt || 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Revolving credit balances</div>
                    </div>

                    {/* 3. Other Liabilities */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>Other Liabilities</span>
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {format(netWorth?.liabilityBreakdown.otherLiabilities || 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">Informal loans, borrowings</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: ASSETS TABLE */}
            {/* ========================================================= */}
            {activeTab === 'ASSETS' && (
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Assets Register</h3>
                  <button
                    onClick={handleOpenAddAsset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Asset
                  </button>
                </div>

                {assets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No assets recorded yet. Add cash, bank accounts, or investments.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-3 font-semibold">Asset Name</th>
                          <th className="pb-3 font-semibold">Type</th>
                          <th className="pb-3 font-semibold">Institution / Account</th>
                          <th className="pb-3 font-semibold">Liquidity</th>
                          <th className="pb-3 font-semibold text-right">Current Value</th>
                          <th className="pb-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {assets.map((asset) => (
                          <tr key={asset._id || asset.id} className="hover:bg-slate-800/30">
                            <td className="py-3 font-medium text-white">{asset.name}</td>
                            <td className="py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                                {asset.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400">
                              {asset.institutionName || '—'}{' '}
                              {asset.accountNumberMasked ? `(${asset.accountNumberMasked})` : ''}
                            </td>
                            <td className="py-3">
                              {asset.isLiquid ? (
                                <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                                  Liquid
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                                  Fixed
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-400">
                              {format(asset.currentValue)}
                            </td>
                            <td className="py-3 text-right space-x-1">
                              <button
                                onClick={() => handleOpenEditAsset(asset)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAsset(asset)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 3: LIABILITIES TABLE */}
            {/* ========================================================= */}
            {activeTab === 'LIABILITIES' && (
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Liabilities Register</h3>
                  <button
                    onClick={handleOpenAddLiability}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Debt
                  </button>
                </div>

                {liabilities.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No debts recorded. You have a zero debt balance!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-3 font-semibold">Debt / Obligation</th>
                          <th className="pb-3 font-semibold">Type</th>
                          <th className="pb-3 font-semibold">Lender</th>
                          <th className="pb-3 font-semibold">APR %</th>
                          <th className="pb-3 font-semibold">Min Monthly</th>
                          <th className="pb-3 font-semibold text-right">Current Balance</th>
                          <th className="pb-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {liabilities.map((liability) => (
                          <tr key={liability._id || liability.id} className="hover:bg-slate-800/30">
                            <td className="py-3 font-medium text-white">{liability.name}</td>
                            <td className="py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                {liability.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400">{liability.lender || '—'}</td>
                            <td className="py-3 font-mono text-slate-300">
                              {liability.interestRateApr ? `${liability.interestRateApr}%` : '0%'}
                            </td>
                            <td className="py-3 font-mono text-slate-300">
                              {format(liability.minimumPaymentMonthly || 0)}/mo
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-rose-400">
                              {format(liability.currentBalance)}
                            </td>
                            <td className="py-3 text-right space-x-1">
                              <button
                                onClick={() => handleOpenEditLiability(liability)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLiability(liability)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 4: SNAPSHOTS LEDGER */}
            {/* ========================================================= */}
            {activeTab === 'HISTORY' && (
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Historical Net-Worth Snapshots</h3>
                  <button
                    onClick={handleOpenSnapshot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Capture Now
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Snapshot Date</th>
                        <th className="pb-3 font-semibold">Source</th>
                        <th className="pb-3 font-semibold">Total Assets</th>
                        <th className="pb-3 font-semibold">Total Liabilities</th>
                        <th className="pb-3 font-semibold">Net Worth</th>
                        <th className="pb-3 font-semibold">Notes</th>
                        <th className="pb-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {history?.snapshots.map((snap) => (
                        <tr key={snap._id || snap.id} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-medium text-white">
                            {new Date(snap.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {snap.source}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-cyan-400">
                            {format(snap.totalAssets)}
                          </td>
                          <td className="py-3 font-mono text-rose-400">
                            {format(snap.totalLiabilities)}
                          </td>
                          <td className="py-3 font-mono font-bold text-emerald-400">
                            {format(snap.netWorth)}
                          </td>
                          <td className="py-3 text-slate-400">{snap.notes || '—'}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleDeleteSnapshot(snap)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                              title="Delete snapshot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================================= */}
        {/* RECORD SNAPSHOT MODAL */}
        {/* ========================================================= */}
        {isSnapshotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Record Net Worth Snapshot</h3>
                </div>
                <button
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Captures current assets ({format(netWorth?.totalAssets || 0)}) and liabilities (
                {format(netWorth?.totalLiabilities || 0)}) to freeze a milestone snapshot.
              </p>

              <form onSubmit={handleCreateSnapshot} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Snapshot Date
                  </label>
                  <input
                    type="date"
                    required
                    value={snapshotDate}
                    onChange={(e) => setSnapshotDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Milestone Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. End of Month check-in"
                    value={snapshotNotes}
                    onChange={(e) => setSnapshotNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSnapshotModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {submitting ? 'Recording...' : 'Freeze Snapshot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ASSET MODAL (ADD / EDIT) */}
        {/* ========================================================= */}
        {isAssetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    {editingAsset ? 'Edit Asset' : 'Add New Asset'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAssetModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAsset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Asset Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Salary Account, Tesla Shares"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Asset Bucket *
                    </label>
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value as AssetType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={AssetType.CASH}>Cash (Physical / Locker)</option>
                      <option value={AssetType.BANK_ACCOUNT}>
                        Bank Account (Savings / Checking)
                      </option>
                      <option value={AssetType.INVESTMENT}>
                        Investment (Stocks / Mutual Funds)
                      </option>
                      <option value={AssetType.CRYPTO}>Crypto</option>
                      <option value={AssetType.PRECIOUS_METALS}>
                        Precious Metals (Gold / Silver)
                      </option>
                      <option value={AssetType.REAL_ESTATE}>Real Estate</option>
                      <option value={AssetType.VEHICLE}>Vehicle</option>
                      <option value={AssetType.OTHER}>Other Asset</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Current Value ({symbol}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="50000"
                      value={assetValue}
                      onChange={(e) => setAssetValue(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Institution / Broker
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. JPMorgan, Zerodha"
                      value={assetInstitution}
                      onChange={(e) => setAssetInstitution(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Account Mask (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="XXXX-1234"
                      value={assetAccountMask}
                      onChange={(e) => setAssetAccountMask(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isLiquid"
                    checked={assetIsLiquid}
                    onChange={(e) => setAssetIsLiquid(e.target.checked)}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="isLiquid" className="text-xs text-slate-300">
                    Liquid Asset (Can be converted to cash within days)
                  </label>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssetModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingAsset ? 'Save Changes' : 'Add Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* LIABILITY MODAL (ADD / EDIT) */}
        {/* ========================================================= */}
        {isLiabilityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-rose-400" />
                  <h3 className="text-base font-bold text-white">
                    {editingLiability ? 'Edit Debt / Liability' : 'Add Debt / Liability'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsLiabilityModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveLiability} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Liability Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chase Sapphire Card, Student Loan"
                    value={liabilityName}
                    onChange={(e) => setLiabilityName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Liability Type *
                    </label>
                    <select
                      value={liabilityType}
                      onChange={(e) => setLiabilityType(e.target.value as LiabilityType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={LiabilityType.CREDIT_CARD}>Credit Card Debt</option>
                      <option value={LiabilityType.PERSONAL_LOAN}>Personal Loan</option>
                      <option value={LiabilityType.STUDENT_LOAN}>Student Loan</option>
                      <option value={LiabilityType.AUTO_LOAN}>Auto Loan</option>
                      <option value={LiabilityType.MORTGAGE}>Home Mortgage</option>
                      <option value={LiabilityType.OTHER}>Other Liability</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Current Balance ({symbol}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="2500"
                      value={liabilityBalance}
                      onChange={(e) => setLiabilityBalance(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      APR Interest %
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="18.5"
                      value={liabilityInterestRate}
                      onChange={(e) => setLiabilityInterestRate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Min Monthly ({symbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="150"
                      value={liabilityMinPayment}
                      onChange={(e) => setLiabilityMinPayment(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Lender</label>
                    <input
                      type="text"
                      placeholder="Bank/Issuer"
                      value={liabilityLender}
                      onChange={(e) => setLiabilityLender(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLiabilityModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-400 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingLiability ? 'Save Changes' : 'Add Liability'}
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
