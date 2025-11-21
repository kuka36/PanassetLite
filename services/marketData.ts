import { Asset, AssetType, Currency } from '../types';

const ALPHA_VANTAGE_KEY = 'R855D2A1KSKT0CUS'; // Provided Key
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

// Cache Keys
const CACHE_RATES_KEY = 'investflow_rates';
const CACHE_CRYPTO_KEY = 'investflow_crypto_prices';
const CACHE_STOCKS_KEY = 'investflow_stock_prices';

// Cache Duration (ms)
// Rates: 24 hours (Currencies are relatively stable per day for general estimation)
const RATES_TTL = 24 * 3600 * 1000; 
// Crypto: 10 minutes (Volatile, but we want to save API calls)
const CRYPTO_TTL = 10 * 60 * 1000; 
// Stocks: 60 minutes (To respect Alpha Vantage limits)
const STOCK_TTL = 60 * 60 * 1000;

// Simple Crypto Mapping (Symbol -> CoinGecko ID)
const CRYPTO_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot'
};

export interface ExchangeRates {
  [key: string]: number; // USD relative rates (e.g., USD: 1, CNY: 7.2)
}

export interface StockPriceResult {
  price: number;
  currency: Currency;
  lastUpdated?: number;
}

// --- Helper: Detect Currency from Symbol ---
export const detectCurrencyFromSymbol = (symbol: string): Currency => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('.SS') || upper.endsWith('.SZ')) {
    return Currency.CNY;
  }
  if (upper.endsWith('.HK')) {
    return Currency.HKD;
  }
  // Default to USD for US stocks (no suffix) or others
  return Currency.USD;
};

// --- Helper: Cache Wrapper ---
const getFromCache = <T>(key: string, ttl: number): { data: T | null, isStale: boolean } => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return { data: null, isStale: true };
    
    const { timestamp, data } = JSON.parse(cached);
    const isStale = (Date.now() - timestamp) > ttl;
    
    return { data, isStale };
  } catch (e) {
    return { data: null, isStale: true };
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
  const { data: cachedRates, isStale } = getFromCache<ExchangeRates>(CACHE_RATES_KEY, RATES_TTL);
  
  // Return cached if fresh
  if (cachedRates && !isStale) {
    return cachedRates;
  }

  try {
    const res = await fetch(EXCHANGE_RATE_API);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    const rates = data.rates;
    
    saveToCache(CACHE_RATES_KEY, rates);
    return rates;
  } catch (error) {
    console.warn("Failed to fetch exchange rates, using fallback/cache", error);
    // Return stale cache if available, otherwise default
    return cachedRates || { USD: 1, CNY: 7.2, HKD: 7.8 };
  }
};

// --- 2. Crypto Prices (CoinGecko) ---

export const fetchCryptoPrices = async (assets: Asset[]): Promise<Record<string, number>> => {
  const cryptoAssets = assets.filter(a => a.type === AssetType.CRYPTO);
  if (cryptoAssets.length === 0) return {};

  const { data: cachedPrices, isStale } = getFromCache<Record<string, number>>(CACHE_CRYPTO_KEY, CRYPTO_TTL);

  // If we have cached data and it's fresh enough, use it to save API calls
  if (cachedPrices && !isStale) {
    // Check if we have all assets covered
    const allCovered = cryptoAssets.every(a => cachedPrices[a.id] !== undefined);
    if (allCovered) return cachedPrices;
  }

  const ids = cryptoAssets
    .map(a => CRYPTO_MAP[a.symbol.toUpperCase()] || a.name.toLowerCase())
    .join(',');

  if (!ids) return cachedPrices || {};

  try {
    const res = await fetch(`${COINGECKO_API}?ids=${ids}&vs_currencies=usd`);
    if (!res.ok) throw new Error("CoinGecko API Error");
    const data = await res.json();
    
    const newPriceMap: Record<string, number> = { ...(cachedPrices || {}) };
    
    cryptoAssets.forEach(asset => {
      const id = CRYPTO_MAP[asset.symbol.toUpperCase()] || asset.name.toLowerCase();
      if (data[id] && data[id].usd) {
        newPriceMap[asset.id] = data[id].usd;
      }
    });

    saveToCache(CACHE_CRYPTO_KEY, newPriceMap);
    return newPriceMap;
  } catch (error) {
    console.warn("CoinGecko API Limit or Error, using cache", error);
    return cachedPrices || {};
  }
};

// --- 3. Stock Prices (Alpha Vantage) ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchStockPrices = async (assets: Asset[]): Promise<Record<string, StockPriceResult>> => {
  const stockAssets = assets.filter(a => a.type === AssetType.STOCK || a.type === AssetType.FUND);
  if (stockAssets.length === 0) return {};

  // Load entire stock cache
  const { data: fullCache } = getFromCache<Record<string, StockPriceResult>>(CACHE_STOCKS_KEY, STOCK_TTL); // TTL check handled manually per item
  const priceMap: Record<string, StockPriceResult> = { ...(fullCache || {}) };
  
  const assetsToFetch: Asset[] = [];
  const now = Date.now();

  // Filter which assets actually NEED fetching
  for (const asset of stockAssets) {
    const cachedItem = priceMap[asset.id];
    // If exists and less than STOCK_TTL old, skip fetch
    if (cachedItem && cachedItem.lastUpdated && (now - cachedItem.lastUpdated < STOCK_TTL)) {
      continue;
    }
    assetsToFetch.push(asset);
  }

  // Limit to 3 per batch to respect rate limits
  const limitedQueue = assetsToFetch.slice(0, 3);
  let dataUpdated = false;

  for (const asset of limitedQueue) {
    try {
      let querySymbol = asset.symbol; 
      if (asset.currency === Currency.HKD && !querySymbol.includes('.')) {
          querySymbol = `${querySymbol}.HK`;
      }

      const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${querySymbol}&apikey=${ALPHA_VANTAGE_KEY}`);
      const data = await res.json();

      if (data['Global Quote'] && data['Global Quote']['05. price']) {
        const price = parseFloat(data['Global Quote']['05. price']);
        const detectedCurrency = detectCurrencyFromSymbol(data['Global Quote']['01. symbol'] || querySymbol);

        priceMap[asset.id] = {
          price,
          currency: detectedCurrency,
          lastUpdated: Date.now()
        };
        dataUpdated = true;
      } else if (data['Note'] || data['Information']) {
          console.warn("Alpha Vantage Rate Limit reached:", data['Note'] || data['Information']);
          break; 
      }

      await delay(12000); // Rate limit delay
    } catch (e) {
      console.error(`Failed to fetch stock ${asset.symbol}`, e);
    }
  }

  if (dataUpdated) {
    // We manually use localStorage directly here because our custom `saveToCache` overwrites timestamp for the whole object,
    // but here we have individual timestamps inside the object. 
    // Actually, `saveToCache` timestamp is for the whole blob, but we rely on `lastUpdated` inside `StockPriceResult`.
    // So using `saveToCache` is fine as a container.
    saveToCache(CACHE_STOCKS_KEY, priceMap);
  }

  return priceMap;
};

/**
 * Converts a value from an Asset's currency to the Base Currency
 */
export const convertValue = (
  value: number, 
  fromCurrency: Currency, 
  toBase: Currency, 
  rates: ExchangeRates
): number => {
  if (fromCurrency === toBase) return value;
  
  // Rates are USD based. 
  const rateFrom = rates[fromCurrency] || 1;
  const rateTo = rates[toBase] || 1;

  if (rateFrom === 0) return value;

  return (value / rateFrom) * rateTo;
};