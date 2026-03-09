import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Supported currencies with symbols and formatting
export const CURRENCIES = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', position: 'before' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', position: 'before' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', position: 'before' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', position: 'before' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE', position: 'before' },
  SAR: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', locale: 'ar-SA', position: 'before' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', position: 'before' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', position: 'before' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', position: 'before' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', position: 'before' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA', position: 'before' },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', position: 'before' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH', position: 'before' },
  NPR: { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee', locale: 'ne-NP', position: 'before' },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD', position: 'before' },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', locale: 'ur-PK', position: 'before' },
  LKR: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', locale: 'si-LK', position: 'before' },
};

// Default exchange rates (base: INR)
const DEFAULT_RATES = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AED: 0.044,
  SAR: 0.045,
  JPY: 1.79,
  CNY: 0.087,
  SGD: 0.016,
  AUD: 0.018,
  CAD: 0.016,
  MYR: 0.056,
  THB: 0.42,
  NPR: 1.6,
  BDT: 1.32,
  PKR: 3.35,
  LKR: 3.88,
};

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [baseCurrency, setBaseCurrency] = useState(() => {
    return localStorage.getItem('baseCurrency') || 'INR';
  });
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    return localStorage.getItem('displayCurrency') || 'INR';
  });
  const [exchangeRates, setExchangeRates] = useState(DEFAULT_RATES);
  const [lastRateUpdate, setLastRateUpdate] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesSource, setRatesSource] = useState('default');

  // Fetch live exchange rates on mount and daily
  useEffect(() => {
    const fetchLiveRates = async () => {
      try {
        setRatesLoading(true);
        const API_URL = process.env.REACT_APP_BACKEND_URL || '';
        const response = await fetch(`${API_URL}/api/exchange-rates`);
        if (response.ok) {
          const data = await response.json();
          if (data.rates) {
            setExchangeRates(prev => ({ ...prev, ...data.rates }));
            setLastRateUpdate(data.last_updated ? new Date(data.last_updated) : new Date());
            setRatesSource(data.source || 'api');
            // Cache in localStorage for offline access
            localStorage.setItem('exchangeRates', JSON.stringify(data.rates));
            localStorage.setItem('exchangeRatesDate', data.date);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch live exchange rates, using cached/defaults:', error);
        // Try to use cached rates from localStorage
        const cached = localStorage.getItem('exchangeRates');
        if (cached) {
          try {
            setExchangeRates(prev => ({ ...prev, ...JSON.parse(cached) }));
            setRatesSource('localStorage');
          } catch {}
        }
      } finally {
        setRatesLoading(false);
      }
    };

    fetchLiveRates();
    
    // Refresh rates every 24 hours
    const interval = setInterval(fetchLiveRates, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const refreshRates = useCallback(async () => {
    try {
      setRatesLoading(true);
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${API_URL}/api/exchange-rates/refresh`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.rates) {
          setExchangeRates(prev => ({ ...prev, ...data.rates }));
          setLastRateUpdate(new Date());
          setRatesSource(data.source || 'api');
          localStorage.setItem('exchangeRates', JSON.stringify(data.rates));
          localStorage.setItem('exchangeRatesDate', data.date);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh exchange rates:', error);
      return false;
    } finally {
      setRatesLoading(false);
    }
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('baseCurrency', baseCurrency);
  }, [baseCurrency]);

  useEffect(() => {
    localStorage.setItem('displayCurrency', displayCurrency);
  }, [displayCurrency]);

  // Format currency value (just formatting, no conversion)
  const formatCurrency = useCallback((amount, currencyCode = null) => {
    const currency = CURRENCIES[currencyCode || displayCurrency] || CURRENCIES.INR;
    
    try {
      const formatted = new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: currency.code === 'JPY' ? 0 : 2,
        maximumFractionDigits: currency.code === 'JPY' ? 0 : 2,
      }).format(amount);
      
      return currency.position === 'before' 
        ? `${currency.symbol}${formatted}`
        : `${formatted} ${currency.symbol}`;
    } catch {
      return `${currency.symbol}${amount?.toLocaleString() || '0'}`;
    }
  }, [displayCurrency]);

  // Format with conversion - converts from base currency (INR) to display currency
  const formatWithConversion = useCallback((amount, fromCurrency = 'INR') => {
    if (!amount || isNaN(amount)) return formatCurrency(0);
    
    // If display currency is same as source, just format
    if (displayCurrency === fromCurrency) {
      return formatCurrency(amount);
    }
    
    // Convert from source currency to display currency
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[displayCurrency] || 1;
    
    // Convert: first to INR (base), then to display currency
    const inINR = amount / fromRate;
    const converted = inINR * toRate;
    
    return formatCurrency(converted);
  }, [displayCurrency, exchangeRates, formatCurrency]);

  // Convert between currencies
  const convert = useCallback((amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;
    
    // Convert to INR first, then to target currency
    const inINR = amount / fromRate;
    return inINR * toRate;
  }, [exchangeRates]);

  // Convert from base currency to display currency
  const toDisplayCurrency = useCallback((amount) => {
    return convert(amount, baseCurrency, displayCurrency);
  }, [convert, baseCurrency, displayCurrency]);

  // Convert from display currency to base currency (for saving)
  const toBaseCurrency = useCallback((amount) => {
    return convert(amount, displayCurrency, baseCurrency);
  }, [convert, displayCurrency, baseCurrency]);

  // Get currency info
  const getCurrencyInfo = useCallback((code) => {
    return CURRENCIES[code] || CURRENCIES.INR;
  }, []);

  // Update exchange rates (can be called with API data)
  const updateExchangeRates = useCallback((rates) => {
    setExchangeRates(prev => ({ ...prev, ...rates }));
    setLastRateUpdate(new Date());
  }, []);

  // Get current currency symbol
  const currencySymbol = useMemo(() => {
    const currency = CURRENCIES[displayCurrency] || CURRENCIES.INR;
    return currency.symbol;
  }, [displayCurrency]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    baseCurrency,
    setBaseCurrency,
    displayCurrency,
    setDisplayCurrency,
    exchangeRates,
    updateExchangeRates,
    lastRateUpdate,
    ratesLoading,
    ratesSource,
    refreshRates,
    formatCurrency,
    formatWithConversion,
    convert,
    toDisplayCurrency,
    toBaseCurrency,
    getCurrencyInfo,
    currencySymbol,
    currencies: CURRENCIES,
  }), [
    baseCurrency,
    displayCurrency,
    exchangeRates,
    updateExchangeRates,
    lastRateUpdate,
    ratesLoading,
    ratesSource,
    refreshRates,
    formatCurrency,
    formatWithConversion,
    convert,
    toDisplayCurrency,
    toBaseCurrency,
    getCurrencyInfo,
    currencySymbol
  ]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}

// Currency Selector Component
export function CurrencySelector({ value, onChange, label = "Currency", className = "" }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      >
        {Object.values(CURRENCIES).map(currency => (
          <option key={currency.code} value={currency.code}>
            {currency.symbol} {currency.code} - {currency.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Price Display Component
export function PriceDisplay({ amount, currency, className = "", showCode = false }) {
  const { formatCurrency, displayCurrency } = useCurrency();
  const currencyToUse = currency || displayCurrency;
  
  return (
    <span className={className}>
      {formatCurrency(amount, currencyToUse)}
      {showCode && <span className="text-xs text-muted-foreground ml-1">{currencyToUse}</span>}
    </span>
  );
}

export default CurrencyProvider;
