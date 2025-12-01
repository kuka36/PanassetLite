import { Transaction, TransactionType } from '../types/domain';

/**
 * Direction of cash relative to the portfolio holder.
 *   IN  = cash arrives (proceeds, dividend, borrowing)
 *   OUT = cash leaves (buy, withdrawal, fee paid, repayment)
 *   NEUTRAL = no cash movement attached (balance adjustment)
 */
export type CashFlowDirection = 'IN' | 'OUT' | 'NEUTRAL';

export const cashFlowDirection = (type: TransactionType): CashFlowDirection => {
    switch (type) {
        case TransactionType.BUY:
        case TransactionType.WITHDRAWAL:
        case TransactionType.REPAY:
            return 'OUT';
        case TransactionType.SELL:
        case TransactionType.DEPOSIT:
        case TransactionType.BORROW:
        case TransactionType.DIVIDEND:
            return 'IN';
        case TransactionType.BALANCE_ADJUSTMENT:
            return 'NEUTRAL';
    }
};

/**
 * Signed cash flow for a transaction.
 *   Positive = cash inflow to the holder
 *   Negative = cash outflow
 *   Zero     = no cash movement (e.g. BALANCE_ADJUSTMENT)
 *
 * Magnitude is `tx.total` (always >= 0); sign comes from `type` via
 * `cashFlowDirection`. Use this whenever you need a unified ledger view
 * rather than `tx.total` alone.
 */
export const getCashFlow = (tx: Transaction): number => {
    const dir = cashFlowDirection(tx.type);
    if (dir === 'NEUTRAL') return 0;
    const abs = Math.abs(tx.total) || 0;
    return dir === 'IN' ? abs : -abs;
};
