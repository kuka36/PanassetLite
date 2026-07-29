import { useMemo } from 'react'
import { useStore } from '../store'
import { PortfolioEngine } from '../engine/portfolio'
import { isUpdateStale } from '../utils/format'

/** 获取 PortfolioEngine 实例（组合计算的唯一入口） */
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

/** 由事件流实时计算组合状态（事件溯源，无派生状态落盘） */
export function useSummary() {
  const engine = usePortfolioEngine()
  return useMemo(() => engine.summary(), [engine])
}

/** 超过默认阈值未更新估值/行情的资产数量（侧栏角标用） */
export function useAssetStaleCount() {
  const engine = usePortfolioEngine()
  return useMemo(
    () =>
      engine
        .summary()
        .snapshots.filter((s) => isUpdateStale(s.lastUpdated)).length,
    [engine],
  )
}
