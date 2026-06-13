
import React, { createContext, useContext, useEffect, ReactNode, useReducer } from 'react';
import { Asset, AssetMetadata, AssetType, Currency, Transaction, TransactionType } from '../types/domain';
import { AppSettings } from '../types/store';
import {
  clearAssetHistoryCache,
  clearAllHistoryCache
} from '../services/marketData';
import { StorageService } from '../services/StorageService';
import { usePortfolioCalculations } from './usePortfolioCalculations';
import { translations } from '../utils/i18n';
import { MigrationService } from '../services/MigrationService';
import { useMarketData } from '../hooks/useMarketData';
import { portfolioReducer, PortfolioState } from './portfolioReducer';

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
  qwenApiKey: '',
  aiProvider: 'gemini',
  marketDataProvider: 'finnhub',
  alphaVantageApiKey: '',
  finnhubApiKey: '',
  language: getBrowserLanguage(),
};

const getInitialState = (): PortfolioState => {
  const assetMetas = StorageService.getAssetMetas();
  const transactions = StorageService.getTransactions();
  const savedSettings = StorageService.getSettings();
  const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

  const settings = savedSettings ? {
    ...INITIAL_SETTINGS,
    ...savedSettings,
    geminiApiKey: savedSettings.geminiApiKey || envKey
  } : INITIAL_SETTINGS;

  return { assetMetas, transactions, settings };
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(portfolioReducer, null, getInitialState);
  const { assetMetas, transactions, settings } = state;

  // --- Market Data Hook ---
  const { exchangeRates, isRefreshing, refreshPrices } = useMarketData(assetMetas, dispatch, settings);

  // --- Migration Logic ---
  useEffect(() => {
    MigrationService.migrateIfNeeded(
      (metas) => dispatch({ type: 'UPDATE_METAS', payload: metas }),
      (txs) => dispatch({ type: 'UPDATE_TRANSACTIONS', payload: txs })
    );
  }, []);

  // --- Persistence ---
  useEffect(() => {
    StorageService.saveAssetMetas(assetMetas);
    StorageService.saveTransactions(transactions);
  }, [assetMetas, transactions]);

  useEffect(() => {
    StorageService.saveSettings(settings);
  }, [settings]);

  // --- Core Calculation Engine (Event Sourcing Projection) ---
  const derivedAssets = usePortfolioCalculations(assetMetas, transactions);

  // --- Actions (Helpers for Components) ---

  const addAsset = (meta: AssetMetadata, initialQty: number, initialCost: number, date: string) => {
    let initialTransaction: Transaction | undefined;
    if (initialQty > 0) {
      initialTransaction = {
        id: crypto.randomUUID(),
        assetId: meta.id,
        type: meta.type === AssetType.LIABILITY ? TransactionType.BORROW : TransactionType.BUY,
        date: date,
        quantityChange: initialQty,
        pricePerUnit: initialCost,
        fee: 0,
        total: initialQty * initialCost,
        note: 'Initial Holding'
      };
    }
    dispatch({ type: 'ADD_ASSET', payload: { meta, initialTransaction } });
    refreshPrices([meta]);
  };

  const editAsset = (updatedMeta: AssetMetadata) => {
    dispatch({ type: 'EDIT_ASSET', payload: updatedMeta });
  };

  const deleteAsset = (id: string) => {
    dispatch({ type: 'DELETE_ASSET', payload: id });
    clearAssetHistoryCache(id);
  };

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    dispatch({ type: 'ADD_TRANSACTION', payload: { ...tx, id: crypto.randomUUID() } });
  };

  const editTransaction = (updatedTx: Transaction) => {
    dispatch({ type: 'EDIT_TRANSACTION', payload: updatedTx });
  };

  const deleteTransaction = (id: string) => {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
  };

  const updateAssetPrice = (id: string, newPrice: number) => {
    dispatch({ type: 'UPDATE_ASSET_PRICE', payload: { id, price: newPrice } });
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
  };

  const importAssetsCSV = (newMetas: AssetMetadata[]): number => {
    dispatch({
      type: 'UPDATE_METAS',
      payload: (prev) => {
        const next = [...prev];
        newMetas.forEach(newItem => {
          const idx = next.findIndex(p => p.id === newItem.id);
          if (idx >= 0) next[idx] = { ...next[idx], ...newItem };
          else next.push(newItem);
        });
        return next;
      }
    });
    return newMetas.length;
  };

  const importTransactionsCSV = (newTxs: Transaction[]): number => {
    newTxs.forEach(tx => dispatch({ type: 'ADD_TRANSACTION', payload: tx }));
    return newTxs.length;
  };

  const clearData = () => {
    dispatch({ type: 'CLEAR_DATA' });
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
