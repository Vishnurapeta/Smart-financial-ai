/**
 * Centralized formatting utilities and currency configuration for SmartFin AI
 * Provides safe currency, number, and percentage formatting.
 * Guaranteed never to throw TypeError on undefined/null/NaN values.
 */

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  compact?: boolean;
  fallbackText?: string;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  name: string;
}

/**
 * Supported base currencies and their localization specifications
 */
export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
  CAD: { code: 'CAD', symbol: 'CA$', locale: 'en-CA', name: 'Canadian Dollar' },
  AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
  CHF: { code: 'CHF', symbol: 'CHF', locale: 'de-CH', name: 'Swiss Franc' },
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
  AED: { code: 'AED', symbol: 'AED', locale: 'ar-AE', name: 'UAE Dirham' },
};

export const DEFAULT_CURRENCY = 'USD';

/**
 * Returns configuration for a given currency code with safe USD fallback
 */
export function getCurrencyConfig(code?: string): CurrencyConfig {
  const safeCode = (code || DEFAULT_CURRENCY).toUpperCase().trim();
  return (
    CURRENCIES[safeCode] || {
      code: safeCode,
      symbol: safeCode === 'INR' ? '₹' : safeCode === 'EUR' ? '€' : safeCode === 'GBP' ? '£' : '$',
      locale: 'en-US',
      name: safeCode,
    }
  );
}

/**
 * Returns standard symbol (e.g. ₹, $, €, £) for a currency code
 */
export function getCurrencySymbol(code?: string): string {
  return getCurrencyConfig(code).symbol;
}

/**
 * Safely formats any numeric value to localized currency format.
 * Correctly handles:
 * - undefined, null, NaN -> returns safe fallback or '—'
 * - 0 -> correctly formats e.g. ₹0 or $0
 * - negative values -> correctly displays e.g. -₹500 or -$500
 * - valid numeric strings
 * - custom fraction digits and compact notation
 */
export function formatCurrency(
  value: unknown,
  currency = DEFAULT_CURRENCY,
  options: CurrencyFormatOptions = {},
): string {
  const {
    currency: optionCurrency,
    locale: optionLocale,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    compact = false,
    fallbackText = '—',
  } = options;

  if (value === undefined || value === null) {
    return fallbackText;
  }

  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(num)) {
    return fallbackText;
  }

  const activeCurrency = optionCurrency || currency;
  const config = getCurrencyConfig(activeCurrency);
  const activeLocale = optionLocale || config.locale;

  try {
    if (compact) {
      // For compact formatting (e.g. ₹10k, ₹1.5M, $1.5M)
      if (Math.abs(num) >= 1_000_000_000) {
        return (
          new Intl.NumberFormat(activeLocale, {
            style: 'currency',
            currency: config.code,
            maximumFractionDigits: 1,
          })
            .format(num / 1_000_000_000)
            .replace(/\s+/g, '') + 'B'
        );
      }
      if (Math.abs(num) >= 1_000_000) {
        return (
          new Intl.NumberFormat(activeLocale, {
            style: 'currency',
            currency: config.code,
            maximumFractionDigits: 1,
          })
            .format(num / 1_000_000)
            .replace(/\s+/g, '') + 'M'
        );
      }
      if (Math.abs(num) >= 1_000) {
        return (
          new Intl.NumberFormat(activeLocale, {
            style: 'currency',
            currency: config.code,
            maximumFractionDigits: 0,
          })
            .format(num / 1_000)
            .replace(/\s+/g, '') + 'k'
        );
      }
    }

    return new Intl.NumberFormat(activeLocale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(num);
  } catch {
    // Fallback if currency code or locale is not supported in environment
    return `${config.symbol}${num.toLocaleString(activeLocale, {
      minimumFractionDigits,
      maximumFractionDigits,
    })}`;
  }
}

/**
 * Safely formats any numeric value to a localized number string.
 */
export function formatNumber(
  value: unknown,
  options: Intl.NumberFormatOptions = {},
  fallbackText = '0',
): string {
  if (value === undefined || value === null) {
    return fallbackText;
  }

  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(num)) {
    return fallbackText;
  }

  try {
    return num.toLocaleString(undefined, options);
  } catch {
    return String(num);
  }
}

/**
 * Safely formats a percentage value (e.g., 85.5%).
 */
export function formatPercentage(value: unknown, decimals = 1, fallbackText = '0.0%'): string {
  if (value === undefined || value === null) {
    return fallbackText;
  }

  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(num)) {
    return fallbackText;
  }

  return `${num.toFixed(decimals)}%`;
}
