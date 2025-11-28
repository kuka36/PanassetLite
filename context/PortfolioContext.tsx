
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Asset, AssetMetadata, AssetType, Currency, Transaction, TransactionType, AppSettings, AIProvider } from '../types';
import {
  clearAssetHistoryCache,
  clearAllHistoryCache
} from '../services/marketData';
import { StorageService } from '../services/StorageService';
import { usePortfolioCalculations } from './usePortfolioCalculations';
import { translations } from '../utils/i18n';
import { MigrationService } from '../services/MigrationService';
import { ImportService } from '../services/ImportService';
import { useMarketData } from '../hooks/useMarketData';

interface PortfolioContextType {
  assets: Asset[]; // Computed Assets
  transactions: Transaction[];
  settings: AppSettings;
  exchangeRates: Record<string, number>;
  isRefreshing: boolean;
  addAsset: (meta: AssetMetadata, initialQty: number, initialCost: number, date: string) => void;
  editAsset: (meta: AssetMetadata) => void;
  deleteAsset: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  editTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateAssetPrice: (id: string, newPrice: number) => void;
  refreshPrices: (assetsOverride?: AssetMetadata[]) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  importAssetsCSV: (newMetas: AssetMetadata[]) => number;
  importTransactionsCSV: (newTxs: Transaction[]) => number;
  clearData: () => void;
  t: (key: string) => string;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const getBrowserLanguage = (): 'en' | 'zh' => {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
};

const INITIAL_SETTINGS: AppSettings = {
  baseCurrency: Currency.USD,
  isPrivacyMode: false,
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
  deepSeekApiKey: '',
  aiProvider: 'gemini',
  marketDataProvider: 'finnhub',
  alphaVantageApiKey: '',
  finnhubApiKey: '',
  language: getBrowserLanguage(),
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Raw State (Storage) ---
  const [assetMetas, setAssetMetas] = useState<AssetMetadata[]>(() => StorageService.getAssetMetas());
  const [transactions, setTransactions] = useState<Transaction[]>(() => StorageService.getTransactions());

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = StorageService.getSettings();
    const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

    if (saved) {
      return {
        ...INITIAL_SETTINGS,
        ...saved,
        // If local storage has empty key but env has one, use env
        geminiApiKey: saved.geminiApiKey || envKey
      };
    }
    return INITIAL_SETTINGS;
  });

  // --- Market Data Hook ---
  const { exchangeRates, isRefreshing, refreshPrices } = useMarketData(assetMetas, setAssetMetas, settings);

  // --- Migration Logic ---
  useEffect(() => {
    MigrationService.migrateIfNeeded(setAssetMetas, setTransactions);
  }, []);

  // --- Persistence ---
  useEffect(() => {
    if (assetMetas.length > 0 || transactions.length > 0) {
      StorageService.saveAssetMetas(assetMetas);
      StorageService.saveTransactions(transactions);
    }
  }, [assetMetas, transactions]);

  useEffect(() => {
    StorageService.saveSettings(settings);
  }, [settings]);

  // --- Core Calculation Engine (Event Sourcing Projection) ---
  const derivedAssets = usePortfolioCalculations(assetMetas, transactions);

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

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // --- UPSERT Logic for CSV Import ---

  const importAssetsCSV = (newMetas: AssetMetadata[]): number => {
    return ImportService.importAssetsCSV(newMetas, setAssetMetas);
  };

  const importTransactionsCSV = (newTxs: Transaction[]): number => {
    return ImportService.importTransactionsCSV(newTxs, setTransactions);
  };

  const clearData = () => {
    setAssetMetas([]);
    setTransactions([]);
    StorageService.clearAllData();
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
