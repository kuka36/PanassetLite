
import { AssetMetadata, AssetType, Currency, ExchangeRates, MarketDataProvider, MarketDataError, ErrorCategory } from '../types';
import { StorageService } from './StorageService';

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';
const COINGECKO_HISTORY_API = 'https://api.coingecko.com/api/v3/coins';

// Cache Keys
const CACHE_RATES_KEY = 'investflow_rates';
const CACHE_CRYPTO_KEY = 'investflow_crypto_prices';
const CACHE_STOCKS_KEY = 'investflow_stock_prices';
const CACHE_HISTORY_KEY = 'investflow_asset_history';
const CACHE_FAILURES_KEY = 'investflow_api_failures';

// Cache Duration (ms)
// OPTIMIZATION: Increased TTL to reduce API calls
const RATES_TTL = 24 * 3600 * 1000;
const CRYPTO_TTL = 10 * 60 * 1000;
const STOCK_TTL = 45 * 60 * 1000; // 45 Minutes (Strict caching for Alpha Vantage)
const HISTORY_TTL = 24 * 3600 * 1000; // 24 Hours (Daily history doesn't change often)
const FAILURE_TTL = 30 * 60 * 1000; // 30 Minutes (Don't retry failed assets too soon)

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

export const KNOWN_MANUAL_SYMBOLS = [
  'ARBITRAGE_NEW_USER',
  'CSI300ETF_C',
  'ZHOUZHOUBAO_FUND'
];

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

// --- Throttler Implementation ---

import { APIThrottler } from '../utils/throttler';

// Throttlers
// Alpha Vantage: 5 requests per minute. We set window to 65s to be safe.
const avThrottler = new APIThrottler(2000, 5, 65000);
// CoinGecko: 1 request per 1.5s to avoid 429
const cgThrottler = new APIThrottler(1500);
// Finnhub: Generous limit (e.g. 3/sec)
const finnhubThrottler = new APIThrottler(300);

// --- Failure Cache Helpers ---

interface FailureRecord {
  timestamp: number;
  reason: string;
}

const checkFailureCache = (assetId: string): FailureRecord | null => {
  const cache = StorageService.getCache<Record<string, FailureRecord>>(CACHE_FAILURES_KEY);
  if (!cache || !cache.data) return null;

  const record = cache.data[assetId];
  if (record && (Date.now() - record.timestamp < FAILURE_TTL)) {
    return record;
  }
  return null;
};

const saveFailureCache = (assetId: string, reason: string) => {
  const cache = StorageService.getCache<Record<string, FailureRecord>>(CACHE_FAILURES_KEY);
  const data = cache?.data || {};
  data[assetId] = { timestamp: Date.now(), reason };
  StorageService.saveCache(CACHE_FAILURES_KEY, data);
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
  const cryptoAssets = assets.filter(a =>
    a.type === AssetType.CRYPTO &&
    !a.isManualPrice &&
    !KNOWN_MANUAL_SYMBOLS.includes(a.symbol)
  );
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

export interface MarketDataConfig {
  provider: MarketDataProvider;
  alphaVantageKey: string;
  finnhubKey: string;
}

export const fetchStockPrices = async (assets: AssetMetadata[], config: MarketDataConfig): Promise<Record<string, StockPriceResult>> => {
  const stockAssets = assets.filter(a =>
    (a.type === AssetType.STOCK || a.type === AssetType.FUND) &&
    !a.isManualPrice &&
    !KNOWN_MANUAL_SYMBOLS.includes(a.symbol)
  );
  if (stockAssets.length === 0) return {};

  const cached = StorageService.getCache<Record<string, StockPriceResult>>(CACHE_STOCKS_KEY);
  const priceMap: Record<string, StockPriceResult> = { ...(cached?.data || {}) };

  console.log('[MarketData] fetchStockPrices called:', {
    provider: config.provider,
    stockAssetsCount: stockAssets.length,
    hasCachedData: !!cached,
    cachedItemsCount: Object.keys(priceMap).length,
    cacheTimestamp: cached?.timestamp,
    cacheAge: cached ? `${Math.round((Date.now() - cached.timestamp) / 1000 / 60)}min` : 'N/A'
  });

  const now = Date.now();
  const assetsToFetch: AssetMetadata[] = [];
  const cacheHits: string[] = [];
  const cacheMisses: string[] = [];

  for (const asset of stockAssets) {
    const cachedItem = priceMap[asset.id];
    // Finnhub is fast, but let's keep a reasonable TTL (e.g. 10 mins)
    // Alpha Vantage needs longer TTL (45 mins)
    const ttl = config.provider === 'alphavantage' ? STOCK_TTL : 10 * 60 * 1000;

    if (!cachedItem || !cachedItem.lastUpdated || (now - cachedItem.lastUpdated > ttl)) {
      assetsToFetch.push(asset);
      cacheMisses.push(`${asset.symbol}(${cachedItem?.lastUpdated ? `stale:${Math.round((now - cachedItem.lastUpdated) / 1000 / 60)}min` : 'no-cache'})`);
    } else {
      cacheHits.push(`${asset.symbol}(age:${Math.round((now - cachedItem.lastUpdated) / 1000 / 60)}min)`);
    }
  }

  console.log('[MarketData] Cache analysis:', {
    hits: cacheHits,
    misses: cacheMisses,
    assetsToFetch: assetsToFetch.map(a => a.symbol),
    ttl: config.provider === 'alphavantage' ? '45min' : '10min'
  });

  if (assetsToFetch.length === 0) {
    console.log('[MarketData] All prices served from cache ✓');
    return priceMap;
  }

  let dataUpdated = false;

  if (config.provider === 'finnhub') {
    if (!config.finnhubKey) {
      throw {
        category: ErrorCategory.API_KEY_MISSING,
        provider: 'finnhub',
        message: 'Finnhub API Key is missing'
      } as MarketDataError;
    }
    const queue = assetsToFetch.slice(0, 10); // Finnhub allows more
    for (const asset of queue) {
      try {
        let querySymbol = asset.symbol;
        if (asset.currency === Currency.HKD && !querySymbol.includes('.')) querySymbol = `${querySymbol}.HK`;
        else if (asset.currency === Currency.CNY && !querySymbol.includes('.')) querySymbol = querySymbol.startsWith('6') ? `${querySymbol}.SS` : `${querySymbol}.SZ`;

        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${querySymbol}&token=${config.finnhubKey}`);
        if (!res.ok) {
          if (res.status === 429) {
            throw {
              category: ErrorCategory.RATE_LIMIT,
              provider: 'finnhub',
              message: 'Finnhub rate limit exceeded'
            } as MarketDataError;
          }
          if (res.status === 403 || res.status === 401) {
            throw {
              category: ErrorCategory.ACCESS_DENIED,
              provider: 'finnhub',
              message: 'Access denied or invalid API key'
            } as MarketDataError;
          }
          continue;
        }
        const data = await res.json();
        if (data.error) {
          throw {
            category: ErrorCategory.ACCESS_DENIED,
            provider: 'finnhub',
            message: data.error
          } as MarketDataError;
        }
        if (data.c && data.c > 0) {
          priceMap[asset.id] = { price: data.c, currency: detectCurrencyFromSymbol(querySymbol), lastUpdated: Date.now() };
          dataUpdated = true;
        }
        await delay(100);
      } catch (e) { console.warn(`Finnhub fetch failed for ${asset.symbol}`, e); }
    }
  } else {
    // Alpha Vantage
    if (!config.alphaVantageKey) {
      throw {
        category: ErrorCategory.API_KEY_MISSING,
        provider: 'alphavantage',
        message: 'Alpha Vantage API Key is missing'
      } as MarketDataError;
    }
    const queue = assetsToFetch.slice(0, 5); // Strict limit
    for (const asset of queue) {
      try {
        let querySymbol = asset.symbol;
        if (asset.currency === Currency.HKD && !querySymbol.includes('.')) querySymbol = `${querySymbol}.HK`;
        else if (asset.currency === Currency.CNY && !querySymbol.includes('.')) querySymbol = querySymbol.startsWith('6') ? `${querySymbol}.SS` : `${querySymbol}.SZ`;

        const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${querySymbol}&apikey=${config.alphaVantageKey}`);
        const data = await res.json();
        if (data['Note'] || data['Information']) {
          throw {
            category: ErrorCategory.RATE_LIMIT,
            provider: 'alphavantage',
            message: 'Alpha Vantage rate limit exceeded'
          } as MarketDataError;
        }

        if (data['Global Quote'] && data['Global Quote']['05. price']) {
          priceMap[asset.id] = {
            price: parseFloat(data['Global Quote']['05. price']),
            currency: detectCurrencyFromSymbol(data['Global Quote']['01. symbol'] || querySymbol),
            lastUpdated: Date.now()
          };
          dataUpdated = true;
        }
        if (queue.length > 1) await delay(15000); // 15s delay
      } catch (e) { console.warn(`Alpha Vantage fetch failed for ${asset.symbol}`, e); }
    }
  }

  if (dataUpdated) {
    console.log('[MarketData] Saving updated prices to cache:', {
      updatedCount: assetsToFetch.length,
      totalCachedItems: Object.keys(priceMap).length,
      symbols: assetsToFetch.map(a => a.symbol)
    });
    StorageService.saveCache(CACHE_STOCKS_KEY, priceMap);
  } else {
    console.log('[MarketData] No data updated, cache unchanged');
  }

  return priceMap;
};

// --- 4. Historical Data ---

export const fetchAssetHistory = async (
  asset: AssetMetadata,
  config: MarketDataConfig,
  startDate?: Date
): Promise<HistoricalDataPoint[]> => {
  // Use provided startDate or default to 5 years ago
  const historyStartDate = startDate || (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
  })();

  const daysSinceStart = (Date.now() - historyStartDate.getTime()) / (1000 * 3600 * 24);

  // 0. Check Manual Assets
  if (asset.isManualPrice || KNOWN_MANUAL_SYMBOLS.includes(asset.symbol)) {
    const today = new Date().toISOString().split('T')[0];
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    return [
      { date: lastYear.toISOString().split('T')[0], price: asset.currentPrice },
      { date: today, price: asset.currentPrice }
    ];
  }

  // 1. Check Cache
  const cacheKey = `${CACHE_HISTORY_KEY}_${asset.id}`;
  const cached = StorageService.getCache<HistoricalDataPoint[]>(cacheKey);

  // Strict 24 Hour TTL for History
  const isStale = cached ? (Date.now() - cached.timestamp) > HISTORY_TTL : true;

  // Smart Cache Check:
  // If we have cached data, but it looks like "compact" data (approx 100 points)
  // AND we need significantly more history (e.g. > 130 days), treat it as stale to force a re-fetch.
  const isInsufficient = cached && cached.data.length >= 98 && cached.data.length <= 102 && daysSinceStart > 130;

  if (cached && cached.data.length > 0 && !isStale && !isInsufficient) {
    return cached.data;
  }

  // 2. Check Failure Cache
  const failure = checkFailureCache(asset.id);
  if (failure) {
    console.log(`[MarketData] Skipping fetch for ${asset.symbol} due to recent failure: ${failure.reason}`);
    return cached?.data || [];
  }

  try {
    let history: HistoricalDataPoint[] = [];

    if (asset.type === AssetType.CRYPTO) {
      // CoinGecko Market Chart
      // Use 'max' if older than 365 days, otherwise 365 is sufficient (and lighter)
      const daysParam = daysSinceStart > 365 ? 'max' : '365';
      const id = CRYPTO_MAP[asset.symbol.toUpperCase()] || asset.name.toLowerCase().replace(/\s+/g, '-');

      await cgThrottler.add(async () => {
        const res = await fetch(`${COINGECKO_HISTORY_API}/${id}/market_chart?vs_currency=usd&days=${daysParam}&interval=daily`);
        if (res.ok) {
          const data = await res.json();
          if (data.prices) {
            history = data.prices.map((item: any) => ({
              date: new Date(item[0]).toISOString().split('T')[0],
              price: item[1]
            }));
          }
        } else {
          if (res.status === 404) saveFailureCache(asset.id, 'Not Found');
          if (res.status === 429) throw { category: ErrorCategory.RATE_LIMIT, provider: 'coingecko' };
        }
      });

    } else if ((asset.type === AssetType.STOCK || asset.type === AssetType.FUND)) {

      let querySymbol = asset.symbol;
      if (asset.currency === Currency.HKD && !querySymbol.includes('.')) querySymbol = `${querySymbol}.HK`;
      else if (asset.currency === Currency.CNY && !querySymbol.includes('.')) querySymbol = querySymbol.startsWith('6') ? `${querySymbol}.SS` : `${querySymbol}.SZ`;

      if (config.provider === 'finnhub' && config.finnhubKey) {
        // Finnhub Stock Candles
        const from = Math.floor(historyStartDate.getTime() / 1000);
        const to = Math.floor(Date.now() / 1000);

        await finnhubThrottler.add(async () => {
          const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${querySymbol}&resolution=D&from=${from}&to=${to}&token=${config.finnhubKey}`);

          if (res.ok) {
            const data = await res.json();
            if (data.s === "ok" && data.c && data.t) {
              history = data.t.map((timestamp: number, index: number) => ({
                date: new Date(timestamp * 1000).toISOString().split('T')[0],
                price: data.c[index]
              }));
            } else if (data.s === "no_data") {
              // No data available, use cache or fallback
              // Don't cache failure here, might just be no data for range
            } else if (data.error) {
              saveFailureCache(asset.id, data.error);
              throw {
                category: ErrorCategory.ACCESS_DENIED,
                provider: 'finnhub',
                message: data.error
              } as MarketDataError;
            }
          } else if (res.status === 429) {
            throw {
              category: ErrorCategory.RATE_LIMIT,
              provider: 'finnhub',
              message: 'Finnhub rate limit exceeded (History)'
            } as MarketDataError;
          } else if (res.status === 403 || res.status === 401) {
            saveFailureCache(asset.id, 'Access Denied');
            throw {
              category: ErrorCategory.ACCESS_DENIED,
              provider: 'finnhub',
              message: 'Access denied to historical data'
            } as MarketDataError;
          }
        });
      } else if (config.provider === 'alphavantage' && config.alphaVantageKey) {
        // Alpha Vantage Time Series Daily
        // Use 'compact' to avoid premium error (full is premium for daily series)
        const outputSize = 'compact';

        await avThrottler.add(async () => {
          const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${querySymbol}&outputsize=${outputSize}&apikey=${config.alphaVantageKey}`);
          const data = await res.json();

          if (data['Note'] || data['Information']) {
            throw {
              category: ErrorCategory.RATE_LIMIT,
              provider: 'alphavantage',
              message: 'Alpha Vantage rate limit exceeded (History)'
            } as MarketDataError;
          }

          if (data['Error Message']) {
            saveFailureCache(asset.id, 'Invalid Symbol');
            throw {
              category: ErrorCategory.ACCESS_DENIED,
              provider: 'alphavantage',
              message: 'Invalid API key or symbol not found'
            } as MarketDataError;
          }

          if (data['Time Series (Daily)']) {
            const series = data['Time Series (Daily)'];
            history = Object.keys(series).map(date => ({
              date: date,
              price: parseFloat(series[date]['4. close'])
            })).sort((a, b) => a.date.localeCompare(b.date)); // Sort ascending
          }
        });
      }
    }

    // Filter history to save space (truncate data older than historyStartDate)
    // But keep at least one point before historyStartDate if possible, to establish initial price
    if (history.length > 0) {
      const startDateStr = historyStartDate.toISOString().split('T')[0];
      const filteredHistory = history.filter(p => p.date >= startDateStr);

      // If we filtered everything out (e.g. historyStartDate is today), keep at least the last point
      // Or if we cut off the start, maybe keep the point immediately preceding historyStartDate?
      // For simplicity, just use the filtered list. If empty, fallback logic below handles it.
      // Actually, if filteredHistory is empty but history wasn't, we should keep the last known point.

      let finalHistory = filteredHistory;
      if (finalHistory.length === 0 && history.length > 0) {
        finalHistory = [history[history.length - 1]];
      } else if (finalHistory.length > 0 && finalHistory[0].date > startDateStr) {
        // Try to find the point just before
        const firstIndex = history.findIndex(p => p.date === finalHistory[0].date);
        if (firstIndex > 0) {
          finalHistory.unshift(history[firstIndex - 1]);
        }
      }

      history = finalHistory;
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

  } catch (e: any) {
    console.warn(`Failed to fetch history for ${asset.symbol}`, e);

    // Rethrow specific market data errors to let the UI handle them
    if (e?.category === ErrorCategory.ACCESS_DENIED || e?.category === ErrorCategory.RATE_LIMIT) {
      throw e;
    }

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
