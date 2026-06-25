import type { PeriodReturn } from '../types'
import { type CashFlow, xirr } from './xirr'

const DAY_MS = 86400_000

/**
 * 金额型事件重放的最小接口。
 * Transaction（DEPOSIT/WITHDRAW/INCOME/BORROW/REPAY/VALUATION）和
 * StrategyTransaction（DEPOSIT/WITHDRAW/INCOME/VALUATION）均满足此接口。
 */
export interface ValueTx {
  type: string
  date: string
  amount?: number
  value?: number
}

/**
 * 单步余额更新：将一条金额型事件应用到当前余额上，返回新余额。
 * 供 txLedger 类逐行重放使用，避免 O(n²) 的整体重放。
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

/**
 * 重放金额型事件序列，返回最终余额（原币种，未乘汇率）。
 * txs 须已按 date + createdAt 正序排列，且已过滤到目标日期。
 */
export function replayValueBalance(txs: ReadonlyArray<ValueTx>): number {
  let balance = 0
  for (const tx of txs) {
    balance = applyValueTxStep(balance, tx)
  }
  return balance
}

/**
 * 从金额型流水中提取 XIRR 现金流及总投入/总收回（CNY）。
 * 只有 DEPOSIT（投入）和 WITHDRAW（收回）影响外部现金流；
 * INCOME/VALUATION 属于内部状态变化，不计入现金流。
 */
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
      flows.push({ date: tx.date, amount: amt })
      if (amt < 0) totalIn += -amt
      else totalOut += amt
    }
  }
  return { flows, totalIn, totalOut }
}

/** DEPOSIT +amount / WITHDRAW -amount / 其余 0 */
export function valueTxNetFlow(tx: ValueTx): number {
  if (tx.type === 'DEPOSIT') return tx.amount ?? 0
  if (tx.type === 'WITHDRAW') return -(tx.amount ?? 0)
  return 0
}

/** 两日期间天数（YYYY-MM-DD），不足 1 天返回 0 */
export function daysBetween(startDate: string, endDate: string): number {
  return (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS
}

/** 区间盈亏：剔除存取后的投资增益 */
export function intervalGain(prevBalance: number, currBalance: number, netFlow: number): number {
  return currBalance - prevBalance - netFlow
}

/** 简单收益年化：(gain/base) × (365/days)；base≤0 或 days<1 返回 null */
export function annualizeSimpleReturn(gain: number, base: number, days: number): number | null {
  if (base <= 0 || days < 1) return null
  return (gain / base) * (365 / days)
}

/** 开区间 (startDate, endDate] 内 DEPOSIT/WITHDRAW 净流 */
export function netFlowInOpenInterval(
  txs: ReadonlyArray<ValueTx>,
  startDate: string,
  endDate: string,
): number {
  let netFlow = 0
  for (const tx of txs) {
    if (tx.date <= startDate || tx.date > endDate) continue
    netFlow += valueTxNetFlow(tx)
  }
  return netFlow
}

/** 任意两点区间（snapshot 级 recentAnnualized 用此函数） */
export function intervalMetricsBetweenPoints(
  startValue: number,
  startDate: string,
  endValue: number,
  endDate: string,
  netFlow: number,
): { gain: number; annualized: number | null } {
  const gain = intervalGain(startValue, endValue, netFlow)
  const base = startValue + Math.max(0, netFlow)
  const days = daysBetween(startDate, endDate)
  return { gain, annualized: annualizeSimpleReturn(gain, base, days) }
}

/** 相邻两笔 ledger 步（netFlow 取自 curr 单笔） */
export function intervalMetricsBetweenSteps(
  prevBalance: number,
  prevDate: string,
  currBalance: number,
  currDate: string,
  currTx: ValueTx,
): { gain: number; annualized: number | null } {
  const netFlow = valueTxNetFlow(currTx)
  return intervalMetricsBetweenPoints(prevBalance, prevDate, currBalance, currDate, netFlow)
}

export interface ValueLedgerRow<T extends ValueTx = ValueTx> {
  tx: T
  amountNative: number | null
  balanceAfter: number
  intervalGainNative: number | null
  intervalAnnualized: number | null
}

/**
 * 正序 txs → 带 interval 字段的 ledger 行（调用方负责 reverse 为 newest-first）。
 * txs 须已按 date + createdAt 正序排列。
 */
export function buildValueLedgerRows<T extends ValueTx>(
  txs: ReadonlyArray<T>,
  amountNativeOf: (tx: T) => number | null,
): ValueLedgerRow<T>[] {
  let balance = 0
  let prevBalance: number | null = null
  let prevDate: string | null = null
  const rows: ValueLedgerRow<T>[] = []

  for (const tx of txs) {
    balance = Math.max(0, applyValueTxStep(balance, tx))

    let intervalGainNative: number | null = null
    let intervalAnnualized: number | null = null
    if (prevBalance != null && prevDate != null) {
      const { gain, annualized } = intervalMetricsBetweenSteps(
        prevBalance,
        prevDate,
        balance,
        tx.date,
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
    prevDate = tx.date
  }

  return rows
}

/**
 * 区间收益（本周/本月/今年以来/近一年）的通用计算。
 * 收益 = 区间末盈亏 - 区间初盈亏（盈亏 = 市值 + 累计收回 - 累计投入），
 * 与 totalPnlCNY 同口径，自动剔除区间内的存取/买卖本金变动。
 * valueAt / flowsUpTo 由调用方按其领域语义提供（资产含行情插值，策略为余额重放）。
 */
export function periodReturnsFor<T>(
  items: readonly T[],
  valueAt: (item: T, date: string) => number,
  flowsUpTo: (item: T, date: string) => { in: number; out: number },
  todayStr: string,
): PeriodReturn[] {
  const now = new Date()
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // 各区间的基准日（区间起点的前一天）
  const dow = (now.getDay() + 6) % 7 // 周一=0
  const periods: { key: PeriodReturn['key']; label: string; baseline: Date }[] = [
    { key: 'week', label: '本周', baseline: new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 1) },
    { key: 'month', label: '本月', baseline: new Date(now.getFullYear(), now.getMonth(), 0) },
    { key: 'ytd', label: '今年以来', baseline: new Date(now.getFullYear() - 1, 11, 31) },
    { key: 'year', label: '近一年', baseline: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
  ]

  return periods.map(({ key, label, baseline }) => {
    const b = fmtDate(baseline)
    let pnl = 0
    let baseValue = 0
    let netInflow = 0
    for (const item of items) {
      const v0 = valueAt(item, b)
      const v1 = valueAt(item, todayStr)
      const f0 = flowsUpTo(item, b)
      const f1 = flowsUpTo(item, todayStr)
      pnl += v1 + f1.out - f1.in - (v0 + f0.out - f0.in)
      baseValue += v0
      netInflow += f1.in - f0.in - (f1.out - f0.out)
    }
    const base = baseValue + Math.max(0, netInflow)
    return { key, label, pnlCNY: pnl, ratio: base > 1 ? pnl / base : null }
  })
}

/**
 * 基于最近两次 VALUATION 事件计算区间年化收益率。
 * 扣除区间内 DEPOSIT/WITHDRAW 对余额的影响，与 AssetSnapshot.recentAnnualized 口径相同。
 * txs 须按 date + createdAt 正序排列。
 */
export function recentAnnualizedFromValueTxs(txs: ReadonlyArray<ValueTx>): number | null {
  const vals = txs.filter((t) => t.type === 'VALUATION' && t.value != null)
  if (vals.length < 2) return null
  const v1 = vals[vals.length - 2]
  const v2 = vals[vals.length - 1]
  const netFlow = netFlowInOpenInterval(txs, v1.date, v2.date)
  return intervalMetricsBetweenPoints(
    v1.value ?? 0,
    v1.date,
    v2.value ?? 0,
    v2.date,
    netFlow,
  ).annualized
}

/**
 * 计算金额型资产/策略的快照数值（市值、净投入、盈亏、XIRR）。
 * fxRate: 1 单位原币种 = ? CNY
 * today: YYYY-MM-DD，用于 XIRR 终态现金流
 */
export function snapshotFromValueTxs(
  txs: ReadonlyArray<ValueTx>,
  fxRate: number,
  todayStr: string,
): {
  valueCNY: number
  valueNative: number
  netInvestedCNY: number
  totalPnlCNY: number
  xirr: number | null
  recentAnnualized: number | null
  lastUpdated: string | undefined
} {
  const sorted = [...txs].sort(
    (a, b) => a.date.localeCompare(b.date),
  )
  const valueNative = Math.max(0, replayValueBalance(sorted))
  const valueCNY = valueNative * fxRate

  const { flows, totalIn, totalOut } = buildValueFlows(sorted, fxRate)
  const netInvestedCNY = totalIn - totalOut
  const totalPnlCNY = valueCNY + totalOut - totalIn

  let rate: number | null = null
  if (flows.length > 0 || valueCNY > 0) {
    rate = xirr([...flows, { date: todayStr, amount: valueCNY }])
  }

  const recentAnn = recentAnnualizedFromValueTxs(sorted)
  const lastUpdated = sorted.length > 0 ? sorted[sorted.length - 1].date : undefined

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
