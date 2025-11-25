
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Asset, AssetType, Currency, Transaction, TransactionType, Language, AIProvider } from '../types';
import { 
  fetchExchangeRates, 
  fetchCryptoPrices, 
  fetchStockPrices, 
  ExchangeRates, 
  clearAssetHistoryCache, 
  clearAllHistoryCache 
} from '../services/marketData';
import { translations } from '../utils/i18n';

interface AppSettings {
  baseCurrency: Currency;
  isPrivacyMode: boolean;
  geminiApiKey: string;
  deepSeekApiKey: string;
  aiProvider: AIProvider;
  alphaVantageApiKey: string;
  language: Language;
  isAiAssistantEnabled: boolean;
}

interface PortfolioContextType {
  assets: Asset[];
  transactions: Transaction[];
  settings: AppSettings;
  exchangeRates: ExchangeRates;
  isRefreshing: boolean;
  addAsset: (asset: Asset) => void;
  editAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  editTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateAssetPrice: (id: string, newPrice: number) => void;
  refreshPrices: (assetsOverride?: Asset[]) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  importData: (data: { assets: Asset[], transactions: Transaction[] }) => void;
  clearData: () => void;
  t: (key: string) => string;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Initial Data cleared as requested
const INITIAL_ASSETS: Asset[] = [];

const getBrowserLanguage = (): Language => {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
};

const INITIAL_SETTINGS: AppSettings = {
  baseCurrency: Currency.USD,
  isPrivacyMode: false,
  geminiApiKey: '',
  deepSeekApiKey: '',
  aiProvider: 'gemini',
  alphaVantageApiKey: '',
  language: getBrowserLanguage(),
  isAiAssistantEnabled: true,
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('investflow_assets');
    return saved ? JSON.parse(saved) : INITIAL_ASSETS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('investflow_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('investflow_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...INITIAL_SETTINGS,
        ...parsed,
        // Ensure default values if missing in saved data
        geminiApiKey: parsed.geminiApiKey || '',
        deepSeekApiKey: parsed.deepSeekApiKey || '',
        aiProvider: parsed.aiProvider || 'gemini',
        alphaVantageApiKey: parsed.alphaVantageApiKey || '',
        language: parsed.language || INITIAL_SETTINGS.language,
        isAiAssistantEnabled: parsed.isAiAssistantEnabled ?? INITIAL_SETTINGS.isAiAssistantEnabled,
      };
    }
    return INITIAL_SETTINGS;
  });

  // Use ref to access latest settings in async functions without triggering re-runs
  const settingsRef = useRef(settings);
  useEffect(() => {
      settingsRef.current = settings;
  }, [settings]);

  // Default rates (will be updated by API)
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({ USD: 1, CNY: 7.2, HKD: 7.8 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    localStorage.setItem('investflow_assets', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('investflow_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('investflow_settings', JSON.stringify(settings));
  }, [settings]);

  // Initial Data Fetch Logic (Optimized)
  useEffect(() => {
    const initFetch = async () => {
       // 1. Always fetch rates as they are cheap (1 call)
       try {
         const rates = await fetchExchangeRates();
         setExchangeRates(rates);
       } catch(e) {}

       // 2. SMART REFRESH: Only refresh prices if we have assets AND they seem stale (or no prices yet)
       // This prevents "Refresh on Load" killing the API quota
       const needsRefresh = assets.length > 0 && assets.some(a => {
           // If asset is Market type but lastUpdated is old (> 60 mins) or 0
           const isMarket = a.type === AssetType.STOCK || a.type === AssetType.CRYPTO || a.type === AssetType.FUND;
           if (!isMarket) return false;
           return !a.lastUpdated || (Date.now() - a.lastUpdated > 60 * 60 * 1000);
       });

       if (needsRefresh) {
           refreshPrices();
       }
    };
    
    initFetch();

    // OPTIMIZATION: Increased auto-refresh interval from 10 mins to 60 mins
    const intervalId = setInterval(() => {
      refreshPrices();
    }, 3600000); // 1 Hour

    return () => clearInterval(intervalId);
  }, []);

  const addAsset = (newAsset: Asset) => {
    // Ensure lastUpdated is set
    const assetWithMeta = { ...newAsset, lastUpdated: newAsset.lastUpdated || Date.now() };
    
    // 1. Update State immediately
    const updatedList = [...assets, assetWithMeta];
    setAssets(updatedList);

    // 2. Trigger immediate price fetch for the new list to ensure fresh data
    // The service layer handles caching, so this is safe to call, but we focus on the new asset
    refreshPrices(updatedList);
  };

  const editAsset = (updatedAsset: Asset) => {
    setAssets(prev => prev.map(asset => asset.id === updatedAsset.id ? updatedAsset : asset));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== id));
    setTransactions(prev => prev.filter(t => t.assetId !== id));
    clearAssetHistoryCache(id); // Clean up persistent storage for this asset history
  };

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx = { ...tx, id: crypto.randomUUID() };
    setTransactions(prev => [...prev, newTx]);

    // Update asset holding logic
    setAssets(prev => prev.map(asset => {
      if (asset.id !== tx.assetId) return asset;

      let newQty = asset.quantity;
      let newCost = asset.avgCost;

      if (tx.type === TransactionType.BUY) {
        const totalValue = (asset.quantity * asset.avgCost) + (tx.quantity * tx.price) + tx.fee;
        newQty = asset.quantity + tx.quantity;
        newCost = totalValue / newQty;
      } else if (tx.type === TransactionType.SELL) {
        newQty = asset.quantity - tx.quantity;
      }

      return { ...asset, quantity: newQty, avgCost: newCost };
    }));
  };

  // Helper logic for transaction reversal
  const applyTransactionReversal = (asset: Asset, tx: Transaction): { qty: number, cost: number } => {
    let newQty = asset.quantity;
    let newAvgCost = asset.avgCost;

    if (tx.type === TransactionType.BUY) {
        // Reverse BUY: Remove quantity and subtract cost basis
        const currentTotalCost = asset.quantity * asset.avgCost;
        const txCostContribution = (tx.quantity * tx.price) + tx.fee;
        
        const newTotalCost = currentTotalCost - txCostContribution;
        newQty = asset.quantity - tx.quantity;
        
        if (newQty > 0 && newTotalCost > 0) {
            newAvgCost = newTotalCost / newQty;
        } else {
            newAvgCost = newQty <= 0 ? 0 : newAvgCost; 
        }
    } else if (tx.type === TransactionType.SELL) {
        // Reverse SELL: Add quantity back.
        newQty = asset.quantity + tx.quantity;
    }
    return { qty: newQty, cost: newAvgCost };
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const asset = assets.find(a => a.id === tx.assetId);
    if (asset) {
      const { qty, cost } = applyTransactionReversal(asset, tx);
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, quantity: qty, avgCost: cost } : a));
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const editTransaction = (newTx: Transaction) => {
      const oldTx = transactions.find(t => t.id === newTx.id);
      if (!oldTx) return;

      // 1. Revert Old Transaction Effect
      let targetAsset = assets.find(a => a.id === oldTx.assetId);
      if (!targetAsset) return;

      // Note: If assetId changed, we need to handle two assets. 
      // For simplicity, we assume assetId change handled by UI via delete+add, 
      // but here we support robust update on same asset.
      
      const reverted = applyTransactionReversal(targetAsset, oldTx);
      
      // Temporary asset state after reversal
      const assetAfterRevert = { ...targetAsset, quantity: reverted.qty, avgCost: reverted.cost };

      // 2. Apply New Transaction Effect
      let finalQty = assetAfterRevert.quantity;
      let finalCost = assetAfterRevert.avgCost;

      if (newTx.type === TransactionType.BUY) {
          const totalValue = (assetAfterRevert.quantity * assetAfterRevert.avgCost) + (newTx.quantity * newTx.price) + newTx.fee;
          finalQty = assetAfterRevert.quantity + newTx.quantity;
          finalCost = totalValue / finalQty;
      } else if (newTx.type === TransactionType.SELL) {
          finalQty = assetAfterRevert.quantity - newTx.quantity;
      }

      // 3. Update States
      setAssets(prev => prev.map(a => a.id === targetAsset!.id ? { ...a, quantity: finalQty, avgCost: finalCost } : a));
      setTransactions(prev => prev.map(t => t.id === newTx.id ? newTx : t));
  };

  const updateAssetPrice = (id: string, newPrice: number) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, currentPrice: newPrice, lastUpdated: Date.now() } : a));
  };

  // Modified: Accept optional assets list to support immediate fetch after add
  const refreshPrices = async (assetsOverride?: Asset[]) => {
    setIsRefreshing(true);
    const targetAssets = assetsOverride || assets;

    try {
      // 1. Fetch Rates (Cheap)
      const rates = await fetchExchangeRates();
      setExchangeRates(rates);

      // 2. Fetch Asset Prices (Service handles strict caching/throttling)
      const [cryptoPrices, stockData] = await Promise.all([
        fetchCryptoPrices(targetAssets),
        fetchStockPrices(targetAssets, settingsRef.current.alphaVantageApiKey)
      ]);

      // 3. Update State
      setAssets(prev => prev.map(asset => {
        let newPrice = asset.currentPrice;
        let newCurrency = asset.currency;
        let timestamp = asset.lastUpdated; // Keep existing timestamp by default
        
        if (asset.type === AssetType.CRYPTO && cryptoPrices[asset.id]) {
          newPrice = cryptoPrices[asset.id];
          newCurrency = Currency.USD; 
          timestamp = Date.now();
        } else if ((asset.type === AssetType.STOCK || asset.type === AssetType.FUND) && stockData[asset.id]) {
          newPrice = stockData[asset.id].price;
          newCurrency = stockData[asset.id].currency;
          timestamp = stockData[asset.id].lastUpdated || Date.now();
        } else if (asset.type === AssetType.CASH) {
            const rate = rates[asset.symbol];
            if (rate && rate > 0) {
                newPrice = 1 / rate;
                newCurrency = Currency.USD; 
                timestamp = Date.now();
            }
        }

        return { ...asset, currentPrice: newPrice, currency: newCurrency, lastUpdated: timestamp };
      }));

    } catch (error) {
      console.error("Failed to refresh prices:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const importData = (data: { assets: Asset[], transactions: Transaction[] }) => {
    if (Array.isArray(data.assets)) {
      const assetsWithMeta = data.assets.map(a => ({ ...a, lastUpdated: a.lastUpdated || Date.now() }));
      setAssets(assetsWithMeta);
    }
    if (Array.isArray(data.transactions)) setTransactions(data.transactions);
  };

  const clearData = () => {
    setAssets([]);
    setTransactions([]);
    localStorage.removeItem('investflow_assets');
    localStorage.removeItem('investflow_transactions');
    clearAllHistoryCache(); // Wipe all historical data caches
  };

  // Translation Helper
  const t = (key: string): string => {
    const lang = settings.language || 'en';
    return translations[lang]?.[key] || key;
  };

  return (
    <PortfolioContext.Provider value={{ 
      assets, 
      transactions, 
      settings,
      exchangeRates,
      isRefreshing,
      addAsset, 
      editAsset,
      deleteAsset,
      addTransaction,
      editTransaction,
      deleteTransaction,
      updateAssetPrice, 
      refreshPrices,
      updateSettings,
      importData,
      clearData,
      t
    }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
