import { useMemo } from 'react'
import { useStore } from '../store'
import { PortfolioEngine } from '../engine/portfolio'

/** 由事件流实时计算组合状态(事件溯源,无派生状态落盘) */
export function useSummary() {
  const assets = useStore((s) => s.assets)
  const transactions = useStore((s) => s.transactions)
  const prices = useStore((s) => s.prices)
  const settings = useStore((s) => s.settings)

  return useMemo(
    () => new PortfolioEngine(assets, transactions, prices, settings).summary(),
    [assets, transactions, prices, settings],
  )
}

/** 获取 PortfolioEngine 实例(供 txLedger 等单资产计算) */
export function usePortfolioEngine() {
  const assets = useStore((s) => s.assets)
  const transactions = useStore((s) => s.transactions)
  const prices = useStore((s) => s.prices)
  const settings = useStore((s) => s.settings)

  return useMemo(
    () => new PortfolioEngine(assets, transactions, prices, settings),
    [assets, transactions, prices, settings],
  )
}
