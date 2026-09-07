import { useMemo } from 'react'
import { useStore } from '../store'
import { StrategyEngine } from '../engine/strategy'
import { isStrategyExpiryDue, isUpdateStale } from '../utils/format'

/** 获取 StrategyEngine 实例（策略计算的唯一入口） */
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

/** 活跃策略中需关注的数量：长期未更新或已到期（侧栏角标用，同一策略只计 1 次） */
export function useStrategyStaleCount() {
  const engine = useStrategyEngine()
  return useMemo(
    () =>
      engine
        .allSnapshots()
        .filter(
          (s) =>
            isUpdateStale(s.lastUpdated) || isStrategyExpiryDue(s.strategy.expiresAt),
        ).length,
    [engine],
  )
}
