import { AssetType, Currency, Transaction } from '../types/domain';
import { AssetMetadata } from '../types/domain';

export const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

export const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const safeFloat = (val: string): number => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

export const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let startValueIndex = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            let val = line.substring(startValueIndex, i);
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
            result.push(val);
            startValueIndex = i + 1;
        }
    }
    let lastVal = line.substring(startValueIndex);
    if (lastVal.startsWith('"') && lastVal.endsWith('"')) lastVal = lastVal.slice(1, -1).replace(/""/g, '"');
    result.push(lastVal);
    return result;
};

export const generateExportCSV = (transactions: Transaction[], assets: AssetMetadata[]): string => {
    const headers = [
        'tx_id', 'tx_date', 'tx_type', 'tx_quantity', 'tx_price', 'tx_fee', 'tx_total', 'tx_note',
        'asset_id', 'asset_symbol', 'asset_name', 'asset_type', 'asset_currency', 'asset_current_price', 'asset_date_acquired', 'asset_tags'
    ];

    const rows = transactions.map(tx => {
        const asset = assets.find(a => a.id === tx.assetId);

        // Force asset_id and asset_symbol to be treated as text by prefixing with tab character
        const assetIdAsText = `\t${tx.assetId}`;
        const assetSymbolAsText = `\t${asset?.symbol || 'UNKNOWN'}`;

        return [
            tx.id,
            tx.date,
            tx.type,
            tx.quantityChange,
            tx.pricePerUnit,
            tx.fee,
            tx.total,
            tx.note || '',
            assetIdAsText,
            assetSymbolAsText,
            asset?.name || 'Unknown Asset',
            asset?.type || AssetType.OTHER,
            asset?.currency || Currency.USD,
            asset?.currentPrice || 0,
            asset?.dateAcquired || '',
            asset?.tags ? asset.tags.join(';') : ''
        ].map(escapeCSV).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};
