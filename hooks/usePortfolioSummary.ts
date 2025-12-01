import { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { AssetType } from '../types/domain';
import { convertValue } from '../services/marketData';

export const usePortfolioSummary = () => {
    const { assets, settings, exchangeRates } = usePortfolio();
    const { baseCurrency } = settings;

    const summary = useMemo(() => {
        let totalAssetsValue = 0;
        let totalLiabilitiesValue = 0;
        let totalCost = 0;
        const dayPnL = 0;

        assets.forEach(asset => {
            const nativeValue = asset.quantity * asset.currentPrice;
            const nativeCost = asset.quantity * asset.avgCost;

            const convertedValue = convertValue(nativeValue, asset.currency, baseCurrency, exchangeRates);
            const convertedCost = convertValue(nativeCost, asset.currency, baseCurrency, exchangeRates);

            if (asset.type === AssetType.LIABILITY) {
                totalLiabilitiesValue += convertedValue;
                totalCost -= convertedCost;
            } else {
                totalAssetsValue += convertedValue;
                totalCost += convertedCost;
            }
        });

        const totalNetWorth = totalAssetsValue - totalLiabilitiesValue;
        const totalPnL = totalNetWorth - totalCost;
        const totalPnLPercent = totalCost !== 0 ? (totalPnL / Math.abs(totalCost)) * 100 : 0;

        return {
            totalNetWorth,
            totalAssetsValue,
            totalLiabilitiesValue,
            totalCost,
            totalPnL,
            totalPnLPercent,
            dayPnL
        };
    }, [assets, baseCurrency, exchangeRates]);

    const allocationData = useMemo(() => {
        return assets
            .filter(a => a.type !== AssetType.LIABILITY)
            .map(asset => {
                const nativeValue = asset.quantity * asset.currentPrice;
                const convertedValue = convertValue(nativeValue, asset.currency, baseCurrency, exchangeRates);
                return {
                    name: asset.symbol,
                    value: convertedValue
                };
            })
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [assets, baseCurrency, exchangeRates]);

    return {
        summary,
        allocationData
    };
};
