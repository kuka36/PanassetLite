import type { Asset, PriceHistory, Settings, Transaction } from '../types'
import { DEFAULT_SETTINGS } from '../types'

/**
 * StorageService — 本地优先持久化。
 * 所有数据仅保存在浏览器 LocalStorage,绝不上传。
 */
const KEYS = {
  assets: 'panasset.assets',
  transactions: 'panasset.transactions',
  prices: 'panasset.prices',
  settings: 'panasset.settings',
} as const

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

export const StorageService = {
  loadAssets: (): Asset[] => read(KEYS.assets, []),
  saveAssets: (assets: Asset[]) => write(KEYS.assets, assets),

  loadTransactions: (): Transaction[] => read(KEYS.transactions, []),
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

  exportAll(): string {
    return JSON.stringify(
      {
        app: 'PanassetLite',
        version: 1,
        exportedAt: new Date().toISOString(),
        assets: this.loadAssets(),
        transactions: this.loadTransactions(),
        prices: this.loadPrices(),
        settings: this.loadSettings(),
      },
      null,
      2,
    )
  },

  importAll(json: string): { assets: number; transactions: number } {
    const data = JSON.parse(json)
    if (!Array.isArray(data.assets) || !Array.isArray(data.transactions)) {
      throw new Error('文件格式不正确:缺少 assets / transactions')
    }
    write(KEYS.assets, data.assets)
    write(KEYS.transactions, data.transactions)
    if (data.prices) write(KEYS.prices, data.prices)
    if (data.settings) write(KEYS.settings, data.settings)
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
