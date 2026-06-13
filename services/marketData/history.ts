import { AssetMetadata, AssetType, Currency } from '../../types/domain';
import { ErrorCategory, MarketDataError } from '../../types/api';
import { StorageService } from '../StorageService';
import {
  CACHE_HISTORY_KEY,
  COINGECKO_HISTORY_API,
  CRYPTO_MAP,
  HISTORY_TTL,
  KNOWN_MANUAL_SYMBOLS,
  avThrottler,
  cgThrottler,
  finnhubThrottler
} from './constants';
import { checkFailureCache, saveFailureCache } from './cache';
import { HistoricalDataPoint, MarketDataConfig } from './types';

export const fetchAssetHistory = async (
  asset: AssetMetadata,
  config: MarketDataConfig,
  startDate?: Date
): Promise<HistoricalDataPoint[]> => {
  const historyStartDate = startDate || (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
  })();

  const daysSinceStart = (Date.now() - historyStartDate.getTime()) / (1000 * 3600 * 24);

  if (asset.isManualPrice || KNOWN_MANUAL_SYMBOLS.includes(asset.symbol)) {
    const today = new Date().toISOString().split('T')[0];
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    return [
      { date: lastYear.toISOString().split('T')[0], price: asset.currentPrice },
      { date: today, price: asset.currentPrice }
    ];
  }

  const cacheKey = `${CACHE_HISTORY_KEY}_${asset.id}`;
  const cached = StorageService.getCache<HistoricalDataPoint[]>(cacheKey);

  const isStale = cached ? (Date.now() - cached.timestamp) > HISTORY_TTL : true;

  // If cached data looks like Alpha Vantage "compact" (~100 points) but we need
  // significantly longer history, treat as stale to force re-fetch.
  const isInsufficient = cached && cached.data.length >= 98 && cached.data.length <= 102 && daysSinceStart > 130;

  if (cached && cached.data.length > 0 && !isStale && !isInsufficient) {
    return cached.data;
  }

  const failure = checkFailureCache(asset.id);
  if (failure) {
    return cached?.data || [];
  }

  try {
    let history: HistoricalDataPoint[] = [];

    if (asset.type === AssetType.CRYPTO) {
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
        // 'compact' avoids premium-only "full" output for daily series.
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
            })).sort((a, b) => a.date.localeCompare(b.date));
          }
        });
      }
    }

    if (history.length > 0) {
      const startDateStr = historyStartDate.toISOString().split('T')[0];
      const filteredHistory = history.filter(p => p.date >= startDateStr);

      let finalHistory = filteredHistory;
      if (finalHistory.length === 0 && history.length > 0) {
        finalHistory = [history[history.length - 1]];
      } else if (finalHistory.length > 0 && finalHistory[0].date > startDateStr) {
        const firstIndex = history.findIndex(p => p.date === finalHistory[0].date);
        if (firstIndex > 0) {
          finalHistory.unshift(history[firstIndex - 1]);
        }
      }

      history = finalHistory;
    }

    if (history.length > 0) {
      StorageService.saveCache(cacheKey, history);
      return history;
    } else {
      if (cached?.data) return cached.data;

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

    if (e?.category === ErrorCategory.ACCESS_DENIED || e?.category === ErrorCategory.RATE_LIMIT) {
      throw e;
    }

    return cached?.data || [];
  }
};

export const clearAssetHistoryCache = (assetId: string) => {
  const cacheKey = `${CACHE_HISTORY_KEY}_${assetId}`;
  StorageService.remove(cacheKey);
};

export const clearAllHistoryCache = () => {
  StorageService.clearItemsByPrefix(CACHE_HISTORY_KEY);
};
