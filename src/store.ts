import { create } from 'zustand'
import type { Asset, PriceHistory, Settings, Strategy, StrategyTransaction, Transaction } from './types'
import { buildDemoData } from './demoData'
import { StorageService, today, uid } from './services/storage'
import { fetchCryptoPrices, fetchFxRates, fetchStockPrices } from './services/prices'

interface AppState {
  assets: Asset[]
  transactions: Transaction[]
  prices: PriceHistory
  settings: Settings
  refreshing: boolean
  strategies: Strategy[]
  strategyTransactions: StrategyTransaction[]

  addAsset: (a: Omit<Asset, 'id' | 'createdAt'>) => Asset
  updateAsset: (id: string, patch: Partial<Asset>) => void
  deleteAsset: (id: string) => void

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTransaction: (id: string, t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  deleteTransaction: (id: string) => void

  addStrategy: (s: Omit<Strategy, 'id' | 'createdAt'>) => Strategy
  updateStrategy: (id: string, patch: Partial<Omit<Strategy, 'id' | 'createdAt'>>) => void
  deleteStrategy: (id: string) => void

  addStrategyTransaction: (t: Omit<StrategyTransaction, 'id' | 'createdAt'>) => void
  updateStrategyTransaction: (id: string, t: Omit<StrategyTransaction, 'id' | 'createdAt'>) => void
  deleteStrategyTransaction: (id: string) => void

  saveSettings: (patch: Partial<Settings>) => void
  refreshPrices: () => Promise<string>
  importData: (json: string) => { assets: number; transactions: number }
  loadDemo: () => boolean
  clearAll: () => void
  reload: () => void
}

export const useStore = create<AppState>((set, get) => ({
  assets: StorageService.loadAssets(),
  transactions: StorageService.loadTransactions(),
  prices: StorageService.loadPrices(),
  settings: StorageService.loadSettings(),
  refreshing: false,
  strategies: StorageService.loadStrategies(),
  strategyTransactions: StorageService.loadStrategyTransactions(),

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
    // 级联删除该资产下的所有策略及其流水
    const deletedStrategyIds = new Set(
      get().strategies.filter((s) => s.assetId === id).map((s) => s.id),
    )
    const strategies = get().strategies.filter((s) => s.assetId !== id)
    const strategyTransactions = get().strategyTransactions.filter(
      (t) => !deletedStrategyIds.has(t.strategyId),
    )
    StorageService.saveAssets(assets)
    StorageService.saveTransactions(transactions)
    StorageService.saveStrategies(strategies)
    StorageService.saveStrategyTransactions(strategyTransactions)
    set({ assets, transactions, strategies, strategyTransactions })
  },

  addTransaction(t) {
    const now = Date.now()
    const tx: Transaction = { ...t, id: uid(), createdAt: now, updatedAt: now }
    const transactions = [...get().transactions, tx]
    StorageService.saveTransactions(transactions)
    set({ transactions })
  },

  updateTransaction(id, t) {
    const transactions = get().transactions.map((tx) =>
      tx.id === id
        ? { ...tx, ...t, id: tx.id, createdAt: tx.createdAt, updatedAt: Date.now() }
        : tx,
    )
    StorageService.saveTransactions(transactions)
    set({ transactions })
  },

  deleteTransaction(id) {
    const transactions = get().transactions.filter((t) => t.id !== id)
    StorageService.saveTransactions(transactions)
    set({ transactions })
  },

  addStrategy(s) {
    const strategy: Strategy = { ...s, id: uid(), createdAt: Date.now() }
    const strategies = [...get().strategies, strategy]
    StorageService.saveStrategies(strategies)
    set({ strategies })
    return strategy
  },

  updateStrategy(id, patch) {
    const strategies = get().strategies.map((s) => (s.id === id ? { ...s, ...patch } : s))
    StorageService.saveStrategies(strategies)
    set({ strategies })
  },

  deleteStrategy(id) {
    const strategies = get().strategies.filter((s) => s.id !== id)
    const strategyTransactions = get().strategyTransactions.filter((t) => t.strategyId !== id)
    StorageService.saveStrategies(strategies)
    StorageService.saveStrategyTransactions(strategyTransactions)
    set({ strategies, strategyTransactions })
  },

  addStrategyTransaction(t) {
    const tx: StrategyTransaction = { ...t, id: uid(), createdAt: Date.now() }
    const strategyTransactions = [...get().strategyTransactions, tx]
    StorageService.saveStrategyTransactions(strategyTransactions)
    set({ strategyTransactions })
  },

  updateStrategyTransaction(id, t) {
    const strategyTransactions = get().strategyTransactions.map((tx) =>
      tx.id === id ? { ...tx, ...t, id: tx.id, createdAt: tx.createdAt } : tx,
    )
    StorageService.saveStrategyTransactions(strategyTransactions)
    set({ strategyTransactions })
  },

  deleteStrategyTransaction(id) {
    const strategyTransactions = get().strategyTransactions.filter((t) => t.id !== id)
    StorageService.saveStrategyTransactions(strategyTransactions)
    set({ strategyTransactions })
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

  loadDemo() {
    if (get().assets.length > 0 && !confirm('当前已有数据,加载演示数据会覆盖它们。继续?')) return false
    const demo = buildDemoData()
    StorageService.saveAssets(demo.assets)
    StorageService.saveTransactions(demo.transactions)
    StorageService.savePrices(demo.prices)
    get().reload()
    return true
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
      strategies: StorageService.loadStrategies(),
      strategyTransactions: StorageService.loadStrategyTransactions(),
    })
  },
}))

export { today }
