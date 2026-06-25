import { useMemo } from 'react'
import { useStore } from '../store'
import { StrategyEngine } from '../engine/strategy'

/** 获取 StrategyEngine 实例（供快照列表与账本计算） */
export function useStrategyEngine() {
  const strategies = useStore((s) => s.strategies)
  const strategyTransactions = useStore((s) => s.strategyTransactions)
  const settings = useStore((s) => s.settings)

  return useMemo(
    () => new StrategyEngine(strategies, strategyTransactions, settings),
    [strategies, strategyTransactions, settings],
  )
}

/** 所有未归档策略的快照列表 */
export function useStrategySnapshots() {
  const engine = useStrategyEngine()
  return useMemo(() => engine.allSnapshots(), [engine])
}

/** 所有已关闭策略的快照列表 */
export function useArchivedStrategySnapshots() {
  const engine = useStrategyEngine()
  return useMemo(() => engine.archivedSnapshots(), [engine])
}
