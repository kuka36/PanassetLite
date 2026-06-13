import { MarketDataProvider } from './store';

export enum ErrorCategory {
    API_KEY_MISSING = 'API_KEY_MISSING',
    API_KEY_INVALID = 'API_KEY_INVALID',
    RATE_LIMIT = 'RATE_LIMIT',
    ACCESS_DENIED = 'ACCESS_DENIED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    UNKNOWN = 'UNKNOWN'
}

export interface MarketDataError {
    category: ErrorCategory;
    provider: MarketDataProvider;
    message: string;
    suggestion?: string;
}
