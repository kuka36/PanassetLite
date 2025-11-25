

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

// Enhanced Transaction Types
export enum TransactionType {
  // Market Actions
  BUY = 'BUY',           
  SELL = 'SELL',         
  DIVIDEND = 'DIVIDEND', 
  
  // Cash/Flow Actions
  DEPOSIT = 'DEPOSIT',       
  WITHDRAWAL = 'WITHDRAWAL', 
  
  // Liability Actions
  BORROW = 'BORROW',    // Increase Liability
  REPAY = 'REPAY',      // Decrease Liability
  
  // Corrections
  BALANCE_ADJUSTMENT = 'BALANCE_ADJUSTMENT' 
}

// 1. Static Metadata (Stored in DB/LocalStorage)
export interface AssetMetadata {
  id: string;
  symbol: string; 
  name: string;
  type: AssetType;
  currency: Currency;
  currentPrice: number; // Latest known market price (API or Manual)
  lastUpdated?: number; 
  dateAcquired?: string; // Display purpose only (ISO DateTime)
  isDeleted?: boolean;
}

// 2. The Source of Truth (Stored in DB/LocalStorage)
export interface Transaction {
  id: string;
  assetId: string;
  type: TransactionType;
  date: string;         // ISO 8601 DateTime (YYYY-MM-DDTHH:mm:ss)
  quantityChange: number; // Signed value: Buy (+), Sell (-), Borrow (+), Repay (-)
  pricePerUnit: number;   // Price at the time of transaction
  fee: number;
  total: number;          // Cash flow impact (derived or explicit)
  note?: string;
}

// 3. Computed View (Used by UI, derived from 1 & 2)
// This interface matches the old 'Asset' interface to minimize UI refactoring
export interface Asset extends AssetMetadata {
  quantity: number;       // Computed: Sum(quantityChange)
  avgCost: number;        // Computed: Weighted Average Cost
  totalCost: number;      // Computed: quantity * avgCost
  
  // UI Helpers
  currentValue: number;   // quantity * currentPrice
  pnl: number;            // Unrealized PnL
  pnlPercent: number;
  realizedPnL: number;    // Profit locked in from Sells
}

export interface PortfolioSummary {
  totalBalance: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayPnL: number; 
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

export type ActionType = 
  | 'ADD_ASSET' 
  | 'UPDATE_ASSET' 
  | 'DELETE_ASSET' 
  | 'ADD_TRANSACTION' 
  | 'UPDATE_TRANSACTION' 
  | 'DELETE_TRANSACTION';

export interface PendingAction {
  type: ActionType;
  targetId?: string; // For Update/Delete operations
  data: {
    symbol?: string;
    name?: string;
    quantity?: number;
    price?: number; // Current Price or Unit Price
    fee?: number;
    type?: AssetType | TransactionType;
    date?: string;
    assetId?: string; // For Transactions
  };
  summary: string; // Human readable summary
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  pendingAction?: PendingAction; // If the bot proposes an action
  isError?: boolean;
  image?: string; // Base64 encoded image
}