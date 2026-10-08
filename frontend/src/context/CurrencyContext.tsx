import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.tsx';
import {
  CurrencyConfig,
  CurrencyFormatOptions,
  CURRENCIES,
  DEFAULT_CURRENCY,
  getCurrencyConfig,
  formatCurrency as baseFormatCurrency,
} from '../utils/format.ts';
import { api } from '../services/api.ts';

interface CurrencyContextType {
  currency: string;
  config: CurrencyConfig;
  symbol: string;
  locale: string;
  format: (amount: unknown, options?: CurrencyFormatOptions) => string;
  formatCompact: (amount: unknown) => string;
  setCurrency: (newCurrency: string) => Promise<void>;
  availableCurrencies: CurrencyConfig[];
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const STORAGE_KEY = 'smartfin_currency';

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Initialize currency from user profile or localStorage or default USD
  const [currency, setCurrencyState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored || DEFAULT_CURRENCY;
    } catch {
      return DEFAULT_CURRENCY;
    }
  });

  // Sync whenever authenticated user profile changes
  useEffect(() => {
    if (user?.defaultCurrency) {
      const upper = user.defaultCurrency.toUpperCase().trim();
      setCurrencyState(upper);
      try {
        localStorage.setItem(STORAGE_KEY, upper);
      } catch {
        // Ignore localStorage error in private mode
      }
    }
  }, [user?.defaultCurrency]);

  const config = useMemo(() => getCurrencyConfig(currency), [currency]);

  const setCurrency = useCallback(
    async (newCurrency: string) => {
      const safe = (newCurrency || DEFAULT_CURRENCY).toUpperCase().trim();
      setCurrencyState(safe);
      try {
        localStorage.setItem(STORAGE_KEY, safe);
      } catch {
        // Ignore
      }

      // If user is authenticated, persist to backend profile
      if (user) {
        try {
          await api.updateProfile({ defaultCurrency: safe });
        } catch (err) {
          console.error('Failed to persist currency change to server', err);
        }
      }
    },
    [user],
  );

  const format = useCallback(
    (amount: unknown, options: CurrencyFormatOptions = {}) => {
      return baseFormatCurrency(amount, currency, options);
    },
    [currency],
  );

  const formatCompact = useCallback(
    (amount: unknown) => {
      return baseFormatCurrency(amount, currency, { compact: true });
    },
    [currency],
  );

  const availableCurrencies = useMemo(() => Object.values(CURRENCIES), []);

  return (
    <CurrencyContext.Provider
      value={{
        currency: config.code,
        config,
        symbol: config.symbol,
        locale: config.locale,
        format,
        formatCompact,
        setCurrency,
        availableCurrencies,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Fallback if rendered outside CurrencyProvider
    const fallbackConfig = getCurrencyConfig(DEFAULT_CURRENCY);
    return {
      currency: fallbackConfig.code,
      config: fallbackConfig,
      symbol: fallbackConfig.symbol,
      locale: fallbackConfig.locale,
      format: (amount, options) => baseFormatCurrency(amount, DEFAULT_CURRENCY, options),
      formatCompact: (amount) => baseFormatCurrency(amount, DEFAULT_CURRENCY, { compact: true }),
      setCurrency: async () => {},
      availableCurrencies: Object.values(CURRENCIES),
    };
  }
  return context;
};
