import type { PeriodReturn } from '../types'
import { endOfDay } from '../utils/time'
import { type CashFlow, xirr } from './xirr'

const DAY_MS = 86400_000
const MIN_SPAN_MS = 1000

/**
 * 金额型事件重放的最小接口。
 * Transaction（DEPOSIT/WITHDRAW/INCOME/BORROW/REPAY/VALUATION）和
 * StrategyTransaction（DEPOSIT/WITHDRAW/INCOME/VALUATION）均满足此接口。
 */
export interface ValueTx {
  type: string
  occurredAt: number
  amount?: number
  value?: number
}

export function compareValueTx(a: ValueTx, b: ValueTx): number {
  return a.occurredAt - b.occurredAt
}

/**
 * 单步余额更新：将一条金额型事件应用到当前余额上，返回新余额。
 */
export function applyValueTxStep(
  balance: number,
  tx: { type: string; amount?: number; value?: number },
): number {
  switch (tx.type) {
    case 'DEPOSIT':
    case 'INCOME':
    case 'BORROW':
      return balance + (tx.amount ?? 0)
    case 'WITHDRAW':
    case 'REPAY':
      return balance - (tx.amount ?? 0)
    case 'VALUATION':
      return tx.value ?? balance
    default:
      return balance
  }
}

/** 重放金额型事件序列，返回最终余额（原币种，未乘汇率）。 */
export function replayValueBalance(txs: ReadonlyArray<ValueTx>): number {
  let balance = 0
  for (const tx of txs) {
    balance = applyValueTxStep(balance, tx)
  }
  return balance
}

export function buildValueFlows(
  txs: ReadonlyArray<ValueTx>,
  fxRate: number,
): { flows: CashFlow[]; totalIn: number; totalOut: number } {
  const flows: CashFlow[] = []
  let totalIn = 0
  let totalOut = 0
  for (const tx of txs) {
    let amt = 0
    if (tx.type === 'DEPOSIT') amt = -(tx.amount ?? 0) * fxRate
    if (tx.type === 'WITHDRAW') amt = (tx.amount ?? 0) * fxRate
    if (amt !== 0) {
      flows.push({ occurredAt: tx.occurredAt, amount: amt })
      if (amt < 0) totalIn += -amt
      else totalOut += amt
    }
  }
  return { flows, totalIn, totalOut }
}

export function valueTxNetFlow(tx: ValueTx): number {
  if (tx.type === 'DEPOSIT') return tx.amount ?? 0
  if (tx.type === 'WITHDRAW') return -(tx.amount ?? 0)
  return 0
}

export function msBetween(startAt: number, endAt: number): number {
  return endAt - startAt
}

export function intervalGain(prevBalance: number, currBalance: number, netFlow: number): number {
  return currBalance - prevBalance - netFlow
}

export function annualizeSimpleReturn(gain: number, base: number, spanMs: number): number | null {
  if (base <= 0 || spanMs < MIN_SPAN_MS) return null
  return (gain / base) * ((DAY_MS / spanMs) * 365)
}

export function netFlowInOpenInterval(
  txs: ReadonlyArray<ValueTx>,
  startAt: number,
  endAt: number,
): number {
  let netFlow = 0
  for (const tx of txs) {
    if (tx.occurredAt <= startAt || tx.occurredAt > endAt) continue
    netFlow += valueTxNetFlow(tx)
  }
  return netFlow
}

export function intervalMetricsBetweenPoints(
  startValue: number,
  startAt: number,
  endValue: number,
  endAt: number,
  netFlow: number,
): { gain: number; annualized: number | null } {
  const gain = intervalGain(startValue, endValue, netFlow)
  const base = startValue + Math.max(0, netFlow)
  const spanMs = msBetween(startAt, endAt)
  return { gain, annualized: annualizeSimpleReturn(gain, base, spanMs) }
}

export function intervalMetricsBetweenSteps(
  prevBalance: number,
  prevAt: number,
  currBalance: number,
  currAt: number,
  currTx: ValueTx,
): { gain: number; annualized: number | null } {
  const netFlow = valueTxNetFlow(currTx)
  return intervalMetricsBetweenPoints(prevBalance, prevAt, currBalance, currAt, netFlow)
}

export interface ValueLedgerRow<T extends ValueTx = ValueTx> {
  tx: T
  amountNative: number | null
  balanceAfter: number
  intervalGainNative: number | null
  intervalAnnualized: number | null
}

export function buildValueLedgerRows<T extends ValueTx>(
  txs: ReadonlyArray<T>,
  amountNativeOf: (tx: T) => number | null,
): ValueLedgerRow<T>[] {
  let balance = 0
  let prevBalance: number | null = null
  let prevAt: number | null = null
  const rows: ValueLedgerRow<T>[] = []

  for (const tx of txs) {
    balance = Math.max(0, applyValueTxStep(balance, tx))

    let intervalGainNative: number | null = null
    let intervalAnnualized: number | null = null
    if (prevBalance != null && prevAt != null) {
      const { gain, annualized } = intervalMetricsBetweenSteps(
        prevBalance,
        prevAt,
        balance,
        tx.occurredAt,
        tx,
      )
      intervalGainNative = gain
      intervalAnnualized = annualized
    }

    rows.push({
      tx,
      amountNative: amountNativeOf(tx),
      balanceAfter: balance,
      intervalGainNative,
      intervalAnnualized,
    })

    prevBalance = balance
    prevAt = tx.occurredAt
  }

  return rows
}

export function periodReturnsFor<T>(
  items: readonly T[],
  valueAt: (item: T, atMs: number) => number,
  flowsUpTo: (item: T, atMs: number) => { in: number; out: number },
  nowMs: number,
): PeriodReturn[] {
  const now = new Date(nowMs)
  const dow = (now.getDay() + 6) % 7
  const periods: { key: PeriodReturn['key']; label: string; baseline: Date }[] = [
    { key: 'week', label: '本周', baseline: new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 1) },
    { key: 'month', label: '本月', baseline: new Date(now.getFullYear(), now.getMonth(), 0) },
    { key: 'ytd', label: '今年以来', baseline: new Date(now.getFullYear() - 1, 11, 31) },
    { key: 'year', label: '近一年', baseline: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
  ]

  return periods.map(({ key, label, baseline }) => {
    const baselineMs = endOfDay(baseline.getTime())
    let pnl = 0
    let baseValue = 0
    let netInflow = 0
    for (const item of items) {
      const v0 = valueAt(item, baselineMs)
      const v1 = valueAt(item, nowMs)
      const f0 = flowsUpTo(item, baselineMs)
      const f1 = flowsUpTo(item, nowMs)
      pnl += v1 + f1.out - f1.in - (v0 + f0.out - f0.in)
      baseValue += v0
      netInflow += f1.in - f0.in - (f1.out - f0.out)
    }
    const base = baseValue + Math.max(0, netInflow)
    return { key, label, pnlCNY: pnl, ratio: base > 1 ? pnl / base : null }
  })
}

export function recentAnnualizedFromValueTxs(txs: ReadonlyArray<ValueTx>): number | null {
  const vals = txs.filter((t) => t.type === 'VALUATION' && t.value != null)
  if (vals.length < 2) return null
  const v1 = vals[vals.length - 2]
  const v2 = vals[vals.length - 1]
  const netFlow = netFlowInOpenInterval(txs, v1.occurredAt, v2.occurredAt)
  return intervalMetricsBetweenPoints(
    v1.value ?? 0,
    v1.occurredAt,
    v2.value ?? 0,
    v2.occurredAt,
    netFlow,
  ).annualized
}

export function snapshotFromValueTxs(
  txs: ReadonlyArray<ValueTx>,
  fxRate: number,
  terminalAtMs: number,
): {
  valueCNY: number
  valueNative: number
  netInvestedCNY: number
  totalPnlCNY: number
  xirr: number | null
  recentAnnualized: number | null
  lastUpdated: number | undefined
} {
  const sorted = [...txs].sort(compareValueTx)
  const valueNative = Math.max(0, replayValueBalance(sorted))
  const valueCNY = valueNative * fxRate

  const { flows, totalIn, totalOut } = buildValueFlows(sorted, fxRate)
  const netInvestedCNY = totalIn - totalOut
  const totalPnlCNY = valueCNY + totalOut - totalIn

  let rate: number | null = null
  if (flows.length > 0 || valueCNY > 0) {
    rate = xirr([...flows, { occurredAt: terminalAtMs, amount: valueCNY }])
  }

  const recentAnn = recentAnnualizedFromValueTxs(sorted)
  const lastUpdated = sorted.at(-1)?.occurredAt

  return {
    valueCNY,
    valueNative,
    netInvestedCNY,
    totalPnlCNY,
    xirr: rate,
    recentAnnualized: recentAnn,
    lastUpdated,
  }
}
