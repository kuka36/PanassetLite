
import { Asset, AssetMetadata, Transaction, TransactionType } from '../types/domain';

/**
 * The Portfolio Engine is the core domain logic implementation for PanassetLite.
 * It strictly follows Event Sourcing principles:
 * 1. State is derived solely from processing a stream of Transactions.
 * 2. Transactions are immutable facts (Source of Truth).
 */
export class PortfolioEngine {

    /**
     * Replays the history of transactions to calculate the current state of all assets.
     * @param metas - Static metadata for assets (Symbol, Name, Type, etc.)
     * @param transactions - Full history of all transactions
     * @returns Array of fully calculated Asset objects
     */
    public static calculatePortfolio(
        metas: AssetMetadata[],
        transactions: Transaction[]
    ): Asset[] {
        // 1. Initialize State Map
        const assetMap = this.initializeAssets(metas);

        // 2. Sort Transactions Chronologically
        // Event Sourcing requires strict ordering.
        const sortedTxs = [...transactions].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // 3. Replay Transactions (The "Projection")
        sortedTxs.forEach(tx => {
            const asset = assetMap.get(tx.assetId);
            if (!asset) {
                // Transaction refers to unknown asset, skip or log warning
                return;
            }
            this.applyTransaction(asset, tx);
        });

        // 4. Final Computations (Mark-to-Market)
        return Array.from(assetMap.values()).map(asset =>
            this.computeFinalMetrics(asset)
        );
    }

    /**
     * Creates the initial zero-state for all known assets.
     */
    private static initializeAssets(metas: AssetMetadata[]): Map<string, Asset> {
        const map = new Map<string, Asset>();
        metas.forEach(meta => {
            map.set(meta.id, {
                ...meta,
                quantity: 0,
                avgCost: 0,
                totalCost: 0,
                currentValue: 0,
                pnl: 0,
                pnlPercent: 0,
                realizedPnL: 0
            });
        });
        return map;
    }

    /**
     * ROUTES the transaction to the specific handler based on its type.
     * Mutates the asset state in place (Performance optimization for loop).
     */
    private static applyTransaction(asset: Asset, tx: Transaction): void {
        switch (tx.type) {
            case TransactionType.BUY:
            case TransactionType.DEPOSIT:
            case TransactionType.BORROW:
                this.handleIncreasePosition(asset, tx);
                break;

            case TransactionType.SELL:
            case TransactionType.WITHDRAWAL:
            case TransactionType.REPAY:
                this.handleDecreasePosition(asset, tx);
                break;

            case TransactionType.DIVIDEND:
                this.handleDividend(asset, tx);
                break;

            case TransactionType.BALANCE_ADJUSTMENT:
                this.handleBalanceAdjustment(asset, tx);
                break;

            default:
                console.warn(`Unknown transaction type: ${tx.type}`);
        }
    }

    /**
     * Handles events that increase the asset holding size.
     * Logic:
     * - Update Quantity
     * - Update Total Cost (Cost Basis)
     * - Recalculate Average Cost
     */
    private static handleIncreasePosition(asset: Asset, tx: Transaction): void {
        const txCost = tx.total; // Total value of the transaction

        asset.totalCost += txCost;
        asset.quantity += tx.quantityChange;

        // Recalculate Average Cost if we have holdings
        if (asset.quantity > 0) {
            asset.avgCost = asset.totalCost / asset.quantity;
        }
    }

    /**
     * Handles events that decrease the asset holding size.
     * Logic:
     * - Reduce Quantity
     * - Reduce Total Cost (proportional to Avg Cost)
     * - Capture Realized PnL
     */
    private static handleDecreasePosition(asset: Asset, tx: Transaction): void {
        const qtySold = Math.abs(tx.quantityChange);

        // Calculate cost basis of the sold portion using Average Cost method
        const costBasisSold = qtySold * asset.avgCost;

        // Proceeds from the sale
        const proceeds = tx.total;

        // Realized Profit/Loss
        const realized = proceeds - costBasisSold;

        asset.quantity -= qtySold;
        asset.totalCost -= costBasisSold;
        asset.realizedPnL += realized;

        // Handle "Close Position" edge cases (floating point errors)
        // If quantity is effectively zero, reset cost basis to avoid "ghost costs"
        if (asset.quantity <= 0.000001) {
            asset.quantity = 0;
            asset.totalCost = 0;
            asset.avgCost = 0;
        }
    }

    /**
     * Handles pure cashflow events (Dividends / Interest).
     * Logic:
     * - Does not change quantity
     * - Improves Realized PnL directly
     */
    private static handleDividend(asset: Asset, tx: Transaction): void {
        asset.realizedPnL += tx.total;
    }

    /**
     * Handles explicit balance corrections.
     */
    private static handleBalanceAdjustment(asset: Asset, tx: Transaction): void {
        if (tx.quantityChange > 0) {
            // Positive adjustment: increase quantity without increasing cost basis
            // This treats the adjustment as "found" assets or performance-based growth
            asset.quantity += tx.quantityChange;
            
            // Recalculate Average Cost - it will drop because we have more units for same cost
            if (asset.quantity > 0) {
                asset.avgCost = asset.totalCost / asset.quantity;
            }
        } else {
            // Negative adjustment: decrease quantity without decreasing cost basis
            // This treats the reduction as a loss in value/performance
            const qtyLost = Math.abs(tx.quantityChange);

            asset.quantity -= qtyLost;

            // Handle "Close Position" or negative quantity edge cases
            if (asset.quantity <= 0.000001) {
                asset.quantity = 0;
                asset.totalCost = 0;
                asset.avgCost = 0;
            } else {
                // Recalculate Average Cost - it will rise because we have fewer units for same cost
                asset.avgCost = asset.totalCost / asset.quantity;
            }
        }
    }

    /**
     * Computes derived metrics based on the final state and current market price.
     */
    private static computeFinalMetrics(asset: Asset): Asset {
        const currentValue = asset.quantity * asset.currentPrice;
        const unrealizedPnL = currentValue - asset.totalCost;

        // Total PnL usually means Unrealized. Realized is separate.
        // Some views might want Total = Unrealized + Realized, 
        // but standard portfolio trackers usually show them distinctly or sum them at portfolio level.
        // Here we stick to the interface:
        const pnl = unrealizedPnL;

        let pnlPercent = 0;
        if (asset.totalCost !== 0) {
            pnlPercent = (pnl / asset.totalCost) * 100;
        }

        return {
            ...asset,
            currentValue,
            pnl,
            pnlPercent
        };
    }
}
