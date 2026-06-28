import { describe, expect, it } from 'vitest'
import {
  applyValueTxStep,
  buildValueFlows,
  buildValueLedgerRows,
  intervalMetricsBetweenPoints,
  netFlowInOpenInterval,
  recentAnnualizedFromValueTxs,
  replayValueBalance,
  snapshotFromValueTxs,
  valueTxNetFlow,
  type ValueTx,
} from '../replayValue'
import { T0, T1, T2, NOW } from './helpers'

describe('applyValueTxStep', () => {
  it('DEPOSIT 增加余额', () => {
    expect(applyValueTxStep(100, { type: 'DEPOSIT', amount: 50 })).toBe(150)
  })

  it('WITHDRAW 减少余额', () => {
    expect(applyValueTxStep(100, { type: 'WITHDRAW', amount: 30 })).toBe(70)
  })

  it('INCOME 增加余额', () => {
    expect(applyValueTxStep(100, { type: 'INCOME', amount: 20 })).toBe(120)
  })

  it('BORROW 增加余额', () => {
    expect(applyValueTxStep(0, { type: 'BORROW', amount: 1000 })).toBe(1000)
  })

  it('REPAY 减少余额', () => {
    expect(applyValueTxStep(1000, { type: 'REPAY', amount: 200 })).toBe(800)
  })

  it('VALUATION 覆盖余额', () => {
    expect(applyValueTxStep(100, { type: 'VALUATION', value: 250 })).toBe(250)
    expect(applyValueTxStep(100, { type: 'VALUATION' })).toBe(100)
  })

  it('未知类型保持余额', () => {
    expect(applyValueTxStep(100, { type: 'BUY', amount: 50 })).toBe(100)
  })
})

describe('replayValueBalance', () => {
  it('空列表返回 0', () => {
    expect(replayValueBalance([])).toBe(0)
  })

  it('按序重放现金流', () => {
    const txs: ValueTx[] = [
      { type: 'DEPOSIT', occurredAt: T0, amount: 1000 },
      { type: 'WITHDRAW', occurredAt: T1, amount: 200 },
      { type: 'INCOME', occurredAt: T2, amount: 50 },
    ]
    expect(replayValueBalance(txs)).toBe(850)
  })

  it('VALUATION 覆盖后续余额', () => {
    const txs: ValueTx[] = [
      { type: 'DEPOSIT', occurredAt: T0, amount: 1000 },
      { type: 'VALUATION', occurredAt: T1, value: 1200 },
      { type: 'WITHDRAW', occurredAt: T2, amount: 100 },
    ]
    expect(replayValueBalance(txs)).toBe(1100)
  })
})

describe('buildValueFlows', () => {
  it('存入为负现金流、取出为正现金流并乘 fx', () => {
    const txs: ValueTx[] = [
      { type: 'DEPOSIT', occurredAt: T0, amount: 100 },
      { type: 'WITHDRAW', occurredAt: T1, amount: 40 },
    ]
    const { flows, totalIn, totalOut } = buildValueFlows(txs, 7)
    expect(flows).toEqual([
      { occurredAt: T0, amount: -700 },
      { occurredAt: T1, amount: 280 },
    ])
    expect(totalIn).toBe(700)
    expect(totalOut).toBe(280)
  })

  it('非 DEPOSIT/WITHDRAW 类型忽略', () => {
    const txs: ValueTx[] = [
      { type: 'INCOME', occurredAt: T0, amount: 50 },
      { type: 'VALUATION', occurredAt: T1, value: 200 },
      { type: 'BORROW', occurredAt: T2, amount: 1000 },
    ]
    const { flows, totalIn, totalOut } = buildValueFlows(txs, 1)
    expect(flows).toEqual([])
    expect(totalIn).toBe(0)
    expect(totalOut).toBe(0)
  })
})

describe('valueTxNetFlow / netFlowInOpenInterval', () => {
  const txs: ValueTx[] = [
    { type: 'DEPOSIT', occurredAt: T0, amount: 1000 },
    { type: 'WITHDRAW', occurredAt: T1, amount: 200 },
    { type: 'DEPOSIT', occurredAt: T2, amount: 300 },
  ]

  it('valueTxNetFlow', () => {
    expect(valueTxNetFlow(txs[0])).toBe(1000)
    expect(valueTxNetFlow(txs[1])).toBe(-200)
    expect(valueTxNetFlow({ type: 'VALUATION', occurredAt: T0, value: 100 })).toBe(0)
  })

  it('netFlowInOpenInterval 开区间 (start, end]', () => {
    expect(netFlowInOpenInterval(txs, T0, T1)).toBe(-200)
    expect(netFlowInOpenInterval(txs, T0, T2)).toBe(100)
    expect(netFlowInOpenInterval(txs, T1, T2)).toBe(300)
  })
})

describe('intervalMetricsBetweenPoints', () => {
  it('正常区间指标', () => {
    const span = 365 * 86400_000
    const { gain, annualized } = intervalMetricsBetweenPoints(1000, T0, 1100, T0 + span, 0)
    expect(gain).toBe(100)
    expect(annualized).not.toBeNull()
    expect(annualized!).toBeCloseTo(0.1, 4)
  })

  it('base≤0 时 annualized 为 null', () => {
    const { gain, annualized } = intervalMetricsBetweenPoints(0, T0, 100, T1, -500)
    expect(gain).toBe(600)
    expect(annualized).toBeNull()
  })
})

describe('buildValueLedgerRows', () => {
  it('余额与区间指标', () => {
    const txs: ValueTx[] = [
      { type: 'DEPOSIT', occurredAt: T0, amount: 1000 },
      { type: 'VALUATION', occurredAt: T1, value: 1100 },
      { type: 'VALUATION', occurredAt: T2, value: 1210 },
    ]
    const rows = buildValueLedgerRows(txs, (tx) => (tx.type === 'VALUATION' ? tx.value ?? null : tx.amount ?? null))
    expect(rows).toHaveLength(3)
    expect(rows[0].balanceAfter).toBe(1000)
    expect(rows[0].intervalGainNative).toBeNull()
    expect(rows[1].balanceAfter).toBe(1100)
    expect(rows[1].intervalGainNative).toBe(100)
    expect(rows[2].balanceAfter).toBe(1210)
    expect(rows[2].intervalGainNative).toBe(110)
  })
})

describe('recentAnnualizedFromValueTxs', () => {
  it('少于 2 条 VALUATION 返回 null', () => {
    expect(recentAnnualizedFromValueTxs([])).toBeNull()
    expect(
      recentAnnualizedFromValueTxs([{ type: 'VALUATION', occurredAt: T0, value: 100 }]),
    ).toBeNull()
  })

  it('有净流时计入区间指标', () => {
    const txs: ValueTx[] = [
      { type: 'DEPOSIT', occurredAt: T0, amount: 1000 },
      { type: 'VALUATION', occurredAt: T1, value: 1000 },
      { type: 'DEPOSIT', occurredAt: T1 + 1000, amount: 500 },
      { type: 'VALUATION', occurredAt: T2, value: 1650 },
    ]
    const ann = recentAnnualizedFromValueTxs(txs)
    expect(ann).not.toBeNull()
    expect(ann!).toBeGreaterThan(0)
  })

  it('无净流时按估值变化计算', () => {
    const span = 365 * 86400_000
    const txs: ValueTx[] = [
      { type: 'VALUATION', occurredAt: T0, value: 1000 },
      { type: 'VALUATION', occurredAt: T0 + span, value: 1100 },
    ]
    const ann = recentAnnualizedFromValueTxs(txs)
    expect(ann).not.toBeNull()
    expect(ann!).toBeCloseTo(0.1, 3)
  })
})

describe('snapshotFromValueTxs', () => {
  it('完整快照', () => {
    const txs: ValueTx[] = [
      { type: 'DEPOSIT', occurredAt: T0, amount: 10_000 },
      { type: 'VALUATION', occurredAt: T1, value: 10_500 },
      { type: 'VALUATION', occurredAt: T2, value: 11_000 },
    ]
    const snap = snapshotFromValueTxs(txs, 1, NOW)
    expect(snap.valueNative).toBe(11_000)
    expect(snap.valueCNY).toBe(11_000)
    expect(snap.netInvestedCNY).toBe(10_000)
    expect(snap.totalPnlCNY).toBe(1000)
    expect(snap.xirr).not.toBeNull()
    expect(snap.recentAnnualized).not.toBeNull()
    expect(snap.lastUpdated).toBe(T2)
  })

  it('空流水', () => {
    const snap = snapshotFromValueTxs([], 1, NOW)
    expect(snap.valueNative).toBe(0)
    expect(snap.valueCNY).toBe(0)
    expect(snap.netInvestedCNY).toBe(0)
    expect(snap.totalPnlCNY).toBe(0)
    expect(snap.xirr).toBeNull()
    expect(snap.recentAnnualized).toBeNull()
    expect(snap.lastUpdated).toBeUndefined()
  })
})
