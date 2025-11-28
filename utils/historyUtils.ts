import { AssetMetadata, Transaction } from '../types';

/**
 * Calculate the optimal start date for fetching historical data.
 * 
 * Priority chain:
 * 1. Earliest transaction date for the specific asset (most accurate)
 * 2. Asset's dateAcquired field (fallback)
 * 3. 5 years ago (default fallback)
 * 
 * @param assetId - The ID of the asset
 * @param dateAcquired - Optional acquisition date from asset metadata
 * @param transactions - Array of all transactions
 * @returns Date object representing the start date for history fetching
 */
export function calculateHistoryStartDate(
    assetId: string,
    dateAcquired: string | undefined,
    transactions: Pick<Transaction, 'assetId' | 'date'>[]
): Date {
    // Priority 1: Earliest transaction for this specific asset
    const assetTransactions = transactions.filter(tx => tx.assetId === assetId);
    if (assetTransactions.length > 0) {
        const earliestTx = assetTransactions.reduce((earliest, tx) =>
            tx.date < earliest.date ? tx : earliest
        );
        const date = new Date(earliestTx.date);
        // Add a 7-day buffer before the first transaction to ensure we have a starting price
        date.setDate(date.getDate() - 7);
        return date;
    }

    // Priority 2: Use dateAcquired from asset metadata
    if (dateAcquired) {
        const date = new Date(dateAcquired);
        // Add a 7-day buffer before acquisition to ensure we have a starting price
        date.setDate(date.getDate() - 7);
        return date;
    }

    // Priority 3: Default to 5 years ago
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
}

/**
 * Calculate the number of days between a start date and now.
 * 
 * @param startDate - The start date
 * @returns Number of days since the start date
 */
export function calculateRequiredHistoryDays(startDate: Date): number {
    return (Date.now() - startDate.getTime()) / (1000 * 3600 * 24);
}

/**
 * Determine the appropriate output size parameter for Alpha Vantage API.
 * 
 * @param daysSinceStart - Number of days of history needed
 * @returns 'full' for > 90 days, 'compact' otherwise
 */
export function getStockOutputSize(daysSinceStart: number): 'full' | 'compact' {
    return daysSinceStart > 90 ? 'full' : 'compact';
}

/**
 * Determine the appropriate days parameter for CoinGecko API.
 * 
 * @param daysSinceStart - Number of days of history needed
 * @returns 'max' for > 365 days, '365' otherwise
 */
export function getCryptoDaysParam(daysSinceStart: number): 'max' | '365' {
    return daysSinceStart > 365 ? 'max' : '365';
}
