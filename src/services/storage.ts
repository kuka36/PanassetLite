import type { Asset, PriceHistory, Settings, Strategy, StrategyTransaction, Transaction } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { migrateDateToOccurredAt } from '../utils/time'

/**
 * StorageService — 本地优先持久化。
 * 所有数据仅保存在浏览器 LocalStorage,绝不上传。
 */
const KEYS = {
  assets: 'panasset.assets',
  transactions: 'panasset.transactions',
  prices: 'panasset.prices',
  settings: 'panasset.settings',
  strategies: 'panasset.strategies',
  strategyTransactions: 'panasset.strategyTransactions',
  ui: 'panasset.ui',
} as const

type UiPrefs = {
  strategiesShowClosed?: boolean
  assetsFilterType?: string
  assetsFilterAsset?: string
  strategiesFilterAsset?: string
  strategiesFilterKind?: string
}

function loadUiPrefs(): UiPrefs {
  return read<UiPrefs>(KEYS.ui, {})
}

function patchUiPrefs(patch: Partial<UiPrefs>) {
  write(KEYS.ui, { ...loadUiPrefs(), ...patch })
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

type LegacyTx = { date?: string; occurredAt?: number; createdAt?: number; updatedAt?: number }

function withoutLegacyDate<T extends { date?: string }>(tx: T): Omit<T, 'date'> {
  const rest = { ...tx }
  delete rest.date
  return rest
}

function normalizeTransaction(tx: LegacyTx & Transaction): Transaction {
  const occurredAt =
    tx.occurredAt ??
    (tx.date ? migrateDateToOccurredAt(tx.date) : tx.createdAt ?? Date.now())
  return {
    ...withoutLegacyDate(tx),
    occurredAt,
    updatedAt: tx.updatedAt ?? tx.createdAt ?? occurredAt,
  }
}

function normalizeStrategyTransaction(tx: LegacyTx & StrategyTransaction): StrategyTransaction {
  const occurredAt =
    tx.occurredAt ??
    (tx.date ? migrateDateToOccurredAt(tx.date) : tx.createdAt ?? Date.now())
  return {
    ...withoutLegacyDate(tx),
    occurredAt,
  }
}

export const StorageService = {
  loadAssets: (): Asset[] => read(KEYS.assets, []),
  saveAssets: (assets: Asset[]) => write(KEYS.assets, assets),

  loadTransactions: (): Transaction[] => {
    const txs = read<Array<LegacyTx & Transaction>>(KEYS.transactions, [])
    return txs.map(normalizeTransaction)
  },
  saveTransactions: (txs: Transaction[]) => write(KEYS.transactions, txs),

  loadPrices: (): PriceHistory => read(KEYS.prices, {}),
  savePrices: (prices: PriceHistory) => write(KEYS.prices, prices),

  loadSettings: (): Settings => {
    const s = read<Partial<Settings>>(KEYS.settings, {})
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      fxRates: { ...DEFAULT_SETTINGS.fxRates, ...(s.fxRates ?? {}) },
      llm: { ...DEFAULT_SETTINGS.llm, ...(s.llm ?? {}) },
    }
  },
  saveSettings: (settings: Settings) => write(KEYS.settings, settings),

  loadStrategies: (): Strategy[] => read(KEYS.strategies, []),
  saveStrategies: (strategies: Strategy[]) => write(KEYS.strategies, strategies),

  loadStrategyTransactions: (): StrategyTransaction[] => {
    const txs = read<Array<LegacyTx & StrategyTransaction>>(KEYS.strategyTransactions, [])
    return txs.map(normalizeStrategyTransaction)
  },
  saveStrategyTransactions: (txs: StrategyTransaction[]) => write(KEYS.strategyTransactions, txs),

  loadStrategiesShowClosed: (): boolean => loadUiPrefs().strategiesShowClosed ?? false,

  saveStrategiesShowClosed: (value: boolean) => {
    patchUiPrefs({ strategiesShowClosed: value })
  },

  loadAssetsFilterType: (): string => loadUiPrefs().assetsFilterType ?? '',

  saveAssetsFilterType: (value: string) => {
    patchUiPrefs({ assetsFilterType: value })
  },

  loadAssetsFilterAsset: (): string => loadUiPrefs().assetsFilterAsset ?? '',

  saveAssetsFilterAsset: (value: string) => {
    patchUiPrefs({ assetsFilterAsset: value })
  },

  loadStrategiesFilterAsset: (): string => loadUiPrefs().strategiesFilterAsset ?? '',

  saveStrategiesFilterAsset: (value: string) => {
    patchUiPrefs({ strategiesFilterAsset: value })
  },

  loadStrategiesFilterKind: (): string => loadUiPrefs().strategiesFilterKind ?? '',

  saveStrategiesFilterKind: (value: string) => {
    patchUiPrefs({ strategiesFilterKind: value })
  },

  exportAll(): string {
    return JSON.stringify(
      {
        app: 'PanassetLite',
        version: 3,
        exportedAt: new Date().toISOString(),
        assets: this.loadAssets(),
        transactions: this.loadTransactions(),
        prices: this.loadPrices(),
        settings: this.loadSettings(),
        strategies: this.loadStrategies(),
        strategyTransactions: this.loadStrategyTransactions(),
      },
      null,
      2,
    )
  },

  importAll(json: string): { assets: number; transactions: number } {
    const data = JSON.parse(json)
    if (!Array.isArray(data.assets) || !Array.isArray(data.transactions)) {
      throw new Error('文件格式不正确:缺少 assets / transactions(流水) 字段')
    }
    write(KEYS.assets, data.assets)
    write(KEYS.transactions, data.transactions)
    if (data.prices) write(KEYS.prices, data.prices)
    if (data.settings) write(KEYS.settings, data.settings)
    // v2 字段：v1 文件无此字段时补空数组，不渗入引擎
    write(KEYS.strategies, Array.isArray(data.strategies) ? data.strategies : [])
    write(KEYS.strategyTransactions, Array.isArray(data.strategyTransactions) ? data.strategyTransactions : [])
    return { assets: data.assets.length, transactions: data.transactions.length }
  },

  clearAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
  },
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
