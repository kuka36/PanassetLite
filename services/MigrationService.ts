import { StorageService } from './StorageService';
import { AssetMetadata, Transaction, TransactionType } from '../types/domain';

/**
 * The schema version this build of the app expects to find in storage.
 * Bump when introducing a new migration step.
 *
 * Version history:
 *   0 - legacy investflow_* schema (mutable asset rows, no event log)
 *   1 - event-sourcing schema (panasset_metadata + panasset_transactions_v2)
 */
export const CURRENT_SCHEMA_VERSION = 1;

interface MigrationStep {
    from: number;
    to: number;
    /**
     * Idempotent migration runner. Returns true if it actually did work,
     * false if there was nothing to migrate. MUST throw on hard failure so
     * the outer loop can avoid stamping the new version.
     */
    run: (ctx: MigrationContext) => boolean;
}

interface MigrationContext {
    setAssetMetas: (metas: AssetMetadata[]) => void;
    setTransactions: (txs: Transaction[]) => void;
}

/**
 * v0 -> v1: legacy investflow_* (mutable asset rows) -> event-sourcing schema.
 * If the user has legacy data but no v1 metadata, synthesize an initial
 * BUY transaction per held asset so the computed balance matches what the
 * user previously saw.
 */
const migrateV0ToV1: MigrationStep = {
    from: 0,
    to: 1,
    run: ({ setAssetMetas, setTransactions }) => {
        const { assets: legacyAssetsJson, transactions: legacyTxJson, v2Metadata: v2MetaJson } =
            StorageService.getLegacyData();

        if (!legacyAssetsJson || v2MetaJson) return false;

        console.log('[Migration] v0 -> v1: rebuilding event log from legacy assets…');

        try {
            const oldAssets: any[] = JSON.parse(legacyAssetsJson);
            const oldTxs: Transaction[] = legacyTxJson ? JSON.parse(legacyTxJson) : [];

            const newMetas: AssetMetadata[] = [];
            const newTxs: Transaction[] = [...oldTxs];

            oldAssets.forEach(a => {
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

                const hasTx = oldTxs.some(t => t.assetId === a.id);
                if (!hasTx && a.quantity > 0) {
                    const defaultDate = a.dateAcquired
                        ? `${a.dateAcquired}T00:00:00`
                        : new Date().toISOString();
                    newTxs.push({
                        id: crypto.randomUUID(),
                        assetId: a.id,
                        type: TransactionType.BUY,
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

            StorageService.saveAssetMetas(newMetas);
            StorageService.saveTransactions(newTxs);
            StorageService.clearLegacyData();

            return true;
        } catch (e) {
            console.error('[Migration] v0 -> v1 failed', e);
            throw e;
        }
    }
};

const STEPS: MigrationStep[] = [migrateV0ToV1];

export const MigrationService = {
    /**
     * Runs every migration step whose `from` is >= the current stored
     * schema version, in order. Stamps the new version on completion.
     * Safe to call on every app boot — steps are no-ops when nothing to do.
     */
    migrateIfNeeded: (
        setAssetMetas: (metas: AssetMetadata[]) => void,
        setTransactions: (txs: Transaction[]) => void
    ) => {
        // First-run users on v1 storage have no version stamp but already
        // own v2 metadata — treat them as v1 to skip legacy detection.
        let current = StorageService.getSchemaVersion();
        if (current === 0) {
            const { v2Metadata } = StorageService.getLegacyData();
            if (v2Metadata) {
                current = 1;
                StorageService.saveSchemaVersion(1);
            }
        }

        for (const step of STEPS) {
            if (step.from < current) continue;
            try {
                step.run({ setAssetMetas, setTransactions });
            } catch {
                // Hard failure — leave version stamp untouched so we retry on
                // next boot. Subsequent steps are skipped.
                return;
            }
            current = step.to;
            StorageService.saveSchemaVersion(step.to);
        }

        if (current < CURRENT_SCHEMA_VERSION) {
            StorageService.saveSchemaVersion(CURRENT_SCHEMA_VERSION);
        }
    }
};
