import { useState, useRef, useEffect } from 'react';
import { AssetMetadata, AssetType, Currency, AppSettings } from '../types';
import { fetchExchangeRates, fetchCryptoPrices, fetchStockPrices } from '../services/marketData';

export const useMarketData = (
    assetMetas: AssetMetadata[],
    setAssetMetas: React.Dispatch<React.SetStateAction<AssetMetadata[]>>,
    settings: AppSettings
) => {
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1, CNY: 7.2, HKD: 7.8 });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const settingsRef = useRef(settings);

    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const refreshPrices = async (assetsOverride?: AssetMetadata[]) => {
        setIsRefreshing(true);
        const targetAssets = assetsOverride || assetMetas;

        try {
            const rates = await fetchExchangeRates();
            setExchangeRates(rates);

            const [cryptoPrices, stockData] = await Promise.all([
                fetchCryptoPrices(targetAssets),
                fetchStockPrices(targetAssets, settingsRef.current.alphaVantageApiKey)
            ]);

            setAssetMetas(prev => prev.map(meta => {
                let newPrice = meta.currentPrice;
                let newCurrency = meta.currency;
                let timestamp = meta.lastUpdated;

                if (meta.type === AssetType.CRYPTO && cryptoPrices[meta.id]) {
                    newPrice = cryptoPrices[meta.id];
                    newCurrency = Currency.USD;
                    timestamp = Date.now();
                } else if ((meta.type === AssetType.STOCK || meta.type === AssetType.FUND) && stockData[meta.id]) {
                    newPrice = stockData[meta.id].price;
                    newCurrency = stockData[meta.id].currency;
                    timestamp = stockData[meta.id].lastUpdated || Date.now();
                } else if (meta.type === AssetType.CASH) {
                    const rate = rates[meta.symbol];
                    if (rate && rate > 0) {
                        newPrice = 1 / rate;
                        newCurrency = Currency.USD;
                        timestamp = Date.now();
                    }
                }

                return { ...meta, currentPrice: newPrice, currency: newCurrency, lastUpdated: timestamp };
            }));

        } catch (error) {
            console.error("Failed to refresh prices:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    return { exchangeRates, isRefreshing, refreshPrices };
};
