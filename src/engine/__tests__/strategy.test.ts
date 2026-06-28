import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrategyEngine } from '../strategy'
import { NOW, settings, strategy, strategyTx, T0, T1, T2 } from './helpers'

describe('StrategyEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const s1 = strategy({ id: 'st1', assetId: 'a1' })
  const s2 = strategy({ id: 'st2', assetId: 'a1', archived: true })
  const s3 = strategy({ id: 'st3', assetId: 'a2', currency: 'USD' })

  const baseTxs = [
    strategyTx({ id: 't1', strategyId: 'st1', type: 'DEPOSIT', occurredAt: T0, amount: 10_000 }),
    strategyTx({ id: 't2', strategyId: 'st1', type: 'VALUATION', occurredAt: T1, value: 10_500 }),
    strategyTx({ id: 't3', strategyId: 'st1', type: 'VALUATION', occurredAt: T2, value: 11_000 }),
  ]

  function engine(
    strategies = [s1, s2, s3],
    txs = baseTxs,
    fxRates: Record<string, number> = { USD: 7 },
  ) {
    return new StrategyEngine(strategies, txs, settings({ fxRates }))
  }

  describe('snapshot', () => {
    it('存入+估值', () => {
      const snap = engine().snapshot(s1)
      expect(snap.valueNative).toBe(11_000)
      expect(snap.valueCNY).toBe(11_000)
      expect(snap.netInvestedCNY).toBe(10_000)
      expect(snap.totalPnlCNY).toBe(1000)
      expect(snap.lastUpdated).toBe(T2)
    })

    it('最近年化', () => {
      const snap = engine().snapshot(s1)
      expect(snap.recentAnnualized).not.toBeNull()
    })

    it('空策略', () => {
      const empty = strategy({ id: 'empty', assetId: 'a1' })
      const snap = engine([empty], []).snapshot(empty)
      expect(snap.valueNative).toBe(0)
      expect(snap.valueCNY).toBe(0)
      expect(snap.netInvestedCNY).toBe(0)
      expect(snap.totalPnlCNY).toBe(0)
      expect(snap.xirr).toBeNull()
      expect(snap.recentAnnualized).toBeNull()
    })
  })

  describe('txLedger', () => {
    it('余额倒序', () => {
      const ledger = engine().txLedger(s1)
      expect(ledger.map((r) => r.tx.id)).toEqual(['t3', 't2', 't1'])
      expect(ledger[0].balanceAfter).toBe(11_000)
    })

    it('取出减少余额', () => {
      const s = strategy({ id: 'sw', assetId: 'a1' })
      const txs = [
        strategyTx({ id: 'd1', strategyId: 'sw', type: 'DEPOSIT', occurredAt: T0, amount: 1000 }),
        strategyTx({ id: 'w1', strategyId: 'sw', type: 'WITHDRAW', occurredAt: T1, amount: 300 }),
      ]
      const ledger = engine([s], txs).txLedger(s)
      expect(ledger[0].balanceAfter).toBe(700)
    })
  })

  describe('valueAtCNY', () => {
    it('fx 换算', () => {
      const txs = [
        strategyTx({ id: 'd1', strategyId: 'st3', type: 'DEPOSIT', occurredAt: T0, amount: 100 }),
      ]
      expect(engine([s3], txs).valueAtCNY(s3, T0)).toBe(700)
    })

    it('空策略', () => {
      const empty = strategy({ id: 'empty', assetId: 'a1' })
      expect(engine([empty], []).valueAtCNY(empty, NOW)).toBe(0)
    })
  })

  describe('snapshotsByAsset', () => {
    it('按资产过滤 / 排除归档', () => {
      const snaps = engine().snapshotsByAsset('a1')
      expect(snaps).toHaveLength(1)
      expect(snaps[0].strategy.id).toBe('st1')
    })
  })

  describe('allSnapshots / snapshotById / periodReturnsForStrategies', () => {
    it('allSnapshots 排除归档', () => {
      const snaps = engine().allSnapshots()
      expect(snaps.map((s) => s.strategy.id).sort()).toEqual(['st1', 'st3'])
    })

    it('snapshotById', () => {
      const eng = engine()
      expect(eng.snapshotById('st1')?.valueNative).toBe(11_000)
      expect(eng.snapshotById('missing')).toBeNull()
    })

    it('periodReturnsForStrategies', () => {
      const returns = engine().periodReturnsForStrategies([s1])
      expect(returns.length).toBeGreaterThan(0)
      expect(returns.every((r) => r.label.length > 0)).toBe(true)
    })
  })
})
