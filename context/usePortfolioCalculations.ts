import { useMemo } from 'react';
import { Asset, AssetMetadata, Transaction, TransactionType } from '../types';

export const usePortfolioCalculations = (
    assetMetas: AssetMetadata[],
    transactions: Transaction[]
): Asset[] => {
    return useMemo(() => {
        const assetMap = new Map<string, Asset>();

        // 1. Initialize from Metadata
        assetMetas.forEach(meta => {
            assetMap.set(meta.id, {
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

        // 2. Sort Transactions by Date (Chronological for correct cost basis)
        const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 3. Replay Transactions
        sortedTxs.forEach(tx => {
            const asset = assetMap.get(tx.assetId);
            if (!asset) return;

            if (tx.type === TransactionType.BUY || tx.type === TransactionType.DEPOSIT || tx.type === TransactionType.BORROW) {
                // Increase Position
                const txCost = tx.total; // usually qty * price + fee
                const newTotalCost = asset.totalCost + txCost;
                const newQty = asset.quantity + tx.quantityChange;

                asset.quantity = newQty;
                asset.totalCost = newTotalCost;
                // Recalculate Avg Cost
                if (newQty > 0) {
                    asset.avgCost = newTotalCost / newQty;
                }
            }
            else if (tx.type === TransactionType.SELL || tx.type === TransactionType.WITHDRAWAL || tx.type === TransactionType.REPAY) {
                // Decrease Position
                const qtySold = Math.abs(tx.quantityChange);
                // Cost Basis of sold items
                const costBasisSold = qtySold * asset.avgCost;

                const proceeds = tx.total;
                const realized = proceeds - costBasisSold;

                asset.quantity -= qtySold;
                asset.totalCost -= costBasisSold;
                asset.realizedPnL += realized;

                if (asset.quantity <= 0.000001) {
                    asset.quantity = 0;
                    asset.totalCost = 0;
                    asset.avgCost = 0; // Reset avg cost if fully closed
                }
            }
            else if (tx.type === TransactionType.BALANCE_ADJUSTMENT) {
                if (tx.quantityChange > 0) {
                    // Treat like receiving free shares or buying at specific price
                    asset.quantity += tx.quantityChange;
                    asset.totalCost += tx.total; // qty * price
                    if (asset.quantity > 0) asset.avgCost = asset.totalCost / asset.quantity;
                } else {
                    // Treat like losing shares
                    const qtyLost = Math.abs(tx.quantityChange);
                    const ratio = qtyLost / asset.quantity;
                    asset.totalCost -= (asset.totalCost * ratio);
                    asset.quantity -= qtyLost;
                }
            }
            else if (tx.type === TransactionType.DIVIDEND) {
                // Pure profit/cashflow
                asset.realizedPnL += tx.total;
            }
        });

        // 4. Final Calculations (Current Value, Unrealized PnL)
        return Array.from(assetMap.values()).map(asset => {
            const currentValue = asset.quantity * asset.currentPrice;
            const unrealizedPnL = currentValue - asset.totalCost;
            const pnl = unrealizedPnL;
            const pnlPercent = asset.totalCost !== 0 ? (pnl / asset.totalCost) * 100 : 0;

            return {
                ...asset,
                currentValue,
                pnl,
                pnlPercent
            };
        });

    }, [assetMetas, transactions]);
};
