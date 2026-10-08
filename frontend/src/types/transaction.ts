export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type PaymentMethod =
  'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CRYPTO' | 'OTHER';

export type TransactionSource = 'MANUAL' | 'CSV_IMPORT' | 'PLAID_SYNC' | 'API';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  isSystem?: boolean;
}

export interface Transaction {
  _id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  merchant: string;
  description: string;
  category: Category;
  subcategory?: string;
  date: string;
  paymentMethod: PaymentMethod;
  isRecurring: boolean;
  notes?: string;
  tags: string[];
  source: TransactionSource;
  attachments?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  transactionCount: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedTransactionsResponse {
  transactions: Transaction[];
  pagination: PaginationMetadata;
  summary: FinancialSummary;
}

export interface TransactionFiltersState {
  search?: string;
  type?: TransactionType | '';
  category?: string;
  paymentMethod?: PaymentMethod | '';
  startDate?: string;
  endDate?: string;
  minAmount?: number | '';
  maxAmount?: number | '';
  recurring?: boolean;
  sortBy: 'date' | 'amount' | 'merchant' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface CreateTransactionDTO {
  amount: number;
  type: TransactionType;
  merchant: string;
  description?: string;
  category: string;
  subcategory?: string;
  date: string;
  paymentMethod?: PaymentMethod;
  currency?: string;
  notes?: string;
  tags?: string[];
  source?: TransactionSource;
  recurring?: boolean;
  isRecurring?: boolean;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}

export type UpdateTransactionDTO = Partial<CreateTransactionDTO>;
