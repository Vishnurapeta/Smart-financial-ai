import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { User } from '../models/user.model.js';
import { Category, CategoryType } from '../models/category.model.js';
import { CategorizationFeedback } from '../models/categorization-feedback.model.js';

export interface MLServiceCategorizationResult {
  rawText: string;
  amount: number | null;
  currency: string;
  merchant: string;
  category: {
    id: string | null;
    name: string;
    slug: string;
    color: string;
    icon: string;
  };
  categoryId?: string | null;
  categorySlug: string;
  predictedCategory: string;
  predictedSubcategory: string;
  subcategory: string;
  transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
  confidence: number;
  requiresConfirmation: boolean;
  source: string;
  modelVersion: string;
  explanation?: string;
}

export interface FeedbackInput {
  rawText: string;
  parsedAmount?: number | null;
  parsedCurrency?: string | null;
  parsedMerchant?: string | null;
  predictedCategorySlug?: string;
  predictedCategory?: string;
  predictedSubcategory?: string | null;
  confidence: number;
  requiresConfirmation?: boolean;
  userAccepted?: boolean;
  correctedCategorySlug?: string;
  correctedCategoryId?: string;
  transactionId?: string;
  source?: string;
  modelVersion?: string;
}

export class MLService {
  /**
   * Natural Language Transaction Categorization via FastAPI ML Service with heuristic fallback
   */
  static async categorize(
    userId: string,
    text: string,
    dateContext?: string,
  ): Promise<MLServiceCategorizationResult> {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AppError('Transaction description cannot be empty or invalid', 400);
    }
    const rawText = text.trim();

    // Determine user's base currency
    let baseCurrency = 'INR';
    if (userId && Types.ObjectId.isValid(userId)) {
      try {
        const user = await User.findById(userId).select('defaultCurrency');
        if (user?.defaultCurrency) {
          baseCurrency = user.defaultCurrency;
        }
      } catch (err) {
        // Fallback to INR default
      }
    }

    let mlResponse: {
      raw_text?: string;
      amount: number | null;
      currency: string;
      merchant: string;
      category: string;
      category_name: string;
      subcategory: string;
      transaction_type: string;
      date: string;
      confidence: number;
      requires_confirmation: boolean;
      source: string;
      model_version: string;
      explanation?: string;
    } | null = null;

    // 1. Attempt call to FastAPI ML Service
    try {
      const url = `${env.ML_SERVICE_URL}/categorize`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.ML_SERVICE_SECRET_TOKEN}`,
        },
        body: JSON.stringify({
          text: rawText,
          date_context: dateContext,
          base_currency: baseCurrency,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as { data: typeof mlResponse };
        mlResponse = json.data;
      } else {
        logger.warn(
          `ML microservice returned status ${response.status}; engaging Node heuristic fallback`,
        );
      }
    } catch (err) {
      logger.warn(
        `ML microservice unreachable at ${env.ML_SERVICE_URL}: ${(err as Error).message}. Engaging Node heuristic fallback.`,
      );
    }

    // 2. Fallback heuristic if ML microservice was unreachable or failed
    if (!mlResponse) {
      mlResponse = MLService.heuristicFallback(rawText, baseCurrency);
    }

    // 2.5 Validation & Sanitization Layer
    const lowerText = rawText.toLowerCase();
    const FORBIDDEN_MERCHANTS = [
      'around',
      'about',
      'approx',
      'approximately',
      'roughly',
      'nearly',
      'almost',
      'spent',
      'paid',
      'bought',
      'cost',
      'fee',
      'charge',
      'today',
      'yesterday',
      'for',
      'on',
      'at',
      'from',
      'to',
    ];

    // Reject modifier/action words as merchant
    if (
      !mlResponse.merchant ||
      FORBIDDEN_MERCHANTS.includes(mlResponse.merchant.toLowerCase().trim()) ||
      mlResponse.merchant.trim().length < 2
    ) {
      if (/\b(?:movie|cinema|theatre|theater|multiplex|pvr|inox|film)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Movie / Cinema';
      } else if (/\b(?:game|gaming|steam|playstation|xbox|nintendo)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Game';
      } else if (/\b(?:groceries|grocery|supermarket)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Groceries';
      } else if (/\b(?:electricity|electric\s+bill|power\s+bill)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Electricity Provider';
      } else if (/\b(?:water\s+bill)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Water Utility';
      } else if (/\b(?:gas\s+bill)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Gas Utility';
      } else if (/\b(?:broadband|wifi|internet\s+bill)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Internet Provider';
      } else if (
        /\b(?:salary|payroll|paycheck|stipend)\b/i.test(lowerText) ||
        mlResponse.transaction_type === 'INCOME'
      ) {
        mlResponse.merchant = 'Employer';
      } else if (/\b(?:uber)\b/i.test(lowerText)) {
        mlResponse.merchant = 'Uber';
      } else {
        mlResponse.merchant = 'General Merchant';
      }
    }

    // Semantic Contradiction Guard
    if (/\b(?:movie|cinema|theatre|theater|multiplex|pvr|inox|film)\b/i.test(lowerText)) {
      mlResponse.category = 'entertainment-leisure';
      mlResponse.category_name = 'Entertainment & Leisure';
      mlResponse.subcategory = 'Movies / Cinema';
      mlResponse.confidence = Math.max(mlResponse.confidence, 0.96);
      if (mlResponse.merchant === 'General Merchant') mlResponse.merchant = 'Movie / Cinema';
    } else if (/\b(?:game|gaming|steam|playstation|xbox|nintendo)\b/i.test(lowerText)) {
      mlResponse.category = 'entertainment-leisure';
      mlResponse.category_name = 'Entertainment & Leisure';
      mlResponse.subcategory = 'Video Games';
      mlResponse.confidence = Math.max(mlResponse.confidence, 0.96);
    } else if (/\b(?:groceries|grocery)\b/i.test(lowerText)) {
      mlResponse.category = 'groceries';
      mlResponse.category_name = 'Groceries';
      mlResponse.subcategory = 'Groceries';
      mlResponse.confidence = Math.max(mlResponse.confidence, 0.96);
    } else if (/\b(?:electricity|electric\s+bill|power\s+bill)\b/i.test(lowerText)) {
      mlResponse.category = 'utilities-bills';
      mlResponse.category_name = 'Utilities & Bills';
      mlResponse.subcategory = 'Electricity';
      mlResponse.confidence = Math.max(mlResponse.confidence, 0.96);
    } else if (/\b(?:salary|payroll|paycheck)\b/i.test(lowerText)) {
      mlResponse.category = 'salary-wages';
      mlResponse.category_name = 'Salary & Wages';
      mlResponse.subcategory = 'Paycheck';
      mlResponse.transaction_type = 'INCOME';
      mlResponse.confidence = Math.max(mlResponse.confidence, 0.96);
    }

    // 3. Resolve predicted category slug against MongoDB Category Collection

    const categoryFilter = {
      isDeleted: false,
      slug: mlResponse.category,
      $or: [{ isSystem: true }, { userId: null }, { userId: new Types.ObjectId(userId) }],
    };

    let categoryDoc = await Category.findOne(categoryFilter);

    // If exact slug didn't match, attempt matching by category name (case-insensitive)
    if (!categoryDoc && mlResponse.category_name) {
      const escapedName = mlResponse.category_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      categoryDoc = await Category.findOne({
        isDeleted: false,
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        $or: [{ isSystem: true }, { userId: null }, { userId: new Types.ObjectId(userId) }],
      });
    }

    // If still not matched, attempt matching by type (first Expense or Income category)
    if (!categoryDoc) {
      categoryDoc = await Category.findOne({
        isDeleted: false,
        type: mlResponse.transaction_type === 'INCOME' ? CategoryType.INCOME : CategoryType.EXPENSE,
      });
    }

    // 4. Safety Guard: Enforce confirmation requirement when confidence is low or fields missing
    let requiresConfirmation = mlResponse.requires_confirmation;
    let explanation = mlResponse.explanation;
    if (mlResponse.amount === null || mlResponse.amount <= 0) {
      requiresConfirmation = true;
      explanation = 'Transaction amount could not be detected. Please verify or enter the amount.';
    } else if (mlResponse.confidence < 0.75) {
      requiresConfirmation = true;
      if (!explanation) {
        explanation =
          'The AI model detected lower confidence. Please review the details below before adding to your ledger.';
      }
    }

    const categoryInfo = categoryDoc
      ? {
          id: categoryDoc._id.toString(),
          name: categoryDoc.name,
          slug: categoryDoc.slug,
          color: categoryDoc.color || '#10B981',
          icon: categoryDoc.icon || 'tag',
        }
      : {
          id: null,
          name: mlResponse.category_name || 'General',
          slug: mlResponse.category || 'general',
          color: '#10B981',
          icon: 'tag',
        };

    const categoryId = categoryInfo.id;
    const categorySlug = categoryInfo.slug;
    const predictedCategory = categoryInfo.name;
    const predictedSubcategory = mlResponse.subcategory || 'General';

    return {
      rawText,
      amount: mlResponse.amount,
      currency: mlResponse.currency,
      merchant: mlResponse.merchant,
      category: categoryInfo,
      categoryId,
      categorySlug,
      predictedCategory,
      predictedSubcategory,
      subcategory: mlResponse.subcategory,
      transactionType: (mlResponse.transaction_type as 'INCOME' | 'EXPENSE') || 'EXPENSE',
      date: mlResponse.date,
      confidence: mlResponse.confidence,
      requiresConfirmation,
      source: mlResponse.source,
      modelVersion: mlResponse.model_version,
      explanation,
    };
  }

  /**
   * Resilient in-process heuristic parser when ML service is offline
   */
  public static heuristicFallback(text: string, baseCurrency: string = 'INR') {
    const rawText = typeof text === 'string' ? text.trim() : '';
    const lower = rawText.toLowerCase();

    // 1. Currency Extraction (explicit symbols/codes take precedence over baseCurrency)
    let currency = baseCurrency || 'INR';
    if (/(?:₹|rs\.?|inr|rupees)/i.test(rawText)) currency = 'INR';
    else if (/(?:\$|usd|dollars?)/i.test(rawText)) currency = 'USD';
    else if (/(?:€|eur|euros?)/i.test(rawText)) currency = 'EUR';
    else if (/(?:£|gbp|pounds?)/i.test(rawText)) currency = 'GBP';

    // 2. Amount Extraction
    let amount: number | null = null;
    const p1 = rawText.match(/(?:₹|rs\.?|inr|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)/i);
    const p2 = rawText.match(
      /([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr|rupees|\$|usd|dollars?|€|eur|£|gbp)/i,
    );
    const p3 = rawText.match(
      /\b(?:spent|paid|cost|for|debited|amount(?:\s+of)?|credited|received)\s+([\d,]+(?:\.\d{1,2})?)\b/i,
    );
    const p4 = rawText.match(/\b\d+(?:,\d+)*(?:\.\d{1,2})?\b/g);

    if (p1 && p1[1]) {
      const val = parseFloat(p1[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) amount = val;
    } else if (p2 && p2[1]) {
      const val = parseFloat(p2[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) amount = val;
    } else if (p3 && p3[1]) {
      const val = parseFloat(p3[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) amount = val;
    } else if (p4 && p4.length > 0) {
      for (const numStr of p4) {
        const val = parseFloat(numStr.replace(/,/g, ''));
        // Ignore 4-digit years only if multiple numbers exist
        if ((val === 2024 || val === 2025 || val === 2026 || val === 2027) && p4.length > 1) {
          continue;
        }
        if (!isNaN(val) && val > 0) {
          amount = val;
          break;
        }
      }
    }

    // 3. Category & Merchant Classification
    let category = 'shopping-retail';
    let category_name = 'Shopping & Retail';
    let subcategory = 'General';
    let merchant = 'General Merchant';
    let confidence = 0.5;
    let transaction_type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

    // Income
    if (/salary|credited|payroll|bonus|stipend|freelance|dividend|received.*salary/i.test(lower)) {
      category = 'salary-wages';
      category_name = 'Salary & Wages';
      subcategory = 'Paycheck';
      merchant = 'Employer';
      confidence = 0.95;
      transaction_type = 'INCOME';
    }
    // Subscriptions & Software
    else if (
      /netflix|spotify|prime|hotstar|disney|hulu|hbo|youtube premium|subscription|software|chatgpt|openai|github|adobe|notion/i.test(
        lower,
      )
    ) {
      category = 'subscriptions-software';
      category_name = 'Subscriptions & Software';
      subcategory = 'Streaming Entertainment';
      if (/netflix/i.test(lower)) merchant = 'Netflix';
      else if (/spotify/i.test(lower)) merchant = 'Spotify';
      else if (/prime/i.test(lower)) merchant = 'Amazon Prime';
      else if (/chatgpt|openai/i.test(lower)) merchant = 'OpenAI';
      else if (/github/i.test(lower)) merchant = 'GitHub';
      else if (/adobe/i.test(lower)) merchant = 'Adobe';
      else merchant = 'Subscription Service';
      confidence = 0.95;
    }
    // Dining & Restaurants
    else if (
      /swiggy|zomato|dinner|lunch|breakfast|food|restaurant|cafe|coffee|pizza|burger|starbucks|mcdonald|kfc|domino|subway|chipotle|taco bell|biryani|barbeque nation/i.test(
        lower,
      )
    ) {
      category = 'dining-restaurants';
      category_name = 'Dining & Restaurants';
      subcategory = /swiggy|zomato/i.test(lower) ? 'Food Delivery' : 'Restaurant';
      if (/swiggy/i.test(lower)) merchant = 'Swiggy';
      else if (/zomato/i.test(lower)) merchant = 'Zomato';
      else if (/starbucks/i.test(lower)) merchant = 'Starbucks';
      else if (/mcdonald/i.test(lower)) merchant = "McDonald's";
      else if (/kfc/i.test(lower)) merchant = 'KFC';
      else if (/domino/i.test(lower)) merchant = "Domino's";
      else merchant = 'Restaurant';
      confidence = 0.92;
    }
    // Transportation & Fuel
    else if (
      /uber|ola|cab|lyft|rapido|petrol|diesel|fuel|fastag|metro|train|irctc|flight|indigo|air india/i.test(
        lower,
      )
    ) {
      category = 'transportation-fuel';
      category_name = 'Transportation & Fuel';
      subcategory = /uber|ola|lyft|rapido/i.test(lower) ? 'Ride Sharing' : 'Fuel';
      if (/uber/i.test(lower)) merchant = 'Uber';
      else if (/ola/i.test(lower)) merchant = 'Ola';
      else if (/lyft/i.test(lower)) merchant = 'Lyft';
      else if (/rapido/i.test(lower)) merchant = 'Rapido';
      else if (/petrol|fuel|indian oil|bharat petroleum|shell/i.test(lower))
        merchant = 'Fuel Station';
      else merchant = 'Transit Provider';
      confidence = 0.92;
    }
    // Groceries
    else if (
      /blinkit|zepto|instamart|grocery|supermarket|dmart|bigbasket|vegetables|fruits|milk/i.test(
        lower,
      )
    ) {
      category = 'groceries';
      category_name = 'Groceries';
      subcategory = 'Quick Commerce';
      if (/blinkit/i.test(lower)) merchant = 'Blinkit';
      else if (/zepto/i.test(lower)) merchant = 'Zepto';
      else if (/instamart/i.test(lower)) merchant = 'Instamart';
      else if (/bigbasket/i.test(lower)) merchant = 'BigBasket';
      else if (/dmart/i.test(lower)) merchant = 'DMart';
      else merchant = 'Supermarket';
      confidence = 0.92;
    }
    // Utilities & Bills
    else if (
      /electricity|power|bescom|tata power|water|gas|piped gas|igl|broadband|internet|wifi|airtel|jio|bill|utility/i.test(
        lower,
      )
    ) {
      category = 'utilities-bills';
      category_name = 'Utilities & Bills';
      subcategory = /electricity|bescom|tata power/i.test(lower) ? 'Electricity' : 'Utility Bills';
      if (/bescom/i.test(lower)) merchant = 'BESCOM';
      else if (/tata power/i.test(lower)) merchant = 'Tata Power';
      else if (/airtel/i.test(lower)) merchant = 'Airtel';
      else if (/jio/i.test(lower)) merchant = 'Jio';
      else merchant = 'Utility Provider';
      confidence = 0.92;
    }
    // Entertainment & Leisure
    else if (/pvr|inox|bookmyshow|movie|cinema|theatre|theater|multiplex|steam|playstation|game/i.test(lower)) {
      category = 'entertainment-leisure';
      category_name = 'Entertainment & Leisure';
      subcategory = /game|steam|playstation/i.test(lower) ? 'Video Games' : 'Movies / Cinema';
      if (/pvr/i.test(lower)) merchant = 'PVR';
      else if (/inox/i.test(lower)) merchant = 'INOX';
      else if (/bookmyshow/i.test(lower)) merchant = 'BookMyShow';
      else if (/game|steam|playstation/i.test(lower)) merchant = 'Game';
      else merchant = 'Movie / Cinema';
      confidence = 0.96;
    }
    // Healthcare & Medical
    else if (
      /apollo|pharmacy|medicine|doctor|hospital|clinic|medplus|cult\.fit|gym|fitness/i.test(lower)
    ) {
      category = 'healthcare-medical';
      category_name = 'Healthcare & Medical';
      subcategory = 'Pharmacy';
      if (/apollo/i.test(lower)) merchant = 'Apollo Pharmacy';
      else if (/medplus/i.test(lower)) merchant = 'Medplus';
      else if (/cult\.fit/i.test(lower)) merchant = 'Cult.fit';
      else merchant = 'Healthcare Provider';
      confidence = 0.92;
    }
    // Shopping & Retail
    else if (/amazon|flipkart|myntra|zara|h&m|nike|adidas|shopping|retail|cloth/i.test(lower)) {
      category = 'shopping-retail';
      category_name = 'Shopping & Retail';
      subcategory = 'E-Commerce';
      if (/amazon/i.test(lower)) merchant = 'Amazon';
      else if (/flipkart/i.test(lower)) merchant = 'Flipkart';
      else if (/myntra/i.test(lower)) merchant = 'Myntra';
      else if (/zara/i.test(lower)) merchant = 'Zara';
      else if (/nike/i.test(lower)) merchant = 'Nike';
      else merchant = 'Retail Merchant';
      confidence = 0.92;
    }

    // Try preposition merchant extraction if still general
    if (merchant === 'General Merchant') {
      const prepMatch = rawText.match(
        /\b(?:at|from|to|on|for)\s+(?:an?\s+|the\s+)?([A-Za-z0-9'&.-]+(?:\s+[A-Za-z0-9'&.-]+)?)/i,
      );
      if (prepMatch && prepMatch[1]) {
        const candidate = prepMatch[1].trim();
        if (
          !/^(around|about|approx|approximately|roughly|nearly|almost|spent|paid|bought|cost|dinner|lunch|breakfast|groceries|home|office|store|yesterday|today|bank|account)$/i.test(
            candidate,
          )
        ) {
          merchant = candidate;
        }
      }
    }

    if (merchant === 'General Merchant') {
      if (category === 'entertainment-leisure') {
        merchant = /game/i.test(lower) ? 'Game' : 'Movie / Cinema';
      } else if (category === 'groceries') {
        merchant = 'Groceries';
      } else if (category === 'utilities-bills') {
        merchant = 'Electricity Provider';
      }
    }


    let explanation: string | undefined = undefined;
    if (amount === null || amount <= 0) {
      explanation = 'Transaction amount could not be detected. Please verify or enter the amount.';
    } else if (confidence < 0.75) {
      explanation =
        'The AI model detected lower confidence. Please review the details below before adding to your ledger.';
    }

    return {
      amount,
      currency,
      merchant,
      category,
      category_name,
      subcategory,
      transaction_type,
      date: new Date().toISOString(),
      confidence,
      requires_confirmation: confidence < 0.75 || amount === null || amount <= 0,
      source: 'heuristic_fallback',
      model_version: 'fallback-v1.0',
      explanation,
    };
  }

  /**
   * Persist user corrections and feedback for ML model retraining
   */
  static async recordFeedback(userId: string, input: FeedbackInput): Promise<void> {
    const slug = input.predictedCategorySlug || input.predictedCategory || 'general';
    await CategorizationFeedback.create({
      userId: new Types.ObjectId(userId),
      rawText: input.rawText,
      parsedAmount: input.parsedAmount ?? undefined,
      parsedCurrency: input.parsedCurrency ?? undefined,
      parsedMerchant: input.parsedMerchant ?? undefined,
      predictedCategorySlug: slug,
      predictedSubcategory: input.predictedSubcategory ?? undefined,
      confidence: input.confidence ?? 0.8,
      requiresConfirmation: input.requiresConfirmation || false,
      userAccepted: input.userAccepted !== undefined ? input.userAccepted : true,
      correctedCategorySlug: input.correctedCategorySlug,
      correctedCategoryId: input.correctedCategoryId
        ? new Types.ObjectId(input.correctedCategoryId)
        : undefined,
      transactionId: input.transactionId ? new Types.ObjectId(input.transactionId) : undefined,
      source: input.source || 'ml_feedback',
      modelVersion: input.modelVersion || '1.0.0',
    });
  }
}
