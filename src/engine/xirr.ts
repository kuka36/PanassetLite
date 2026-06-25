/** 现金流:负数为投入,正数为收回 */
export interface CashFlow {
  occurredAt: number
  amount: number
}

const DAY_MS = 86400_000
const MIN_SPAN_MS = 1000

function npv(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, f) => {
    const years = (f.occurredAt - t0) / DAY_MS / 365
    return sum + f.amount / Math.pow(1 + rate, years)
  }, 0)
}

/**
 * 年化内部收益率(XIRR),二分法求解,稳健优先。
 * 返回 null 表示无解(如全为同向现金流或间隔不足 1 秒)。
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null
  const hasNeg = flows.some((f) => f.amount < -1e-9)
  const hasPos = flows.some((f) => f.amount > 1e-9)
  if (!hasNeg || !hasPos) return null

  const t0 = Math.min(...flows.map((f) => f.occurredAt))
  const span = Math.max(...flows.map((f) => f.occurredAt)) - t0
  if (span < MIN_SPAN_MS) return null

  let lo = -0.9999
  let hi = 10
  let fLo = npv(lo, flows, t0)
  const fHi = npv(hi, flows, t0)
  if (fLo * fHi > 0) return null

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const fMid = npv(mid, flows, t0)
    if (Math.abs(fMid) < 1e-7) return mid
    if (fLo * fMid < 0) {
      hi = mid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}
