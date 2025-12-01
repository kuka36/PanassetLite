import { StorageService } from '../StorageService';
import { CACHE_FAILURES_KEY, FAILURE_TTL } from './constants';
import { FailureRecord } from './types';

export const checkFailureCache = (assetId: string): FailureRecord | null => {
  const cache = StorageService.getCache<Record<string, FailureRecord>>(CACHE_FAILURES_KEY);
  if (!cache || !cache.data) return null;

  const record = cache.data[assetId];
  if (record && (Date.now() - record.timestamp < FAILURE_TTL)) {
    return record;
  }
  return null;
};

export const saveFailureCache = (assetId: string, reason: string) => {
  const cache = StorageService.getCache<Record<string, FailureRecord>>(CACHE_FAILURES_KEY);
  const data = cache?.data || {};
  data[assetId] = { timestamp: Date.now(), reason };
  StorageService.saveCache(CACHE_FAILURES_KEY, data);
};
