import { ExchangeRates } from '../../types/store';
import { StorageService } from '../StorageService';
import { CACHE_RATES_KEY, EXCHANGE_RATE_API, RATES_TTL } from './constants';

let ratesPromise: Promise<ExchangeRates> | null = null;

export const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  const cached = StorageService.getCache<ExchangeRates>(CACHE_RATES_KEY);
  const isStale = cached ? (Date.now() - cached.timestamp) > RATES_TTL : true;

  if (cached && !isStale) return cached.data;

  if (ratesPromise) return ratesPromise;

  ratesPromise = (async () => {
    try {
      const res = await fetch(EXCHANGE_RATE_API);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      StorageService.saveCache(CACHE_RATES_KEY, data.rates);
      return data.rates;
    } catch (error) {
      console.warn("Exchange Rate API failed, using fallback cache", error);
      return cached?.data || { USD: 1, CNY: 7.2, HKD: 7.8 };
    } finally {
      ratesPromise = null;
    }
  })();

  return ratesPromise;
};
