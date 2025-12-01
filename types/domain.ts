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
    isManualPrice?: boolean; // If true, do not fetch market data
    tags?: string[]; // Asset Tags for organization
}

/**
 * A Transaction is an immutable, source-of-truth event in the portfolio ledger.
 *
 * --- Field semantics ---
 *
 * `quantityChange`: SIGNED change in asset units caused by this event.
 *   Convention (set by the caller, NOT inferred from `type`):
 *     BUY / DEPOSIT / BORROW / positive DIVIDEND => positive
 *     SELL / WITHDRAWAL / REPAY                  => negative
 *     BALANCE_ADJUSTMENT                         => either sign
 *
 * `total`: UNSIGNED notional cash value of this event, always >= 0.
 *   This is what changed hands (or was credited) at execution time:
 *     BUY        => cash paid out (≈ |qty| * price + fee)
 *     SELL       => cash proceeds received (≈ |qty| * price - fee, per caller convention)
 *     DEPOSIT    => cash added (cost basis increase)
 *     WITHDRAWAL => cash removed
 *     BORROW     => liability incurred (treated like a cost basis)
 *     REPAY      => principal repaid
 *     DIVIDEND   => cash dividend received (added directly to realized PnL)
 *     BALANCE_ADJUSTMENT => informational only; engine does NOT use it to mutate
 *                           cost basis. Adjustment changes quantity but inherits
 *                           the asset's existing avgCost.
 *
 *   Direction (in vs. out) is determined by `type`, not by the sign of `total`.
 *   Use `getCashFlow(tx)` from `utils/transactionUtils.ts` if you need a SIGNED
 *   cash flow (negative = outflow, positive = inflow).
 *
 * `pricePerUnit`: Price at execution time. For pure cashflow events with no
 *   unit (DEPOSIT/WITHDRAWAL of base currency), this may equal 1.
 *
 * `fee`: Always >= 0. Whether `total` already includes or excludes the fee is
 *   the caller's responsibility — the engine treats `total` as the final
 *   cash impact.
 */
export interface Transaction {
    id: string;
    assetId: string;
    type: TransactionType;
    /** ISO 8601 DateTime, e.g. `YYYY-MM-DDTHH:mm:ss` */
    date: string;
    quantityChange: number;
    pricePerUnit: number;
    fee: number;
    total: number;
    note?: string;
}

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

export interface PerformanceMetrics {
    cumulative: number | null;
    sinceLastSync?: number | null;
    lastPeriod?: number | null;
}
