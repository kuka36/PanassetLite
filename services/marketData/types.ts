import { Currency } from '../../types/domain';
import { MarketDataProvider } from '../../types/store';

export interface StockPriceResult {
  price: number;
  currency: Currency;
  lastUpdated?: number;
}

export interface HistoricalDataPoint {
  date: string; // YYYY-MM-DD
  price: number;
}

export interface MarketDataConfig {
  provider: MarketDataProvider;
  alphaVantageKey: string;
  finnhubKey: string;
}

export interface FailureRecord {
  timestamp: number;
  reason: string;
}
