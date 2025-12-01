import { AssetType, Currency, TransactionType } from './domain';

export type Language = 'en' | 'zh';
export type AIProvider = 'gemini' | 'deepseek' | 'qwen';

export enum EntryMode {
    SIMPLE = 'SIMPLE',
    TRANSACTION = 'TRANSACTION'
}

export type ActionType =
    | 'ADD_ASSET'
    | 'UPDATE_ASSET'
    | 'DELETE_ASSET'
    | 'ADD_TRANSACTION'
    | 'UPDATE_TRANSACTION'
    | 'DELETE_TRANSACTION'
    | 'BULK_ASSET_UPDATE' // Added for bulk image processing
    | 'BATCH_DELETE_ASSET'; // Added for batch deletion

export interface BulkAssetItem {
    id?: string;
    symbol?: string;
    name?: string;
    quantity?: number | string;
    /** Legacy alias for `currentPrice`. Kept so older agent outputs still parse. */
    price?: number | string;
    currentPrice?: number | string;
    avgCost?: number | string;
    assetType?: AssetType;
    currency?: Currency;
    dateAcquired?: string;
}

/**
 * Structured payload an AI agent attaches to a `PendingAction`.
 * All fields are optional — the executor narrows by `PendingAction.type`
 * and reads only the fields meaningful for that action.
 *
 * `type` is `AssetType | TransactionType` because both kinds of action
 * share this payload shape; the outer `PendingAction.type` is what
 * disambiguates which sub-type applies.
 */
export interface PendingActionData {
    // --- Asset-ish fields ---
    symbol?: string;
    name?: string;
    /** Asset or transaction subtype, depending on outer action. */
    type?: AssetType | TransactionType;
    currency?: Currency;
    /** Current price (asset) or unit price (transaction). */
    price?: number;
    /** Initial cost basis for ADD_ASSET. */
    cost?: number;

    // --- Quantity / fee / time ---
    quantity?: number;
    fee?: number;
    date?: string;

    // --- Transaction reference ---
    assetId?: string;
}

export interface PendingAction {
    type: ActionType;
    /** Target asset/transaction id for UPDATE_* / DELETE_* variants. */
    targetId?: string;
    data: PendingActionData;
    /** Used by BULK_ASSET_UPDATE / BATCH_DELETE_ASSET to carry many items. */
    items?: BulkAssetItem[];
    /** Human-readable summary shown in chat. */
    summary: string;
    /** Lifecycle state for the chat UI. Undefined == 'pending'. */
    status?: 'pending' | 'executed';
}

export interface ExchangeRates {
    [key: string]: number;
}

export type MarketDataProvider = 'alphavantage' | 'finnhub';

export interface AppSettings {
    baseCurrency: Currency;
    isPrivacyMode: boolean;
    geminiApiKey: string;
    deepSeekApiKey: string;
    qwenApiKey: string;
    aiProvider: AIProvider;
    marketDataProvider: MarketDataProvider;
    alphaVantageApiKey: string;
    finnhubApiKey: string;
    language: Language;
}
