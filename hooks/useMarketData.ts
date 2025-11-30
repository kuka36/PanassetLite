import { useState, useRef, useEffect } from 'react';
import { AssetMetadata, AssetType, Currency, AppSettings, MarketDataError, ErrorCategory } from '../types';
import { fetchExchangeRates, fetchCryptoPrices, fetchStockPrices } from '../services/marketData';
import { toastService } from '../services/toastService';
import { translations } from '../utils/i18n';

export const useMarketData = (
    assetMetas: AssetMetadata[],
    setAssetMetas: React.Dispatch<React.SetStateAction<AssetMetadata[]>>,
    settings: AppSettings
) => {
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1, CNY: 7.2, HKD: 7.8 });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const settingsRef = useRef(settings);

    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const getErrorMessage = (error: MarketDataError): string => {
        const t = translations[settingsRef.current.language];
        const otherProvider = error.provider === 'finnhub' ? 'Alpha Vantage' : 'Finnhub';

        switch (error.category) {
            case ErrorCategory.API_KEY_MISSING:
                return t.error_api_key_missing;
            case ErrorCategory.API_KEY_INVALID:
                return t.error_api_key_invalid;
            case ErrorCategory.RATE_LIMIT:
                return error.provider === 'alphavantage' ? t.error_rate_limit_av : t.error_rate_limit_fh;
            case ErrorCategory.ACCESS_DENIED:
                return `${t.error_access_denied} ${t.error_switch_provider.replace('{provider}', otherProvider)}`;
            case ErrorCategory.NETWORK_ERROR:
                return t.error_network;
            default:
                return t.error_unknown;
        }
    };

    const refreshPrices = async (assetsOverride?: AssetMetadata[]) => {
        console.log('[useMarketData] refreshPrices called:', {
            isOverride: !!assetsOverride,
            targetAssetsCount: assetsOverride?.length || assetMetas.length,
            provider: settingsRef.current.marketDataProvider,
            stackTrace: new Error().stack?.split('\\n').slice(2, 5).join('\\n')
        });
        setIsRefreshing(true);
        const targetAssets = assetsOverride || assetMetas;

        try {
            const rates = await fetchExchangeRates();
            setExchangeRates(rates);

            const [cryptoPrices, stockData] = await Promise.all([
                fetchCryptoPrices(targetAssets),
                fetchStockPrices(targetAssets, {
                    provider: settingsRef.current.marketDataProvider || 'finnhub',
                    alphaVantageKey: settingsRef.current.alphaVantageApiKey,
                    finnhubKey: settingsRef.current.finnhubApiKey
                }).catch((error: MarketDataError) => {
                    // Show error notification
                    toastService.showError(getErrorMessage(error));
                    // Return empty object to continue with other data
                    return {};
                })
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
                } else if (meta.type === AssetType.CASH && !meta.isManualPrice) {
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
            if ((error as MarketDataError).category) {
                toastService.showError(getErrorMessage(error as MarketDataError));
            } else {
                toastService.showError(translations[settingsRef.current.language].error_network);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    return { exchangeRates, isRefreshing, refreshPrices };
};
