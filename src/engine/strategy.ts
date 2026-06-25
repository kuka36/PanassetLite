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
  compareValueTx,
  periodReturnsFor,
  replayValueBalance,
  snapshotFromValueTxs,
} from './replayValue'

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
    const sorted = [...strategyTransactions].sort(compareValueTx)
    for (const tx of sorted) {
      const list = this.txByStrategy.get(tx.strategyId) ?? []
      list.push(tx)
      this.txByStrategy.set(tx.strategyId, list)
    }
  }

  private fx(currency: string): number {
    if (currency === this.settings.baseCurrency) return 1
    return this.settings.fxRates[currency] ?? 1
  }

  snapshot(strategy: Strategy): StrategySnapshot {
    const txs = this.txByStrategy.get(strategy.id) ?? []
    const fx = this.fx(strategy.currency)
    const nowMs = Date.now()

    const {
      valueCNY,
      valueNative,
      netInvestedCNY,
      totalPnlCNY,
      xirr: rate,
      recentAnnualized,
      lastUpdated,
    } = snapshotFromValueTxs(txs, fx, nowMs)

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

  txLedger(strategy: Strategy): StrategyLedgerRow[] {
    const txs = this.txByStrategy.get(strategy.id) ?? []
    return buildValueLedgerRows(txs, (tx) => {
      if (tx.type === 'VALUATION') return tx.value ?? null
      return tx.amount ?? null
    }).reverse()
  }

  valueAtCNY(strategy: Strategy, atMs: number): number {
    const txs = (this.txByStrategy.get(strategy.id) ?? []).filter((t) => t.occurredAt <= atMs)
    const valueNative = Math.max(0, replayValueBalance(txs))
    return valueNative * this.fx(strategy.currency)
  }

  private flowsUpTo(strategy: Strategy, atMs: number): { in: number; out: number } {
    const fx = this.fx(strategy.currency)
    let totalIn = 0
    let totalOut = 0
    for (const tx of this.txByStrategy.get(strategy.id) ?? []) {
      if (tx.occurredAt > atMs) break
      if (tx.type === 'DEPOSIT') totalIn += (tx.amount ?? 0) * fx
      if (tx.type === 'WITHDRAW') totalOut += (tx.amount ?? 0) * fx
    }
    return { in: totalIn, out: totalOut }
  }

  periodReturnsForStrategies(strategies: Strategy[]): PeriodReturn[] {
    const nowMs = Date.now()
    return periodReturnsFor(
      strategies,
      (s, atMs) => this.valueAtCNY(s, atMs),
      (s, atMs) => this.flowsUpTo(s, atMs),
      nowMs,
    )
  }

  snapshotsByAsset(assetId: string): StrategySnapshot[] {
    return this.strategies
      .filter((s) => s.assetId === assetId && !s.archived)
      .map((s) => this.snapshot(s))
  }

  archivedSnapshotsByAsset(assetId: string): StrategySnapshot[] {
    return this.strategies
      .filter((s) => s.assetId === assetId && s.archived)
      .map((s) => this.snapshot(s))
  }

  allSnapshots(): StrategySnapshot[] {
    return this.strategies
      .filter((s) => !s.archived)
      .map((s) => this.snapshot(s))
  }

  archivedSnapshots(): StrategySnapshot[] {
    return this.strategies
      .filter((s) => s.archived)
      .map((s) => this.snapshot(s))
  }

  snapshotById(id: string): StrategySnapshot | null {
    const s = this.strategies.find((x) => x.id === id)
    return s ? this.snapshot(s) : null
  }
}
