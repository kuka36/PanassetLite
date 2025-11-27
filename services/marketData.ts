
import { AssetMetadata, AssetType, Currency, ExchangeRates } from '../types';
import { StorageService } from './StorageService';

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';
const COINGECKO_HISTORY_API = 'https://api.coingecko.com/api/v3/coins';

// Cache Keys
const CACHE_RATES_KEY = 'investflow_rates';
const CACHE_CRYPTO_KEY = 'investflow_crypto_prices';
const CACHE_STOCKS_KEY = 'investflow_stock_prices';
const CACHE_HISTORY_KEY = 'investflow_asset_history';

// Cache Duration (ms)
// OPTIMIZATION: Increased TTL to reduce API calls
const RATES_TTL = 24 * 3600 * 1000;
const CRYPTO_TTL = 10 * 60 * 1000;
const STOCK_TTL = 45 * 60 * 1000; // 45 Minutes (Strict caching for Alpha Vantage)
const HISTORY_TTL = 24 * 3600 * 1000; // 24 Hours (Daily history doesn't change often)

// Simple Crypto Mapping
const CRYPTO_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink'
};

export interface StockPriceResult {
  price: number;
  currency: Currency;
  lastUpdated?: number;
}

export interface HistoricalDataPoint {
  date: string; // YYYY-MM-DD
  price: number;
}

export const detectCurrencyFromSymbol = (symbol: string): Currency => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('.SS') || upper.endsWith('.SZ')) return Currency.CNY;
  if (upper.endsWith('.HK')) return Currency.HKD;
  return Currency.USD;
};

// --- 1. Exchange Rates ---
export const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  const cached = StorageService.getCache<ExchangeRates>(CACHE_RATES_KEY);
  const isStale = cached ? (Date.now() - cached.timestamp) > RATES_TTL : true;

  if (cached && !isStale) return cached.data;

  try {
    const res = await fetch(EXCHANGE_RATE_API);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    StorageService.saveCache(CACHE_RATES_KEY, data.rates);
    return data.rates;
  } catch (error) {
    console.warn("Exchange Rate API failed, using fallback cache", error);
    return cached?.data || { USD: 1, CNY: 7.2, HKD: 7.8 };
  }
};

// --- 2. Crypto Prices ---
export const fetchCryptoPrices = async (assets: AssetMetadata[]): Promise<Record<string, number>> => {
  const cryptoAssets = assets.filter(a => a.type === AssetType.CRYPTO);
  if (cryptoAssets.length === 0) return {};

  const cached = StorageService.getCache<Record<string, number>>(CACHE_CRYPTO_KEY);
  const isStale = cached ? (Date.now() - cached.timestamp) > CRYPTO_TTL : true;

  if (cached && !isStale) {
    const allCovered = cryptoAssets.every(a => cached.data[a.id] !== undefined);
    if (allCovered) return cached.data;
  }

  const ids = cryptoAssets
    .map(a => CRYPTO_MAP[a.symbol.toUpperCase()] || a.name.toLowerCase().replace(/\s+/g, '-'))
    .join(',');

  if (!ids) return cached?.data || {};

  try {
    const res = await fetch(`${COINGECKO_API}?ids=${ids}&vs_currencies=usd`);
    if (!res.ok) throw new Error("CoinGecko API Error");
    const data = await res.json();

    const newPriceMap: Record<string, number> = { ...(cached?.data || {}) };
    cryptoAssets.forEach(asset => {
      const id = CRYPTO_MAP[asset.symbol.toUpperCase()] || asset.name.toLowerCase().replace(/\s+/g, '-');
      if (data[id] && data[id].usd) {
        newPriceMap[asset.id] = data[id].usd;
      }
    });

    StorageService.saveCache(CACHE_CRYPTO_KEY, newPriceMap);
    return newPriceMap;
  } catch (error) {
    console.warn("Crypto API failed, using stale cache", error);
    return cached?.data || {};
  }
};

// --- 3. Stock Prices ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchStockPrices = async (assets: AssetMetadata[], apiKey?: string): Promise<Record<string, StockPriceResult>> => {
  const stockAssets = assets.filter(a => a.type === AssetType.STOCK || a.type === AssetType.FUND);
  if (stockAssets.length === 0) return {};

  const cached = StorageService.getCache<Record<string, StockPriceResult>>(CACHE_STOCKS_KEY);
  const priceMap: Record<string, StockPriceResult> = { ...(cached?.data || {}) };

  const now = Date.now();
  const assetsToFetch: AssetMetadata[] = [];

  for (const asset of stockAssets) {
    const cachedItem = priceMap[asset.id];
    // Strict Cache Check: If data exists and is younger than TTL, skip fetch.
    if (!cachedItem || !cachedItem.lastUpdated || (now - cachedItem.lastUpdated > STOCK_TTL)) {
      assetsToFetch.push(asset);
    }
  }

  // If we have nothing to fetch, return cache immediately
  if (assetsToFetch.length === 0) {
    return priceMap;
  }

  // Cap queue to avoid endless fetching if user has 50 stocks
  const limitedQueue = assetsToFetch.slice(0, 5);
  let dataUpdated = false;

  if (!apiKey) {
    console.warn("Alpha Vantage API Key is missing. Skipping stock price fetch.");
    return priceMap;
  }

  for (const asset of limitedQueue) {
    try {
      let querySymbol = asset.symbol;
      if (asset.currency === Currency.HKD && !querySymbol.includes('.')) {
        querySymbol = `${querySymbol}.HK`;
      } else if (asset.currency === Currency.CNY && !querySymbol.includes('.')) {
        querySymbol = querySymbol.startsWith('6') ? `${querySymbol}.SS` : `${querySymbol}.SZ`;
      }

      const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${querySymbol}&apikey=${apiKey}`);
      const data = await res.json();

      // Circuit Breaker: If API Limit reached, stop immediately to save quota
      if (data['Note'] || data['Information']) {
        console.warn("Alpha Vantage Rate Limit Reached. Stopping fetch queue.");
        break;
      }

      if (data['Global Quote'] && data['Global Quote']['05. price']) {
        const price = parseFloat(data['Global Quote']['05. price']);
        const detectedCurrency = detectCurrencyFromSymbol(data['Global Quote']['01. symbol'] || querySymbol);

        priceMap[asset.id] = {
          price,
          currency: detectedCurrency,
          lastUpdated: Date.now()
        };
        dataUpdated = true;
      }

      // OPTIMIZATION: Increased delay to 15s (4 calls/min) to be super safe for Free Tier
      if (limitedQueue.length > 1) await delay(15000);

    } catch (e) {
      // console.error(`Failed to fetch stock ${asset.symbol}`, e);
    }
  }

  if (dataUpdated) {
    StorageService.saveCache(CACHE_STOCKS_KEY, priceMap);
  }

  return priceMap;
};

// --- 4. Historical Data ---

export const fetchAssetHistory = async (asset: AssetMetadata, apiKey?: string): Promise<HistoricalDataPoint[]> => {
  // 1. Check Cache
  const cacheKey = `${CACHE_HISTORY_KEY}_${asset.id}`;
  const cached = StorageService.getCache<HistoricalDataPoint[]>(cacheKey);

  // Strict 24 Hour TTL for History
  const isStale = cached ? (Date.now() - cached.timestamp) > HISTORY_TTL : true;

  if (cached && cached.data.length > 0 && !isStale) {
    return cached.data;
  }

  try {
    let history: HistoricalDataPoint[] = [];

    if (asset.type === AssetType.CRYPTO) {
      // CoinGecko Market Chart (Last 365 Days)
      const id = CRYPTO_MAP[asset.symbol.toUpperCase()] || asset.name.toLowerCase().replace(/\s+/g, '-');
      const res = await fetch(`${COINGECKO_HISTORY_API}/${id}/market_chart?vs_currency=usd&days=365&interval=daily`);
      if (res.ok) {
        const data = await res.json();
        if (data.prices) {
          history = data.prices.map((item: any) => ({
            date: new Date(item[0]).toISOString().split('T')[0],
            price: item[1]
          }));
        }
      }
    } else if ((asset.type === AssetType.STOCK || asset.type === AssetType.FUND) && apiKey) {
      // Alpha Vantage Time Series Daily
      let querySymbol = asset.symbol;
      if (asset.currency === Currency.HKD && !querySymbol.includes('.')) querySymbol = `${querySymbol}.HK`;
      else if (asset.currency === Currency.CNY && !querySymbol.includes('.')) querySymbol = querySymbol.startsWith('6') ? `${querySymbol}.SS` : `${querySymbol}.SZ`;

      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${querySymbol}&apikey=${apiKey}`);
      const data = await res.json();

      // Circuit Breaker for History
      if (data['Note'] || data['Information']) {
        console.warn("Alpha Vantage Rate Limit Reached (History). Using Cache/Fallback.");
        return cached?.data || [];
      }

      if (data['Time Series (Daily)']) {
        const series = data['Time Series (Daily)'];
        history = Object.keys(series).map(date => ({
          date: date,
          price: parseFloat(series[date]['4. close'])
        })).sort((a, b) => a.date.localeCompare(b.date)); // Sort ascending
      }
    }

    // Fill gaps or fallback
    if (history.length > 0) {
      StorageService.saveCache(cacheKey, history);
      return history;
    } else {
      // Return existing cache even if stale if fetch failed
      if (cached?.data) return cached.data;

      // Fallback for Manual Assets
      const today = new Date().toISOString().split('T')[0];
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      return [
        { date: lastYear.toISOString().split('T')[0], price: asset.currentPrice },
        { date: today, price: asset.currentPrice }
      ];
    }

  } catch (e) {
    console.warn(`Failed to fetch history for ${asset.symbol}`, e);
    return cached?.data || [];
  }
};

// --- Cache Cleanup Helpers ---

export const clearAssetHistoryCache = (assetId: string) => {
  const cacheKey = `${CACHE_HISTORY_KEY}_${assetId}`;
  StorageService.remove(cacheKey);
};

export const clearAllHistoryCache = () => {
  StorageService.clearItemsByPrefix(CACHE_HISTORY_KEY);
};

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
