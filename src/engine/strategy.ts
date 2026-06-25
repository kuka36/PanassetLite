import type {
  PeriodReturn,
  Settings,
  Strategy,
  StrategyLedgerRow,
  StrategySnapshot,
  StrategyTransaction,
} from '../types'
import {
  buildValueLedgerRows,
  periodReturnsFor,
  replayValueBalance,
  snapshotFromValueTxs,
} from './replayValue'
import { today } from '../services/storage'

/**
 * StrategyEngine — 策略收益分析引擎。
 * 策略是独立于资产的金额型账本，市值完全依赖 VALUATION 记录，不接行情。
 * 计算结果不参与 PortfolioSummary。
 */
export class StrategyEngine {
  private txByStrategy = new Map<string, StrategyTransaction[]>()
  private strategies: Strategy[]
  private settings: Settings

  constructor(
    strategies: Strategy[],
    strategyTransactions: StrategyTransaction[],
    settings: Settings,
  ) {
    this.strategies = strategies
    this.settings = settings
    const sorted = [...strategyTransactions].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
    )
    for (const tx of sorted) {
      const list = this.txByStrategy.get(tx.strategyId) ?? []
      list.push(tx)
      this.txByStrategy.set(tx.strategyId, list)
    }
  }

  /** 1 单位策略币种 = ? CNY */
  private fx(currency: string): number {
    if (currency === this.settings.baseCurrency) return 1
    return this.settings.fxRates[currency] ?? 1
  }

  /** 某策略的快照 */
  snapshot(strategy: Strategy): StrategySnapshot {
    const txs = this.txByStrategy.get(strategy.id) ?? []
    const fx = this.fx(strategy.currency)
    const t = today()

    const {
      valueCNY,
      valueNative,
      netInvestedCNY,
      totalPnlCNY,
      xirr: rate,
      recentAnnualized,
      lastUpdated,
    } = snapshotFromValueTxs(txs, fx, t)

    return {
      strategy,
      valueCNY,
      valueNative,
      netInvestedCNY,
      totalPnlCNY,
      xirr: rate,
      recentAnnualized,
      lastUpdated,
    }
  }

  /**
   * 策略账本：按 date + createdAt 正序重放，返回 newest-first 供列表展示。
   */
  txLedger(strategy: Strategy): StrategyLedgerRow[] {
    const txs = this.txByStrategy.get(strategy.id) ?? []
    return buildValueLedgerRows(txs, (tx) => {
      if (tx.type === 'VALUATION') return tx.value ?? null
      return tx.amount ?? null
    }).reverse()
  }

  /** 某日策略市值（CNY）。策略无行情插值，市值仅由 VALUATION/存取事件逐笔重放得出 */
  valueAtCNY(strategy: Strategy, date: string): number {
    const txs = (this.txByStrategy.get(strategy.id) ?? []).filter((t) => t.date <= date)
    const valueNative = Math.max(0, replayValueBalance(txs))
    return valueNative * this.fx(strategy.currency)
  }

  /** 累计现金流（CNY）截至某日：in = 投入(DEPOSIT)，out = 收回(WITHDRAW) */
  private flowsUpTo(strategy: Strategy, date: string): { in: number; out: number } {
    const fx = this.fx(strategy.currency)
    let totalIn = 0
    let totalOut = 0
    for (const tx of this.txByStrategy.get(strategy.id) ?? []) {
      if (tx.date > date) break
      if (tx.type === 'DEPOSIT') totalIn += (tx.amount ?? 0) * fx
      if (tx.type === 'WITHDRAW') totalOut += (tx.amount ?? 0) * fx
    }
    return { in: totalIn, out: totalOut }
  }

  /** 给定策略集合的区间收益（本周/本月/今年以来/近一年），与组合页同口径 */
  periodReturnsForStrategies(strategies: Strategy[]): PeriodReturn[] {
    return periodReturnsFor(
      strategies,
      (s, date) => this.valueAtCNY(s, date),
      (s, date) => this.flowsUpTo(s, date),
      today(),
    )
  }

  /** 某资产下的所有策略快照（用于资产详情展示） */
  snapshotsByAsset(assetId: string): StrategySnapshot[] {
    return this.strategies
      .filter((s) => s.assetId === assetId && !s.archived)
      .map((s) => this.snapshot(s))
  }

  /** 某资产下已关闭的策略快照 */
  archivedSnapshotsByAsset(assetId: string): StrategySnapshot[] {
    return this.strategies
      .filter((s) => s.assetId === assetId && s.archived)
      .map((s) => this.snapshot(s))
  }

  /** 所有未归档策略的快照 */
  allSnapshots(): StrategySnapshot[] {
    return this.strategies
      .filter((s) => !s.archived)
      .map((s) => this.snapshot(s))
  }

  /** 所有已关闭策略的快照 */
  archivedSnapshots(): StrategySnapshot[] {
    return this.strategies
      .filter((s) => s.archived)
      .map((s) => this.snapshot(s))
  }

  /** 按 id 取快照（含已关闭） */
  snapshotById(id: string): StrategySnapshot | null {
    const s = this.strategies.find((x) => x.id === id)
    return s ? this.snapshot(s) : null
  }
}
