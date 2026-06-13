import { AssetMetadata, AssetType } from '../../types/domain';
import { StorageService } from '../StorageService';
import {
  CACHE_CRYPTO_KEY,
  COINGECKO_API,
  CRYPTO_MAP,
  CRYPTO_TTL,
  KNOWN_MANUAL_SYMBOLS
} from './constants';

let cryptoPromise: Promise<Record<string, number>> | null = null;
let lastCryptoIds: string = '';

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
    .sort()
    .join(',');

  if (!ids) return cached?.data || {};

  if (cryptoPromise && lastCryptoIds === ids) return cryptoPromise;

  lastCryptoIds = ids;
  cryptoPromise = (async () => {
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
    } finally {
      cryptoPromise = null;
    }
  })();

  return cryptoPromise;
};
