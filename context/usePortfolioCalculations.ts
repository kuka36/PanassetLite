import { useMemo } from 'react';
import { Asset, AssetMetadata, Transaction } from '../types/domain';
import { PortfolioEngine } from '../services/PortfolioEngine';

export const usePortfolioCalculations = (
    assetMetas: AssetMetadata[],
    transactions: Transaction[]
): Asset[] => {
    return useMemo(() => {
        return PortfolioEngine.calculatePortfolio(assetMetas, transactions);
    }, [assetMetas, transactions]);
};
