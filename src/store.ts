import { create } from 'zustand'
import type { Asset, PriceHistory, Settings, Transaction } from './types'
import { StorageService, today, uid } from './services/storage'
import { fetchCryptoPrices, fetchFxRates, fetchStockPrices } from './services/prices'

interface AppState {
  assets: Asset[]
  transactions: Transaction[]
  prices: PriceHistory
  settings: Settings
  refreshing: boolean

  addAsset: (a: Omit<Asset, 'id' | 'createdAt'>) => Asset
  updateAsset: (id: string, patch: Partial<Asset>) => void
  deleteAsset: (id: string) => void

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => void
  updateTransaction: (id: string, t: Omit<Transaction, 'id' | 'createdAt'>) => void
  deleteTransaction: (id: string) => void

  saveSettings: (patch: Partial<Settings>) => void
  refreshPrices: () => Promise<string>
  importData: (json: string) => { assets: number; transactions: number }
  clearAll: () => void
  reload: () => void
}

export const useStore = create<AppState>((set, get) => ({
  assets: StorageService.loadAssets(),
  transactions: StorageService.loadTransactions(),
  prices: StorageService.loadPrices(),
  settings: StorageService.loadSettings(),
  refreshing: false,

  addAsset(a) {
    const asset: Asset = { ...a, id: uid(), createdAt: Date.now() }
    const assets = [...get().assets, asset]
    StorageService.saveAssets(assets)
    set({ assets })
    return asset
  },

  updateAsset(id, patch) {
    const assets = get().assets.map((a) => (a.id === id ? { ...a, ...patch } : a))
    StorageService.saveAssets(assets)
    set({ assets })
  },

  deleteAsset(id) {
    const assets = get().assets.filter((a) => a.id !== id)
    const transactions = get().transactions.filter((t) => t.assetId !== id)
    StorageService.saveAssets(assets)
    StorageService.saveTransactions(transactions)
    set({ assets, transactions })
  },

  addTransaction(t) {
    const tx: Transaction = { ...t, id: uid(), createdAt: Date.now() }
    const transactions = [...get().transactions, tx]
    StorageService.saveTransactions(transactions)
    set({ transactions })
  },

  updateTransaction(id, t) {
    const transactions = get().transactions.map((tx) =>
      tx.id === id ? { ...tx, ...t, id: tx.id, createdAt: tx.createdAt } : tx,
    )
    StorageService.saveTransactions(transactions)
    set({ transactions })
  },

  deleteTransaction(id) {
    const transactions = get().transactions.filter((t) => t.id !== id)
    StorageService.saveTransactions(transactions)
    set({ transactions })
  },

  saveSettings(patch) {
    const settings = { ...get().settings, ...patch }
    StorageService.saveSettings(settings)
    set({ settings })
  },

  /** 一键刷新:汇率 → 加密货币 → 美股(已配置 key 时)。返回结果摘要 */
  async refreshPrices() {
    const { assets, settings } = get()
    set({ refreshing: true })
    const messages: string[] = []
    const prices: PriceHistory = JSON.parse(JSON.stringify(get().prices))
    let newSettings = settings

    try {
      try {
        const fxRates = await fetchFxRates(settings)
        newSettings = { ...newSettings, fxRates, fxUpdatedAt: Date.now() }
        messages.push('汇率已更新')
      } catch (e) {
        messages.push(`汇率更新失败:${(e as Error).message}`)
      }

      try {
        const r = await fetchCryptoPrices(assets, prices)
        if (r.updated.length) messages.push(`加密货币 ${r.updated.length} 项已更新`)
        if (r.failed.length) messages.push(`加密货币失败:${r.failed.join(', ')}`)
      } catch (e) {
        messages.push(`加密货币行情失败:${(e as Error).message}`)
      }

      const hasStock = assets.some((a) => a.priceSource === 'finnhub' && !a.archived)
      if (hasStock) {
        try {
          const r = await fetchStockPrices(assets, prices, newSettings)
          if (r.updated.length) messages.push(`股票 ${r.updated.length} 项已更新`)
          if (r.failed.length) messages.push(`股票失败:${r.failed.join(', ')}`)
        } catch (e) {
          messages.push(`股票行情失败:${(e as Error).message}`)
        }
      }

      newSettings = { ...newSettings, pricesUpdatedAt: Date.now() }
      StorageService.savePrices(prices)
      StorageService.saveSettings(newSettings)
      set({ prices, settings: newSettings })
    } finally {
      set({ refreshing: false })
    }
    return messages.join(';') || '没有需要自动更新的资产'
  },

  importData(json) {
    const result = StorageService.importAll(json)
    get().reload()
    return result
  },

  clearAll() {
    StorageService.clearAll()
    get().reload()
  },

  reload() {
    set({
      assets: StorageService.loadAssets(),
      transactions: StorageService.loadTransactions(),
      prices: StorageService.loadPrices(),
      settings: StorageService.loadSettings(),
    })
  },
}))

export { today }
