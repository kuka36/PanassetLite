import { describe, expect, it } from 'vitest'
import { type CashFlow, xirr } from '../xirr'

const DAY_MS = 86400_000

function npvAt(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, f) => {
    const years = (f.occurredAt - t0) / DAY_MS / 365
    return sum + f.amount / Math.pow(1 + rate, years)
  }, 0)
}

describe('xirr', () => {
  it('正常正收益', () => {
    const flows: CashFlow[] = [
      { occurredAt: 0, amount: -10_000 },
      { occurredAt: 365 * DAY_MS, amount: 11_000 },
    ]
    const rate = xirr(flows)
    expect(rate).not.toBeNull()
    expect(rate!).toBeGreaterThan(0.09)
    expect(rate!).toBeLessThan(0.11)
  })

  it('正常负收益', () => {
    const flows: CashFlow[] = [
      { occurredAt: 0, amount: -10_000 },
      { occurredAt: 365 * DAY_MS, amount: 9_000 },
    ]
    const rate = xirr(flows)
    expect(rate).not.toBeNull()
    expect(rate!).toBeLessThan(0)
    expect(rate!).toBeGreaterThan(-0.11)
    expect(rate!).toBeLessThan(-0.09)
  })

  it('少于 2 条现金流返回 null', () => {
    expect(xirr([])).toBeNull()
    expect(xirr([{ occurredAt: 0, amount: -1000 }])).toBeNull()
  })

  it('全同向现金流返回 null', () => {
    expect(
      xirr([
        { occurredAt: 0, amount: -1000 },
        { occurredAt: DAY_MS, amount: -500 },
      ]),
    ).toBeNull()
    expect(
      xirr([
        { occurredAt: 0, amount: 1000 },
        { occurredAt: DAY_MS, amount: 500 },
      ]),
    ).toBeNull()
  })

  it('间隔不足 1 秒返回 null', () => {
    expect(
      xirr([
        { occurredAt: 1000, amount: -1000 },
        { occurredAt: 1500, amount: 1100 },
      ]),
    ).toBeNull()
  })

  it('多现金流（含中途存取）', () => {
    const flows: CashFlow[] = [
      { occurredAt: 0, amount: -10_000 },
      { occurredAt: 90 * DAY_MS, amount: -2_000 },
      { occurredAt: 180 * DAY_MS, amount: 1_500 },
      { occurredAt: 365 * DAY_MS, amount: 11_000 },
    ]
    const rate = xirr(flows)
    expect(rate).not.toBeNull()
    const t0 = Math.min(...flows.map((f) => f.occurredAt))
    expect(Math.abs(npvAt(rate!, flows, t0))).toBeLessThan(1e-5)
  })

  it('极值场景（极端亏损超出搜索范围）', () => {
    const flows: CashFlow[] = [
      { occurredAt: 0, amount: -10_000 },
      { occurredAt: 365 * DAY_MS, amount: 0 },
    ]
    expect(xirr(flows)).toBeNull()
  })

  it('确定性验证：已知 10% 年化', () => {
    const invest = 5000
    const years = 2
    const targetRate = 0.1
    const terminal = invest * Math.pow(1 + targetRate, years)
    const flows: CashFlow[] = [
      { occurredAt: 1_000_000, amount: -invest },
      { occurredAt: 1_000_000 + years * 365 * DAY_MS, amount: terminal },
    ]
    const rate = xirr(flows)
    expect(rate).not.toBeNull()
    expect(rate!).toBeCloseTo(targetRate, 4)
    const t0 = flows[0].occurredAt
    expect(Math.abs(npvAt(rate!, flows, t0))).toBeLessThan(1e-6)
  })
})
