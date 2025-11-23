
import { Asset, AssetType, Currency } from '../types';

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';
const COINGECKO_HISTORY_API = 'https://api.coingecko.com/api/v3/coins';

// Cache Keys
const CACHE_RATES_KEY = 'investflow_rates';
const CACHE_CRYPTO_KEY = 'investflow_crypto_prices';
const CACHE_STOCKS_KEY = 'investflow_stock_prices';
const CACHE_HISTORY_KEY = 'investflow_asset_history';

// Cache Duration (ms)
const RATES_TTL = 24 * 3600 * 1000; 
const CRYPTO_TTL = 10 * 60 * 1000; 
const STOCK_TTL = 4 * 60 * 60 * 1000;
const HISTORY_TTL = 12 * 3600 * 1000; // 12 Hours for history

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

export interface ExchangeRates {
  [key: string]: number;
}

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

// --- Helper: Cache Access ---
const getFromCache = <T>(key: string): { data: T | null, timestamp: number } => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return { data: null, timestamp: 0 };
    const { timestamp, data } = JSON.parse(cached);
    return { data, timestamp };
  } catch (e) {
    return { data: null, timestamp: 0 };
  }
};

const saveToCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (e) {
    console.warn("Failed to save to localStorage", e);
  }
};

// --- 1. Exchange Rates ---
export const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  const { data: cachedRates, timestamp } = getFromCache<ExchangeRates>(CACHE_RATES_KEY);
  const isStale = (Date.now() - timestamp) > RATES_TTL;
  
  if (cachedRates && !isStale) return cachedRates;

  try {
    const res = await fetch(EXCHANGE_RATE_API);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    saveToCache(CACHE_RATES_KEY, data.rates);
    return data.rates;
  } catch (error) {
    console.warn("Exchange Rate API failed, using fallback cache", error);
    return cachedRates || { USD: 1, CNY: 7.2, HKD: 7.8 };
  }
};

// --- 2. Crypto Prices ---
export const fetchCryptoPrices = async (assets: Asset[]): Promise<Record<string, number>> => {
  const cryptoAssets = assets.filter(a => a.type === AssetType.CRYPTO);
  if (cryptoAssets.length === 0) return {};

  const { data: cachedPrices, timestamp } = getFromCache<Record<string, number>>(CACHE_CRYPTO_KEY);
  const isStale = (Date.now() - timestamp) > CRYPTO_TTL;

  if (cachedPrices && !isStale) {
    const allCovered = cryptoAssets.every(a => cachedPrices[a.id] !== undefined);
    if (allCovered) return cachedPrices;
  }

  const ids = cryptoAssets
    .map(a => CRYPTO_MAP[a.symbol.toUpperCase()] || a.name.toLowerCase().replace(/\s+/g, '-'))
    .join(',');

  if (!ids) return cachedPrices || {};

  try {
    const res = await fetch(`${COINGECKO_API}?ids=${ids}&vs_currencies=usd`);
    if (!res.ok) throw new Error("CoinGecko API Error");
    const data = await res.json();
    
    const newPriceMap: Record<string, number> = { ...(cachedPrices || {}) };
    cryptoAssets.forEach(asset => {
      const id = CRYPTO_MAP[asset.symbol.toUpperCase()] || asset.name.toLowerCase().replace(/\s+/g, '-');
      if (data[id] && data[id].usd) {
        newPriceMap[asset.id] = data[id].usd;
      }
    });

    saveToCache(CACHE_CRYPTO_KEY, newPriceMap);
    return newPriceMap;
  } catch (error) {
    console.warn("Crypto API failed, using stale cache", error);
    return cachedPrices || {};
  }
};

// --- 3. Stock Prices ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchStockPrices = async (assets: Asset[], apiKey?: string): Promise<Record<string, StockPriceResult>> => {
  const stockAssets = assets.filter(a => a.type === AssetType.STOCK || a.type === AssetType.FUND);
  if (stockAssets.length === 0) return {};

  const { data: cachedMap } = getFromCache<Record<string, StockPriceResult>>(CACHE_STOCKS_KEY);
  const priceMap: Record<string, StockPriceResult> = { ...(cachedMap || {}) };
  
  const now = Date.now();
  const assetsToFetch: Asset[] = [];

  for (const asset of stockAssets) {
    const cachedItem = priceMap[asset.id];
    if (!cachedItem || !cachedItem.lastUpdated || (now - cachedItem.lastUpdated > STOCK_TTL)) {
      assetsToFetch.push(asset);
    }
  }

  const limitedQueue = assetsToFetch.slice(0, 3);
  let dataUpdated = false;

  if (limitedQueue.length > 0 && !apiKey) {
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

      if (data['Note'] || data['Information']) {
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
      
      if (limitedQueue.length > 1) await delay(12000); 

    } catch (e) {
      // console.error(`Failed to fetch stock ${asset.symbol}`, e);
    }
  }

  if (dataUpdated) {
    saveToCache(CACHE_STOCKS_KEY, priceMap);
  }

  return priceMap;
};

// --- 4. Historical Data ---

export const fetchAssetHistory = async (asset: Asset, apiKey?: string): Promise<HistoricalDataPoint[]> => {
  // 1. Check Cache
  const cacheKey = `${CACHE_HISTORY_KEY}_${asset.id}`;
  const { data: cachedHistory, timestamp } = getFromCache<HistoricalDataPoint[]>(cacheKey);
  const isStale = (Date.now() - timestamp) > HISTORY_TTL;

  if (cachedHistory && cachedHistory.length > 0 && !isStale) {
    return cachedHistory;
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
      saveToCache(cacheKey, history);
      return history;
    } else {
       // If fetch fails or not supported (Cash/Manual), return a single point (Today) + Maybe one year ago same price
       // This ensures the chart has *some* line for manual assets
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
    return cachedHistory || [];
  }
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
