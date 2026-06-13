import { Currency } from '../../types/domain';
import { ExchangeRates } from '../../types/store';

export const convertValue = (
  value: number,
  fromCurrency: Currency,
  toBase: Currency,
  rates: ExchangeRates
): number => {
  if (fromCurrency === toBase) return value;
  const rateFrom = rates[fromCurrency] || 1;
  const rateTo = rates[toBase] || 1;
  if (rateFrom === 0) return value;
  return (value / rateFrom) * rateTo;
};

export const detectCurrencyFromSymbol = (symbol: string): Currency => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('.SS') || upper.endsWith('.SZ')) return Currency.CNY;
  if (upper.endsWith('.HK')) return Currency.HKD;
  return Currency.USD;
};
