import { AssetMetadata, AssetType, Currency } from '../../types/domain';
import { ErrorCategory, MarketDataError } from '../../types/api';
import { StorageService } from '../StorageService';
import {
  CACHE_STOCKS_KEY,
  KNOWN_MANUAL_SYMBOLS,
  STOCK_TTL,
  delay
} from './constants';
import { detectCurrencyFromSymbol } from './convert';
import { MarketDataConfig, StockPriceResult } from './types';

export const fetchStockPrices = async (
  assets: AssetMetadata[],
  config: MarketDataConfig
): Promise<Record<string, StockPriceResult>> => {
  const stockAssets = assets.filter(a =>
    (a.type === AssetType.STOCK || a.type === AssetType.FUND) &&
    !a.isManualPrice &&
    !KNOWN_MANUAL_SYMBOLS.includes(a.symbol)
  );
  if (stockAssets.length === 0) return {};

  const cached = StorageService.getCache<Record<string, StockPriceResult>>(CACHE_STOCKS_KEY);
  const priceMap: Record<string, StockPriceResult> = { ...(cached?.data || {}) };

  const now = Date.now();
  const assetsToFetch: AssetMetadata[] = [];

  for (const asset of stockAssets) {
    const cachedItem = priceMap[asset.id];
    const ttl = config.provider === 'alphavantage' ? STOCK_TTL : 10 * 60 * 1000;

    if (!cachedItem || !cachedItem.lastUpdated || (now - cachedItem.lastUpdated > ttl)) {
      assetsToFetch.push(asset);
    }
  }

  if (assetsToFetch.length === 0) return priceMap;

  let dataUpdated = false;

  if (config.provider === 'finnhub') {
    if (!config.finnhubKey) {
      throw {
        category: ErrorCategory.API_KEY_MISSING,
        provider: 'finnhub',
        message: 'Finnhub API Key is missing'
      } as MarketDataError;
    }
    const queue = assetsToFetch.slice(0, 10);
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
    if (!config.alphaVantageKey) {
      throw {
        category: ErrorCategory.API_KEY_MISSING,
        provider: 'alphavantage',
        message: 'Alpha Vantage API Key is missing'
      } as MarketDataError;
    }
    const queue = assetsToFetch.slice(0, 5);
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
        if (queue.length > 1) await delay(15000);
      } catch (e) { console.warn(`Alpha Vantage fetch failed for ${asset.symbol}`, e); }
    }
  }

  if (dataUpdated) {
    StorageService.saveCache(CACHE_STOCKS_KEY, priceMap);
  }

  return priceMap;
};
