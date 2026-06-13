import { useCallback } from 'react';
import { Currency, AssetType, TransactionType, Transaction, AssetMetadata } from '../types/domain';
import { SequenceService } from '../services/SequenceService';
import { parseCSVLine, safeFloat } from '../utils/csvUtils';

interface UseCsvImportParams {
    assets: AssetMetadata[];
    importAssetsCSV: (assets: AssetMetadata[]) => void;
    importTransactionsCSV: (txs: Transaction[]) => void;
    onStatus: (status: { msg: string; type: 'success' | 'error' | 'warning' } | null) => void;
    t: (key: string) => string;
}

export const useCsvImport = ({
    assets,
    importAssetsCSV,
    importTransactionsCSV,
    onStatus,
    t
}: UseCsvImportParams) => {
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error("File is empty or invalid");

                const headers = parseCSVLine(lines[0]).map(h => h.trim());

                if (!headers.includes('tx_id') || !headers.includes('asset_id')) {
                    throw new Error("Invalid CSV format. Please use the Unified Export format.");
                }

                const assetsMap = new Map<string, AssetMetadata>();
                const parsedTransactions: Transaction[] = [];
                const idMapping = new Map<string, string>();

                lines.slice(1).forEach(line => {
                    const vals = parseCSVLine(line);
                    const getVal = (key: string) => {
                        const idx = headers.indexOf(key);
                        return idx !== -1 ? vals[idx] : '';
                    };

                    let originalAssetId = getVal('asset_id');
                    if (originalAssetId.startsWith('\t')) {
                        originalAssetId = originalAssetId.substring(1);
                    }

                    if (!originalAssetId) return;

                    let finalAssetId = idMapping.get(originalAssetId);

                    if (!finalAssetId) {
                        const existingAsset = assets.find(a => a.id === originalAssetId);

                        const assetSymbol = (getVal('asset_symbol') || 'UNKNOWN').replace(/^\t/, '');
                        const assetCurrency = (getVal('asset_currency') as Currency) || Currency.USD;

                        if (existingAsset && (existingAsset.symbol !== assetSymbol || existingAsset.currency !== assetCurrency)) {
                            finalAssetId = SequenceService.generateId();
                        } else {
                            finalAssetId = originalAssetId;
                        }
                        idMapping.set(originalAssetId, finalAssetId);
                    }

                    if (!assetsMap.has(finalAssetId)) {
                        assetsMap.set(finalAssetId, {
                            id: finalAssetId,
                            symbol: (getVal('asset_symbol') || 'UNKNOWN').replace(/^\t/, ''),
                            name: getVal('asset_name') || 'Unknown',
                            type: (getVal('asset_type') as AssetType) || AssetType.OTHER,
                            currency: (getVal('asset_currency') as Currency) || Currency.USD,
                            currentPrice: safeFloat(getVal('asset_current_price')),
                            dateAcquired: getVal('asset_date_acquired') || undefined,
                            tags: getVal('asset_tags') ? getVal('asset_tags').split(';').filter(Boolean) : undefined
                        });
                    }

                    parsedTransactions.push({
                        id: SequenceService.generateId(),
                        assetId: finalAssetId,
                        type: (getVal('tx_type') as TransactionType) || TransactionType.BUY,
                        date: getVal('tx_date') || new Date().toISOString(),
                        quantityChange: safeFloat(getVal('tx_quantity')),
                        pricePerUnit: safeFloat(getVal('tx_price')),
                        fee: safeFloat(getVal('tx_fee')),
                        total: safeFloat(getVal('tx_total')),
                        note: getVal('tx_note')
                    });
                });

                const assetsToImport = Array.from(assetsMap.values());
                const txsToImport = parsedTransactions;

                importAssetsCSV(assetsToImport);
                importTransactionsCSV(txsToImport);

                onStatus({
                    msg: `${t('importSuccess')} (${assetsToImport.length} Assets, ${txsToImport.length} Txs)`,
                    type: 'success'
                });

                setTimeout(() => onStatus(null), 5000);
            } catch (err) {
                console.error(err);
                onStatus({ msg: t('importError'), type: 'error' });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [assets, importAssetsCSV, importTransactionsCSV, onStatus, t]);

    return { handleFileChange };
};
