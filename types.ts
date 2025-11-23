
export enum AssetType {
  STOCK = 'STOCK',
  CRYPTO = 'CRYPTO',
  FUND = 'FUND',
  CASH = 'CASH',
  REAL_ESTATE = 'REAL_ESTATE',
  LIABILITY = 'LIABILITY',
  OTHER = 'OTHER'
}

export enum Currency {
  USD = 'USD',
  CNY = 'CNY',
  HKD = 'HKD'
}

export type Language = 'en' | 'zh';
export type AIProvider = 'gemini' | 'deepseek';

export enum EntryMode {
  SIMPLE = 'SIMPLE',
  TRANSACTION = 'TRANSACTION'
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND'
}

export interface Transaction {
  id: string;
  assetId: string;
  type: TransactionType;
  date: string;
  quantity: number;
  price: number;
  fee: number;
  total: number;
}

export interface Asset {
  id: string;
  symbol: string; // e.g., AAPL, BTC, or "Apt 4B"
  name: string;
  type: AssetType;
  quantity: number;
  avgCost: number; // Weighted average cost
  currentPrice: number; // Mocked live price OR Manual Valuation
  currency: Currency;
  lastUpdated?: number; // Timestamp of last price update
  dateAcquired?: string; // Start date of holding (for simple mode)
  // Computed fields for UI convenience
  currentValue?: number;
  totalCost?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface PortfolioSummary {
  totalBalance: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayPnL: number; // Mocked for demo
  dayPnLPercent: number;
}

export interface VoiceParseResult {
  symbol?: string;      
  name?: string;
  type?: AssetType;     
  txType?: TransactionType;
  quantity?: number;
  price?: number;
  date?: string;        
  currency?: Currency;
}

// --- Chat & Agent Types ---

export interface PendingAction {
  type: 'ADD_ASSET' | 'ADD_TRANSACTION';
  data: {
    symbol: string;
    quantity: number;
    price: number;
    type: AssetType | TransactionType;
  };
  summary: string; // Human readable summary like "Buy 10 AAPL at $150"
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  pendingAction?: PendingAction; // If the bot proposes an action
  isError?: boolean;
}
