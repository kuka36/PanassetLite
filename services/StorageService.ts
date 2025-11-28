import { AssetMetadata, Transaction, AppSettings, ExchangeRates, Language, Currency } from '../types';

// Storage Keys
const KEY_METADATA = 'investflow_metadata';
const KEY_TRANSACTIONS = 'investflow_transactions_v2';
const KEY_SETTINGS = 'investflow_settings';

// Legacy Keys (for migration support if needed, though mostly handled in Context)
const KEY_LEGACY_ASSETS = 'investflow_assets';
const KEY_LEGACY_TRANSACTIONS = 'investflow_transactions';

export interface CacheItem<T> {
    timestamp: number;
    data: T;
}

const INITIAL_SETTINGS: AppSettings = {
    baseCurrency: Currency.USD,
    isPrivacyMode: false,
    geminiApiKey: '', // Will be populated from env in Context if empty, but storage just stores what's saved
    deepSeekApiKey: '',
    aiProvider: 'gemini',
    marketDataProvider: 'finnhub',
    alphaVantageApiKey: '',
    finnhubApiKey: '',
    language: 'en', // Default, will be overridden by browser detection in Context if needed
};

export const StorageService = {
    // --- Core Data ---

    getAssetMetas(): AssetMetadata[] {
        try {
            const json = localStorage.getItem(KEY_METADATA);
            return json ? JSON.parse(json) : [];
        } catch (e) {
            console.error('Failed to load asset metadata', e);
            return [];
        }
    },

    saveAssetMetas(metas: AssetMetadata[]): void {
        try {
            localStorage.setItem(KEY_METADATA, JSON.stringify(metas));
        } catch (e) {
            console.error('Failed to save asset metadata', e);
        }
    },

    getTransactions(): Transaction[] {
        try {
            const json = localStorage.getItem(KEY_TRANSACTIONS);
            return json ? JSON.parse(json) : [];
        } catch (e) {
            console.error('Failed to load transactions', e);
            return [];
        }
    },

    saveTransactions(txs: Transaction[]): void {
        try {
            localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(txs));
        } catch (e) {
            console.error('Failed to save transactions', e);
        }
    },

    getSettings(): Partial<AppSettings> | null {
        try {
            const json = localStorage.getItem(KEY_SETTINGS);
            return json ? JSON.parse(json) : null;
        } catch (e) {
            console.error('Failed to load settings', e);
            return null;
        }
    },

    saveSettings(settings: AppSettings): void {
        try {
            localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings', e);
        }
    },

    // --- Caching ---

    getCache<T>(key: string): CacheItem<T> | null {
        try {
            const json = localStorage.getItem(key);
            if (!json) return null;
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    },

    saveCache<T>(key: string, data: T): void {
        try {
            const item: CacheItem<T> = {
                timestamp: Date.now(),
                data
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {
            console.warn('Failed to save cache', e);
        }
    },

    remove(key: string): void {
        localStorage.removeItem(key);
    },

    clearAllData(): void {
        localStorage.removeItem(KEY_METADATA);
        localStorage.removeItem(KEY_TRANSACTIONS);
        // We might want to keep settings? For now, clear it as per original behavior
        // But usually "Clear Data" implies user data, not settings. 
        // The original code cleared metadata and transactions.
    },

    // --- Migration Helpers ---

    getLegacyData() {
        return {
            assets: localStorage.getItem(KEY_LEGACY_ASSETS),
            transactions: localStorage.getItem(KEY_LEGACY_TRANSACTIONS),
            v2Metadata: localStorage.getItem(KEY_METADATA)
        };
    },

    clearLegacyData() {
        localStorage.removeItem(KEY_LEGACY_ASSETS);
        localStorage.removeItem(KEY_LEGACY_TRANSACTIONS);
    },

    clearItemsByPrefix(prefix: string) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
};
