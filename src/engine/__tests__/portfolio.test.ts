import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortfolioEngine } from '../portfolio'
import { asset, emptyPrices, NOW, settings, T0, T1, T2, tx } from './helpers'

describe('PortfolioEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('乱序流水按时间排序', () => {
      const a = asset({ id: 'a1', type: 'cash' })
      const engine = new PortfolioEngine(
        [a],
        [
          tx({ id: 't3', assetId: 'a1', type: 'DEPOSIT', occurredAt: T2, amount: 300 }),
          tx({ id: 't1', assetId: 'a1', type: 'DEPOSIT', occurredAt: T0, amount: 100 }),
          tx({ id: 't2', assetId: 'a1', type: 'DEPOSIT', occurredAt: T1, amount: 200 }),
        ],
        emptyPrices,
        settings(),
      )
      const ledger = engine.txLedger(a)
      expect(ledger.map((r) => r.tx.id)).toEqual(['t3', 't2', 't1'])
      expect(ledger[0].balanceAfter).toBe(600)
    })
  })

  describe('fx()', () => {
    it('本币=1', () => {
      const engine = new PortfolioEngine([], [], emptyPrices, settings({ baseCurrency: 'CNY' }))
      expect(engine.fx('CNY')).toBe(1)
    })

    it('外币汇率', () => {
      const engine = new PortfolioEngine([], [], emptyPrices, settings({ fxRates: { USD: 7.5 } }))
      expect(engine.fx('USD')).toBe(7.5)
    })

    it('未知货币默认 1', () => {
      const engine = new PortfolioEngine([], [], emptyPrices, settings())
      expect(engine.fx('JPY')).toBe(1)
    })
  })

  describe('valueAt 数量型', () => {
    const stock = asset({ id: 's1', type: 'stock', currency: 'USD', symbol: 'AAPL' })

    it('BUY/SELL 持仓与买卖价', () => {
      const engine = new PortfolioEngine(
        [stock],
        [
          tx({ id: 'b1', assetId: 's1', type: 'BUY', occurredAt: T0, quantity: 10, price: 100 }),
          tx({ id: 's1', assetId: 's1', type: 'SELL', occurredAt: T1, quantity: 3, price: 110 }),
        ],
        emptyPrices,
        settings({ fxRates: { USD: 7 } }),
      )
      expect(engine.valueAt(stock, T0)).toBeCloseTo(10 * 100 * 7, 4)
      expect(engine.valueAt(stock, T1)).toBeCloseTo(7 * 7 * 110, 4)
    })

    it('空持仓返回 0', () => {
      const engine = new PortfolioEngine([stock], [], emptyPrices, settings())
      expect(engine.valueAt(stock, NOW)).toBe(0)
    })

    it('行情价格插值', () => {
      const engine = new PortfolioEngine(
        [stock],
        [tx({ id: 'b1', assetId: 's1', type: 'BUY', occurredAt: T0, quantity: 10, price: 100 })],
        { AAPL: { '2024-01-01': 100, '2024-07-01': 120 } },
        settings(),
      )
      const mid = T0 + (T1 - T0) / 2
      const value = engine.valueAt(stock, mid)
      expect(value).toBeGreaterThan(1000)
      expect(value).toBeLessThan(1200)
    })
  })

  describe('valueAt 金额型', () => {
    const cash = asset({ id: 'c1', type: 'cash' })
    const wealth = asset({ id: 'w1', type: 'wealth', currency: 'USD' })

    it('存取与 VALUATION', () => {
      const engine = new PortfolioEngine(
        [cash],
        [
          tx({ id: 'd1', assetId: 'c1', type: 'DEPOSIT', occurredAt: T0, amount: 1000 }),
          tx({ id: 'v1', assetId: 'c1', type: 'VALUATION', occurredAt: T1, value: 1200 }),
          tx({ id: 'w1', assetId: 'c1', type: 'WITHDRAW', occurredAt: T2, amount: 200 }),
        ],
        emptyPrices,
        settings(),
      )
      expect(engine.valueAt(cash, T1)).toBe(1200)
      expect(engine.valueAt(cash, T2)).toBe(1000)
    })

    it('非负余额与汇率', () => {
      const engine = new PortfolioEngine(
        [wealth],
        [tx({ id: 'd1', assetId: 'w1', type: 'DEPOSIT', occurredAt: T0, amount: 100 })],
        emptyPrices,
        settings({ fxRates: { USD: 7 } }),
      )
      expect(engine.valueAt(wealth, T0)).toBe(700)
    })
  })

  describe('valueAt 负债', () => {
    const debt = asset({ id: 'd1', type: 'debt' })

    it('BORROW/REPAY', () => {
      const engine = new PortfolioEngine(
        [debt],
        [
          tx({ id: 'b1', assetId: 'd1', type: 'BORROW', occurredAt: T0, amount: 500_000 }),
          tx({ id: 'r1', assetId: 'd1', type: 'REPAY', occurredAt: T1, amount: 50_000 }),
        ],
        emptyPrices,
        settings(),
      )
      expect(engine.valueAt(debt, T0)).toBe(500_000)
      expect(engine.valueAt(debt, T1)).toBe(450_000)
    })
  })

  describe('snapshot', () => {
    it('股票全字段', () => {
      const stock = asset({ id: 's1', type: 'stock', symbol: 'TEST' })
      const engine = new PortfolioEngine(
        [stock],
        [tx({ id: 'b1', assetId: 's1', type: 'BUY', occurredAt: T0, quantity: 5, price: 200 })],
        emptyPrices,
        settings(),
      )
      const snap = engine.snapshot(stock)
      expect(snap.quantity).toBe(5)
      expect(snap.valueCNY).toBe(1000)
      expect(snap.valueNative).toBe(1000)
      expect(snap.unitPrice).toBe(200)
      expect(snap.netInvestedCNY).toBe(1000)
      expect(snap.totalPnlCNY).toBe(0)
      expect(snap.lastUpdated).toBe(T0)
    })

    it('理财估值', () => {
      const wealth = asset({ id: 'w1', type: 'wealth' })
      const engine = new PortfolioEngine(
        [wealth],
        [
          tx({ id: 'd1', assetId: 'w1', type: 'DEPOSIT', occurredAt: T0, amount: 10_000 }),
          tx({ id: 'v1', assetId: 'w1', type: 'VALUATION', occurredAt: T1, value: 10_500 }),
          tx({ id: 'v2', assetId: 'w1', type: 'VALUATION', occurredAt: T2, value: 11_000 }),
        ],
        emptyPrices,
        settings(),
      )
      const snap = engine.snapshot(wealth)
      expect(snap.valueCNY).toBe(11_000)
      expect(snap.totalPnlCNY).toBe(1000)
      expect(snap.recentAnnualized).not.toBeNull()
    })

    it('负债 PnL=0', () => {
      const debt = asset({ id: 'd1', type: 'debt' })
      const engine = new PortfolioEngine(
        [debt],
        [tx({ id: 'b1', assetId: 'd1', type: 'BORROW', occurredAt: T0, amount: 100_000 })],
        emptyPrices,
        settings(),
      )
      const snap = engine.snapshot(debt)
      expect(snap.valueCNY).toBe(100_000)
      expect(snap.totalPnlCNY).toBe(0)
      expect(snap.xirr).toBeNull()
    })
  })

  describe('summary', () => {
    it('多资产汇总 / 归档排除 / 净资产', () => {
      const cash = asset({ id: 'c1', type: 'cash', name: '现金' })
      const debt = asset({ id: 'd1', type: 'debt', name: '房贷' })
      const archived = asset({ id: 'a1', type: 'cash', name: '已归档', archived: true })
      const engine = new PortfolioEngine(
        [cash, debt, archived],
        [
          tx({ id: 'c1', assetId: 'c1', type: 'DEPOSIT', occurredAt: T0, amount: 100_000 }),
          tx({ id: 'd1', assetId: 'd1', type: 'BORROW', occurredAt: T0, amount: 300_000 }),
          tx({ id: 'a1', assetId: 'a1', type: 'DEPOSIT', occurredAt: T0, amount: 999_999 }),
        ],
        emptyPrices,
        settings(),
      )
      const sum = engine.summary()
      expect(sum.totalAssetsCNY).toBe(100_000)
      expect(sum.totalDebtCNY).toBe(300_000)
      expect(sum.netWorthCNY).toBe(-200_000)
      expect(sum.snapshots).toHaveLength(2)
      expect(sum.snapshots.every((s) => !s.asset.archived)).toBe(true)
    })
  })

  describe('txLedger', () => {
    it('倒序展示', () => {
      const cash = asset({ id: 'c1', type: 'cash' })
      const engine = new PortfolioEngine(
        [cash],
        [
          tx({ id: 't1', assetId: 'c1', type: 'DEPOSIT', occurredAt: T0, amount: 100 }),
          tx({ id: 't2', assetId: 'c1', type: 'DEPOSIT', occurredAt: T1, amount: 50 }),
        ],
        emptyPrices,
        settings(),
      )
      const ledger = engine.txLedger(cash)
      expect(ledger.map((r) => r.tx.id)).toEqual(['t2', 't1'])
    })

    it('数量型 balanceLabel=quantity', () => {
      const stock = asset({ id: 's1', type: 'stock' })
      const engine = new PortfolioEngine(
        [stock],
        [tx({ id: 'b1', assetId: 's1', type: 'BUY', occurredAt: T0, quantity: 10, price: 50 })],
        emptyPrices,
        settings(),
      )
      const ledger = engine.txLedger(stock)
      expect(ledger[0].balanceLabel).toBe('quantity')
      expect(ledger[0].balanceAfter).toBe(10)
    })

    it('金额型 balanceLabel=value', () => {
      const cash = asset({ id: 'c1', type: 'cash' })
      const engine = new PortfolioEngine(
        [cash],
        [tx({ id: 'd1', assetId: 'c1', type: 'DEPOSIT', occurredAt: T0, amount: 500 })],
        emptyPrices,
        settings(),
      )
      const ledger = engine.txLedger(cash)
      expect(ledger[0].balanceLabel).toBe('value')
      expect(ledger[0].balanceAfter).toBe(500)
    })

    it('负债型 balanceLabel=debt', () => {
      const debt = asset({ id: 'd1', type: 'debt' })
      const engine = new PortfolioEngine(
        [debt],
        [tx({ id: 'b1', assetId: 'd1', type: 'BORROW', occurredAt: T0, amount: 1000 })],
        emptyPrices,
        settings(),
      )
      const ledger = engine.txLedger(debt)
      expect(ledger[0].balanceLabel).toBe('debt')
      expect(ledger[0].balanceAfter).toBe(1000)
    })
  })
})
