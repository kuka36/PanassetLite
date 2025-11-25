
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo } from 'react';
import { Asset, AssetMetadata, AssetType, Currency, Transaction, TransactionType, Language, AIProvider } from '../types';
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
}

interface PortfolioContextType {
  assets: Asset[]; // Computed Assets
  transactions: Transaction[];
  settings: AppSettings;
  exchangeRates: ExchangeRates;
  isRefreshing: boolean;
  addAsset: (meta: AssetMetadata, initialQty: number, initialCost: number, date: string) => void;
  editAsset: (meta: AssetMetadata) => void;
  deleteAsset: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  editTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateAssetPrice: (id: string, newPrice: number) => void;
  refreshPrices: (assetsOverride?: Asset[]) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  importAssetsCSV: (newMetas: AssetMetadata[]) => number;
  importTransactionsCSV: (newTxs: Transaction[]) => number;
  clearData: () => void;
  t: (key: string) => string;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const getBrowserLanguage = (): Language => {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
};

const INITIAL_SETTINGS: AppSettings = {
  baseCurrency: Currency.USD,
  isPrivacyMode: false,
  // Prioritize GEMINI_API_KEY, fallback to standard API_KEY
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
  deepSeekApiKey: '',
  aiProvider: 'gemini',
  alphaVantageApiKey: '',
  language: getBrowserLanguage(),
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Raw State (Storage) ---
  const [assetMetas, setAssetMetas] = useState<AssetMetadata[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('investflow_settings');
    const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...INITIAL_SETTINGS, 
        ...parsed,
        // If local storage has empty key but env has one, use env
        geminiApiKey: parsed.geminiApiKey || envKey
      };
    }
    return INITIAL_SETTINGS;
  });

  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({ USD: 1, CNY: 7.2, HKD: 7.8 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const settingsRef = useRef(settings);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // --- Migration Logic ---
  useEffect(() => {
    const legacyAssetsJson = localStorage.getItem('investflow_assets');
    const legacyTxJson = localStorage.getItem('investflow_transactions');
    const v2MetaJson = localStorage.getItem('investflow_metadata');

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
        localStorage.setItem('investflow_metadata', JSON.stringify(newMetas));
        localStorage.setItem('investflow_transactions_v2', JSON.stringify(newTxs));
        
        // Cleanup old keys
        localStorage.removeItem('investflow_assets');
        localStorage.removeItem('investflow_transactions'); 

      } catch (e) {
        console.error("Migration Failed", e);
      }
    } else {
      // Normal Load
      if (v2MetaJson) setAssetMetas(JSON.parse(v2MetaJson));
      const v2TxJson = localStorage.getItem('investflow_transactions_v2');
      if (v2TxJson) setTransactions(JSON.parse(v2TxJson));
    }
  }, []);

  // --- Persistence ---
  useEffect(() => {
    if (assetMetas.length > 0 || transactions.length > 0) {
        localStorage.setItem('investflow_metadata', JSON.stringify(assetMetas));
        localStorage.setItem('investflow_transactions_v2', JSON.stringify(transactions));
    }
  }, [assetMetas, transactions]);

  useEffect(() => {
    localStorage.setItem('investflow_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Core Calculation Engine (Event Sourcing Projection) ---
  const derivedAssets: Asset[] = useMemo(() => {
    const assetMap = new Map<string, Asset>();

    // 1. Initialize from Metadata
    assetMetas.forEach(meta => {
      assetMap.set(meta.id, {
        ...meta,
        quantity: 0,
        avgCost: 0,
        totalCost: 0,
        currentValue: 0,
        pnl: 0,
        pnlPercent: 0,
        realizedPnL: 0
      });
    });

    // 2. Sort Transactions by Date (Chronological for correct cost basis)
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Replay Transactions
    sortedTxs.forEach(tx => {
      const asset = assetMap.get(tx.assetId);
      if (!asset) return;

      if (tx.type === TransactionType.BUY || tx.type === TransactionType.DEPOSIT || tx.type === TransactionType.BORROW) {
         // Increase Position
         const txCost = tx.total; // usually qty * price + fee
         const newTotalCost = asset.totalCost + txCost;
         const newQty = asset.quantity + tx.quantityChange;
         
         asset.quantity = newQty;
         asset.totalCost = newTotalCost;
         // Recalculate Avg Cost
         if (newQty > 0) {
           asset.avgCost = newTotalCost / newQty;
         }
      } 
      else if (tx.type === TransactionType.SELL || tx.type === TransactionType.WITHDRAWAL || tx.type === TransactionType.REPAY) {
         // Decrease Position
         const qtySold = Math.abs(tx.quantityChange);
         // Cost Basis of sold items
         const costBasisSold = qtySold * asset.avgCost;
         
         const proceeds = tx.total; 
         const realized = proceeds - costBasisSold;
         
         asset.quantity -= qtySold;
         asset.totalCost -= costBasisSold;
         asset.realizedPnL += realized;

         if (asset.quantity <= 0.000001) {
           asset.quantity = 0;
           asset.totalCost = 0;
           asset.avgCost = 0; // Reset avg cost if fully closed
         }
      }
      else if (tx.type === TransactionType.BALANCE_ADJUSTMENT) {
         if (tx.quantityChange > 0) {
             // Treat like receiving free shares or buying at specific price
             asset.quantity += tx.quantityChange;
             asset.totalCost += tx.total; // qty * price
             if (asset.quantity > 0) asset.avgCost = asset.totalCost / asset.quantity;
         } else {
             // Treat like losing shares
             const qtyLost = Math.abs(tx.quantityChange);
             const ratio = qtyLost / asset.quantity;
             asset.totalCost -= (asset.totalCost * ratio);
             asset.quantity -= qtyLost;
         }
      }
      else if (tx.type === TransactionType.DIVIDEND) {
        // Pure profit/cashflow
        asset.realizedPnL += tx.total;
      }
    });

    // 4. Final Calculations (Current Value, Unrealized PnL)
    return Array.from(assetMap.values()).map(asset => {
      const currentValue = asset.quantity * asset.currentPrice;
      const unrealizedPnL = currentValue - asset.totalCost;
      const pnl = unrealizedPnL; 
      const pnlPercent = asset.totalCost !== 0 ? (pnl / asset.totalCost) * 100 : 0;

      return {
        ...asset,
        currentValue,
        pnl,
        pnlPercent
      };
    });

  }, [assetMetas, transactions]);


  // --- Actions ---

  const addAsset = (meta: AssetMetadata, initialQty: number, initialCost: number, date: string) => {
    setAssetMetas(prev => [...prev, meta]);
    
    // Also create the initial transaction
    if (initialQty > 0) {
      const initialTx: Transaction = {
        id: crypto.randomUUID(),
        assetId: meta.id,
        type: meta.type === AssetType.LIABILITY ? TransactionType.BORROW : TransactionType.BUY,
        date: date, // Now passed as full ISO string from modal
        quantityChange: initialQty,
        pricePerUnit: initialCost,
        fee: 0,
        total: initialQty * initialCost,
        note: 'Initial Holding'
      };
      setTransactions(prev => [...prev, initialTx]);
    }
    
    // Trigger price fetch
    refreshPrices(); 
  };

  const editAsset = (updatedMeta: AssetMetadata) => {
    setAssetMetas(prev => prev.map(m => m.id === updatedMeta.id ? updatedMeta : m));
  };

  const deleteAsset = (id: string) => {
    setAssetMetas(prev => prev.filter(m => m.id !== id));
    setTransactions(prev => prev.filter(t => t.assetId !== id));
    clearAssetHistoryCache(id);
  };

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx = { ...tx, id: crypto.randomUUID() };
    setTransactions(prev => [...prev, newTx]);
  };

  const editTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const updateAssetPrice = (id: string, newPrice: number) => {
    setAssetMetas(prev => prev.map(a => a.id === id ? { ...a, currentPrice: newPrice, lastUpdated: Date.now() } : a));
  };

  const refreshPrices = async (assetsOverride?: Asset[]) => {
    setIsRefreshing(true);
    // Use derived assets to know what to fetch
    const targetAssets = assetsOverride || derivedAssets;

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

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // --- UPSERT Logic for CSV Import ---

  const importAssetsCSV = (newMetas: AssetMetadata[]): number => {
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
  };

  const importTransactionsCSV = (newTxs: Transaction[]): number => {
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
  };

  const clearData = () => {
    setAssetMetas([]);
    setTransactions([]);
    localStorage.removeItem('investflow_metadata');
    localStorage.removeItem('investflow_transactions_v2');
    clearAllHistoryCache();
  };

  const t = (key: string): string => {
    const lang = settings.language || 'en';
    return translations[lang]?.[key] || key;
  };

  return (
    <PortfolioContext.Provider value={{ 
      assets: derivedAssets, 
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
      importAssetsCSV,
      importTransactionsCSV,
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
