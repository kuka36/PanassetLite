import { AssetMetadata, Transaction } from '../types';

export const ImportService = {
    importAssetsCSV: (
        newMetas: AssetMetadata[],
        setAssetMetas: React.Dispatch<React.SetStateAction<AssetMetadata[]>>
    ): number => {
        let count = 0;
        setAssetMetas(prev => {
            const next = [...prev];
            newMetas.forEach(newItem => {
                const idx = next.findIndex(p => p.id === newItem.id);
                if (idx >= 0) {
                    next[idx] = { ...next[idx], ...newItem }; // Update existing
                } else {
                    next.push(newItem); // Add new
                }
                count++;
            });
            return next;
        });
        return newMetas.length; // Return input length as count since the async update is void
    },

    importTransactionsCSV: (
        newTxs: Transaction[],
        setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
    ): number => {
        let count = 0;
        setTransactions(prev => {
            const next = [...prev];
            newTxs.forEach(newItem => {
                const idx = next.findIndex(p => p.id === newItem.id);
                if (idx >= 0) {
                    next[idx] = { ...next[idx], ...newItem }; // Update existing
                } else {
                    next.push(newItem); // Add new
                }
                count++;
            });
            return next;
        });
        return newTxs.length;
    }
};
