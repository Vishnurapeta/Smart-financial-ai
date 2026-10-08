export enum GoalCategory {
  EMERGENCY_FUND = 'EMERGENCY_FUND',
  RETIREMENT = 'RETIREMENT',
  HOME_PURCHASE = 'HOME_PURCHASE',
  TRAVEL = 'TRAVEL',
  DEBT_PAYOFF = 'DEBT_PAYOFF',
  INVESTMENT = 'INVESTMENT',
  OTHER = 'OTHER',
}

export enum GoalStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  ACHIEVED = 'ACHIEVED',
  ABANDONED = 'ABANDONED',
}

export interface FinancialGoal {
  _id: string;
  id?: string;
  userId: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string;
  category: GoalCategory;
  status: GoalStatus;
  autoContributeMonthly: number;
  linkedAssetId?: string;
  createdAt: string;
  updatedAt: string;
  // Dynamic backend-computed metrics
  progressPercentage: number;
  remainingAmount: number;
  monthsRemaining: number;
  requiredMonthlyContribution: number;
  isOverdue: boolean;
  isAchieved: boolean;
}

export interface GoalsSummary {
  totalTarget?: number;
  totalTargetAmount?: number;
  totalCurrent?: number;
  totalCurrentAmount?: number;
  totalRemaining?: number;
  totalRemainingAmount?: number;
  overallProgress?: number;
  overallProgressPercentage?: number;
  totalRequiredMonthly?: number;
  totalRequiredMonthlyContribution?: number;
  achievedCount?: number;
  achievedGoals?: number;
  inProgressCount?: number;
  activeGoals?: number;
  overdueCount?: number;
  overdueGoals?: number;
  totalGoals?: number;
  categoryBreakdown?: Record<string, { count: number; target: number; current: number }>;
  goals?: FinancialGoal[];
}

export interface CreateGoalDTO {
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  targetDate: string;
  category: GoalCategory;
  autoContributeMonthly?: number;
}

export interface UpdateGoalDTO {
  title?: string;
  description?: string;
  targetAmount?: number;
  currentAmount?: number;
  currency?: string;
  targetDate?: string;
  category?: GoalCategory;
  status?: GoalStatus;
  autoContributeMonthly?: number;
}

export interface ContributeGoalDTO {
  amount: number;
  notes?: string;
}

// ==========================================
// ASSETS
// ==========================================

export enum AssetType {
  CASH = 'CASH',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  INVESTMENT = 'INVESTMENT',
  REAL_ESTATE = 'REAL_ESTATE',
  CRYPTO = 'CRYPTO',
  VEHICLE = 'VEHICLE',
  PRECIOUS_METALS = 'PRECIOUS_METALS',
  OTHER = 'OTHER',
}

export interface Asset {
  _id: string;
  id?: string;
  userId: string;
  name: string;
  type: AssetType;
  institutionName?: string;
  accountNumberMasked?: string;
  currentValue: number;
  currency: string;
  appreciationRateAnnual?: number;
  isLiquid: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSummary {
  cash: number;
  bankBalance: number;
  investments: number;
  otherAssets: number;
  totalAssets: number;
  liquidAssets: number;
}

export interface CreateAssetDTO {
  name: string;
  type: AssetType;
  currentValue: number;
  currency?: string;
  institutionName?: string;
  accountNumberMasked?: string;
  appreciationRateAnnual?: number;
  isLiquid?: boolean;
  notes?: string;
}

export interface UpdateAssetDTO {
  name?: string;
  type?: AssetType;
  currentValue?: number;
  currency?: string;
  institutionName?: string;
  accountNumberMasked?: string;
  appreciationRateAnnual?: number;
  isLiquid?: boolean;
  notes?: string;
}

// ==========================================
// LIABILITIES
// ==========================================

export enum LiabilityType {
  CREDIT_CARD = 'CREDIT_CARD',
  PERSONAL_LOAN = 'PERSONAL_LOAN',
  STUDENT_LOAN = 'STUDENT_LOAN',
  AUTO_LOAN = 'AUTO_LOAN',
  MORTGAGE = 'MORTGAGE',
  OTHER = 'OTHER',
}

export interface Liability {
  _id: string;
  id?: string;
  userId: string;
  name: string;
  type: LiabilityType;
  currentBalance: number;
  principalAmount: number;
  currency: string;
  lender?: string;
  interestRateApr: number;
  minimumPaymentMonthly: number;
  dueDayOfMonth?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiabilitySummary {
  loans: number;
  creditCardDebt: number;
  otherLiabilities: number;
  totalLiabilities: number;
  totalMonthlyMinimumPayment: number;
}

export interface CreateLiabilityDTO {
  name: string;
  type: LiabilityType;
  currentBalance: number;
  principalAmount?: number;
  currency?: string;
  lender?: string;
  interestRateApr?: number;
  minimumPaymentMonthly?: number;
  dueDayOfMonth?: number;
  notes?: string;
}

export interface UpdateLiabilityDTO {
  name?: string;
  type?: LiabilityType;
  currentBalance?: number;
  principalAmount?: number;
  currency?: string;
  lender?: string;
  interestRateApr?: number;
  minimumPaymentMonthly?: number;
  dueDayOfMonth?: number;
  notes?: string;
}

// ==========================================
// NET WORTH & SNAPSHOTS
// ==========================================

export interface NetWorthOverview {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  currency: string;
  assetBreakdown: AssetSummary;
  liabilityBreakdown: LiabilitySummary;
  debtToAssetRatio: number;
  liquidityRatio: number;
  lastUpdated: string;
}

export interface NetWorthSnapshot {
  _id: string;
  id?: string;
  userId: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  currency: string;
  assetBreakdown: {
    cash: number;
    bankBalance: number;
    investments: number;
    otherAssets: number;
  };
  liabilityBreakdown: {
    loans: number;
    creditCardDebt: number;
    otherLiabilities: number;
  };
  source: 'MANUAL' | 'AUTO_SCHEDULE' | 'SYSTEM';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetWorthHistory {
  current: NetWorthOverview;
  snapshots: NetWorthSnapshot[];
  totalSnapshots: number;
  oldestNetWorth: number;
  latestNetWorth: number;
  netWorthChange: number;
  percentageChange: number;
}

export interface CreateSnapshotDTO {
  date?: string;
  notes?: string;
  source?: 'MANUAL' | 'AUTO_SCHEDULE' | 'SYSTEM';
}
