import { AssetMetadata, Transaction } from '../types/domain';
import { AppSettings } from '../types/store';
import { ChatMessage } from '../types/ui';

// Storage Keys
const KEY_METADATA = 'panasset_metadata';
const KEY_TRANSACTIONS = 'panasset_transactions_v2';
const KEY_SETTINGS = 'panasset_settings';
const KEY_SIDEBAR_COLLAPSED = 'panasset_sidebar_collapsed';
const KEY_SCHEMA_VERSION = 'panasset_schema_version';

// Cache Keys
const KEY_RATES = 'panasset_rates';
const KEY_CRYPTO = 'panasset_crypto_prices';
const KEY_STOCKS = 'panasset_stock_prices';
const KEY_HISTORY_PREFIX = 'panasset_asset_history';
const KEY_FAILURES = 'panasset_api_failures';
const KEY_RISK_CACHE = 'panasset_risk_cache';
const KEY_ADVISOR_CACHE = 'panasset_advisor_cache';

// Legacy Keys
const KEY_LEGACY_ASSETS = 'investflow_assets';
const KEY_LEGACY_TRANSACTIONS = 'investflow_transactions';

// Panasset specific
const KEY_CHAT_HISTORY = 'panasset_chat_history';
const KEY_CHAT_DIM = 'panasset_chat_dim';
const KEY_MY_TAGS = 'panasset_my_tags';
const KEY_RECENT_TAGS = 'panasset_recent_tags';
const KEY_SELECTED_TAG = 'panasset_selected_tag';

export interface CacheItem<T> {
    timestamp: number;
    data: T;
}

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

    getSelectedTag(): string | null {
        return localStorage.getItem(KEY_SELECTED_TAG);
    },

    saveSelectedTag(tag: string | null): void {
        if (tag) {
            localStorage.setItem(KEY_SELECTED_TAG, tag);
        } else {
            localStorage.removeItem(KEY_SELECTED_TAG);
        }
    },

    // --- Schema Version ---

    getSchemaVersion(): number {
        const raw = localStorage.getItem(KEY_SCHEMA_VERSION);
        if (!raw) return 0;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : 0;
    },

    saveSchemaVersion(version: number): void {
        localStorage.setItem(KEY_SCHEMA_VERSION, String(version));
    },

    // --- UI State ---

    getSidebarCollapsed(): boolean {
        return localStorage.getItem(KEY_SIDEBAR_COLLAPSED) === 'true';
    },

    saveSidebarCollapsed(collapsed: boolean): void {
        localStorage.setItem(KEY_SIDEBAR_COLLAPSED, String(collapsed));
    },

    // --- Tags ---

    getMyTags(): string[] {
        try {
            return JSON.parse(localStorage.getItem(KEY_MY_TAGS) || '[]');
        } catch { return []; }
    },

    saveMyTags(tags: string[]): void {
        localStorage.setItem(KEY_MY_TAGS, JSON.stringify(tags));
    },

    getRecentTags(): string[] {
        try {
            return JSON.parse(localStorage.getItem(KEY_RECENT_TAGS) || '[]');
        } catch { return []; }
    },

    saveRecentTags(tags: string[]): void {
        localStorage.setItem(KEY_RECENT_TAGS, JSON.stringify(tags));
    },

    // --- Chat History ---

    getChatHistory(): ChatMessage[] | null {
        try {
            const json = localStorage.getItem(KEY_CHAT_HISTORY);
            return json ? JSON.parse(json) : null;
        } catch { return null; }
    },

    saveChatHistory(messages: ChatMessage[]): void {
        localStorage.setItem(KEY_CHAT_HISTORY, JSON.stringify(messages));
    },

    clearChatHistory(): void {
        localStorage.removeItem(KEY_CHAT_HISTORY);
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

    /**
     * Clears all user data, caches, and history.
     * Intentionally keeps KEY_SETTINGS to preserve API keys and app preferences.
     */
    clearAllData(): void {
        // Core Data
        localStorage.removeItem(KEY_METADATA);
        localStorage.removeItem(KEY_TRANSACTIONS);
        localStorage.removeItem(KEY_LEGACY_ASSETS);
        localStorage.removeItem(KEY_LEGACY_TRANSACTIONS);

        // Caches & Logs
        localStorage.removeItem(KEY_RATES);
        localStorage.removeItem(KEY_CRYPTO);
        localStorage.removeItem(KEY_STOCKS);
        localStorage.removeItem(KEY_FAILURES);
        localStorage.removeItem(KEY_RISK_CACHE);
        localStorage.removeItem(KEY_ADVISOR_CACHE);
        this.clearItemsByPrefix(KEY_HISTORY_PREFIX);

        // Panasset specific (Chat, Tags)
        localStorage.removeItem(KEY_CHAT_HISTORY);
        localStorage.removeItem(KEY_CHAT_DIM);
        localStorage.removeItem(KEY_MY_TAGS);
        localStorage.removeItem(KEY_RECENT_TAGS);

        // UI State
        localStorage.removeItem(KEY_SIDEBAR_COLLAPSED);
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
