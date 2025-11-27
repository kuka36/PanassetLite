import { StorageService } from './StorageService';
import { AssetMetadata, Transaction, TransactionType, AssetType } from '../types';

export const MigrationService = {
    migrateIfNeeded: (
        setAssetMetas: (metas: AssetMetadata[]) => void,
        setTransactions: (txs: Transaction[]) => void
    ) => {
        const { assets: legacyAssetsJson, transactions: legacyTxJson, v2Metadata: v2MetaJson } = StorageService.getLegacyData();

        // If we have legacy data but NO new metadata, perform migration
        if (legacyAssetsJson && !v2MetaJson) {
            console.log("Migrating to Event Sourcing Architecture...");
            try {
                const oldAssets: any[] = JSON.parse(legacyAssetsJson);
                const oldTxs: Transaction[] = legacyTxJson ? JSON.parse(legacyTxJson) : [];

                const newMetas: AssetMetadata[] = [];
                const newTxs: Transaction[] = [...oldTxs];

                oldAssets.forEach(a => {
                    // 1. Create Metadata
                    newMetas.push({
                        id: a.id,
                        symbol: a.symbol,
                        name: a.name,
                        type: a.type,
                        currency: a.currency,
                        currentPrice: a.currentPrice,
                        lastUpdated: a.lastUpdated,
                        dateAcquired: a.dateAcquired
                    });

                    // 2. Check if this asset has existing transactions
                    const hasTx = oldTxs.some(t => t.assetId === a.id);

                    // 3. If NO transactions, create an Initial Balance transaction from the current state
                    // This ensures the calculated balance matches what the user sees
                    if (!hasTx && a.quantity > 0) {
                        const defaultDate = a.dateAcquired ? `${a.dateAcquired}T00:00:00` : new Date().toISOString();
                        newTxs.push({
                            id: crypto.randomUUID(),
                            assetId: a.id,
                            type: TransactionType.BUY, // Treat as initial buy
                            date: defaultDate,
                            quantityChange: a.quantity,
                            pricePerUnit: a.avgCost,
                            fee: 0,
                            total: a.quantity * a.avgCost,
                            note: 'Migration: Initial Balance'
                        });
                    }
                });

                setAssetMetas(newMetas);
                setTransactions(newTxs);

                // Save immediately
                StorageService.saveAssetMetas(newMetas);
                StorageService.saveTransactions(newTxs);

                // Cleanup old keys
                StorageService.clearLegacyData();

            } catch (e) {
                console.error("Migration Failed", e);
            }
        }
    }
};
