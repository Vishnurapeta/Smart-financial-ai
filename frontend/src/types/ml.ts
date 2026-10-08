export interface CategorizationRequest {
  text: string;
  dateContext?: string;
}

export interface CategorizationResult {
  rawText: string;
  amount: number | null;
  currency: string;
  merchant: string | null;
  category?: {
    id: string | null;
    name: string;
    slug: string;
    color?: string;
    icon?: string;
  };
  predictedCategory?: string;
  categorySlug?: string;
  categoryId?: string | null;
  predictedSubcategory?: string | null;
  subcategory?: string | null;
  transactionType: 'INCOME' | 'EXPENSE';
  date: string;
  confidence: number;
  requiresConfirmation: boolean;
  source: string;
  explanation?: string;
}

export interface CategorizationFeedbackRequest {
  rawText: string;
  predictedCategory: string;
  predictedCategorySlug?: string;
  predictedSubcategory?: string | null;
  predictedAmount?: number | null;
  predictedMerchant?: string | null;
  confidence: number;
  finalCategory: string;
  finalSubcategory?: string | null;
  finalAmount: number;
  finalMerchant: string;
  finalType: 'INCOME' | 'EXPENSE';
  transactionId?: string;
  wasCorrect: boolean;
  notes?: string;
}
