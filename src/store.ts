import { create } from 'zustand'
import type { Asset, PriceHistory, Settings, Strategy, StrategyTransaction, Transaction } from './types'
import { buildDemoData } from './demoData'
import { StorageService, today, uid } from './services/storage'

interface AppState {
  assets: Asset[]
  transactions: Transaction[]
  prices: PriceHistory
  settings: Settings
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
    const strategy = get().strategies.find((s) => s.id === t.strategyId)
    if (strategy?.archived) {
      throw new Error('策略已关闭，无法新增流水')
    }
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

  importData(json) {
    const result = StorageService.importAll(json)
    get().reload()
    return result
  },

  loadDemo() {
    if (get().assets.length > 0 && !confirm('当前已有数据,加载演示数据会覆盖它们。继续?')) return false
    const demo = buildDemoData(get().settings)
    StorageService.saveAssets(demo.assets)
    StorageService.saveTransactions(demo.transactions)
    StorageService.savePrices(demo.prices)
    StorageService.saveStrategies(demo.strategies)
    StorageService.saveStrategyTransactions(demo.strategyTransactions)
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
