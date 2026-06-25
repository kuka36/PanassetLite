import type {
  Asset,
  AssetSnapshot,
  AssetType,
  PeriodReturn,
  PortfolioSummary,
  PriceHistory,
  Settings,
  Transaction,
  TxLedgerRow,
} from '../types'
import { isQuantityBased } from '../types'
import { endOfDay, endOfDayFromDateKey, formatDateKey, startOfDay, todayEndMs } from '../utils/time'
import { xirr, type CashFlow } from './xirr'
import { applyValueTxStep, buildValueFlows, buildValueLedgerRows, compareValueTx, periodReturnsFor, recentAnnualizedFromValueTxs } from './replayValue'

const DAY_MS = 86400_000

export class PortfolioEngine {
  private txByAsset = new Map<string, Transaction[]>()
  private assets: Asset[]
  private prices: PriceHistory
  private settings: Settings

  constructor(
    assets: Asset[],
    transactions: Transaction[],
    prices: PriceHistory,
    settings: Settings,
  ) {
    this.assets = assets
    this.prices = prices
    this.settings = settings
    const sorted = [...transactions].sort(compareValueTx)
    for (const tx of sorted) {
      const list = this.txByAsset.get(tx.assetId) ?? []
      list.push(tx)
      this.txByAsset.set(tx.assetId, list)
    }
  }

  fx(currency: string): number {
    if (currency === this.settings.baseCurrency) return 1
    return this.settings.fxRates[currency] ?? 1
  }

  private quantityAt(assetId: string, atMs: number): number {
    let qty = 0
    for (const tx of this.txByAsset.get(assetId) ?? []) {
      if (tx.occurredAt > atMs) break
      if (tx.type === 'BUY') qty += tx.quantity ?? 0
      if (tx.type === 'SELL') qty -= tx.quantity ?? 0
    }
    return qty
  }

  private pricePoints(asset: Asset): Array<[number, number]> {
    const fx = this.fx(asset.currency)
    const points = new Map<number, number>()
    for (const tx of this.txByAsset.get(asset.id) ?? []) {
      if ((tx.type === 'BUY' || tx.type === 'SELL') && tx.price != null) {
        points.set(tx.occurredAt, tx.price * fx)
      }
      if (tx.type === 'VALUATION' && tx.value != null) {
        const qty = this.quantityAt(asset.id, tx.occurredAt)
        if (qty > 0) points.set(tx.occurredAt, (tx.value / qty) * fx)
      }
    }
    if (asset.symbol) {
      for (const [date, price] of Object.entries(this.prices[asset.symbol] ?? {})) {
        points.set(endOfDayFromDateKey(date), price)
      }
    }
    return [...points.entries()].sort((a, b) => a[0] - b[0])
  }

  private priceAt(points: Array<[number, number]>, atMs: number): number {
    if (points.length === 0) return 0
    if (atMs <= points[0][0]) return points[0][1]
    if (atMs >= points[points.length - 1][0]) return points[points.length - 1][1]
    for (let i = 1; i < points.length; i++) {
      if (atMs <= points[i][0]) {
        const [t0, p0] = points[i - 1]
        const [t1, p1] = points[i]
        const ratio = t1 === t0 ? 0 : (atMs - t0) / (t1 - t0)
        return p0 + (p1 - p0) * ratio
      }
    }
    return points[points.length - 1][1]
  }

  valueAt(asset: Asset, atMs: number): number {
    const txs = (this.txByAsset.get(asset.id) ?? []).filter((t) => t.occurredAt <= atMs)
    const fx = this.fx(asset.currency)

    if (isQuantityBased(asset.type)) {
      const qty = this.quantityAt(asset.id, atMs)
      if (qty <= 0) return 0
      return qty * this.priceAt(this.pricePoints(asset), atMs)
    }

    let value = 0
    for (const tx of txs) {
      value = applyValueTxStep(value, tx)
    }
    return Math.max(0, value) * fx
  }

  snapshot(asset: Asset): AssetSnapshot {
    const txs = this.txByAsset.get(asset.id) ?? []
    const fx = this.fx(asset.currency)
    const nowMs = Date.now()
    const quantity = isQuantityBased(asset.type) ? this.quantityAt(asset.id, nowMs) : 0
    const valueCNY = this.valueAt(asset, nowMs)
    const valueNative = fx === 0 ? 0 : valueCNY / fx

    let flows: CashFlow[]
    let totalIn: number
    let totalOut: number
    if (isQuantityBased(asset.type)) {
      flows = []
      totalIn = 0
      totalOut = 0
      for (const tx of txs) {
        let amt = 0
        if (tx.type === 'BUY') amt = -(tx.quantity ?? 0) * (tx.price ?? 0) * fx
        if (tx.type === 'SELL') amt = (tx.quantity ?? 0) * (tx.price ?? 0) * fx
        if (amt !== 0) {
          flows.push({ occurredAt: tx.occurredAt, amount: amt })
          if (amt < 0) totalIn += -amt
          else totalOut += amt
        }
      }
    } else {
      ;({ flows, totalIn, totalOut } = buildValueFlows(txs, fx))
    }

    const isDebt = asset.type === 'debt'
    const netInvestedCNY = totalIn - totalOut
    const totalPnlCNY = isDebt ? 0 : valueCNY + totalOut - totalIn

    let rate: number | null = null
    if (!isDebt && (flows.length > 0 || valueCNY > 0)) {
      rate = xirr([...flows, { occurredAt: nowMs, amount: valueCNY }])
    }

    const lastUpdated = this.lastUpdatedAt(asset)
    const recentAnnualized = this.recentAnnualized(asset)

    const unitPrice = isQuantityBased(asset.type)
      ? this.priceAt(this.pricePoints(asset), nowMs) / (fx || 1)
      : undefined

    return {
      asset,
      quantity,
      valueCNY: isDebt ? valueCNY : valueCNY,
      valueNative,
      unitPrice,
      netInvestedCNY,
      totalPnlCNY,
      xirr: rate,
      lastUpdated,
      recentAnnualized,
    }
  }

  private lastUpdatedAt(asset: Asset): number | undefined {
    let last: number | undefined
    for (const tx of this.txByAsset.get(asset.id) ?? []) {
      if (last == null || tx.occurredAt > last) last = tx.occurredAt
    }
    if (asset.symbol) {
      for (const d of Object.keys(this.prices[asset.symbol] ?? {})) {
        const at = endOfDayFromDateKey(d)
        if (last == null || at > last) last = at
      }
    }
    return last
  }

  private recentAnnualized(asset: Asset): number | null {
    if (isQuantityBased(asset.type) || asset.type === 'debt') return null
    return recentAnnualizedFromValueTxs(this.txByAsset.get(asset.id) ?? [])
  }

  private txAmountNative(tx: Transaction): number | null {
    if (tx.type === 'BUY' || tx.type === 'SELL') {
      if (tx.quantity != null && tx.price != null) return tx.quantity * tx.price
      return null
    }
    if (
      tx.type === 'DEPOSIT' ||
      tx.type === 'WITHDRAW' ||
      tx.type === 'INCOME' ||
      tx.type === 'BORROW' ||
      tx.type === 'REPAY'
    ) {
      return tx.amount ?? null
    }
    if (tx.type === 'VALUATION') return tx.value ?? null
    return null
  }

  txLedger(asset: Asset): TxLedgerRow[] {
    const txs = this.txByAsset.get(asset.id) ?? []
    const balanceLabel: TxLedgerRow['balanceLabel'] = isQuantityBased(asset.type)
      ? 'quantity'
      : asset.type === 'debt'
        ? 'debt'
        : 'value'

    if (!isQuantityBased(asset.type) && asset.type !== 'debt') {
      const rows = buildValueLedgerRows(txs, (tx) => this.txAmountNative(tx))
      return rows
        .map((row) => ({
          ...row,
          balanceLabel,
        }))
        .reverse()
    }

    let balance = 0
    const rows: TxLedgerRow[] = []

    for (const tx of txs) {
      if (isQuantityBased(asset.type)) {
        if (tx.type === 'BUY') balance += tx.quantity ?? 0
        if (tx.type === 'SELL') balance -= tx.quantity ?? 0
      } else {
        balance = applyValueTxStep(balance, tx)
      }

      rows.push({
        tx,
        amountNative: this.txAmountNative(tx),
        balanceAfter: balance,
        balanceLabel,
      })
    }

    return rows.reverse()
  }

  private flowsUpTo(asset: Asset, atMs: number): { in: number; out: number } {
    const fx = this.fx(asset.currency)
    let totalIn = 0
    let totalOut = 0
    for (const tx of this.txByAsset.get(asset.id) ?? []) {
      if (tx.occurredAt > atMs) break
      if (tx.type === 'BUY') totalIn += (tx.quantity ?? 0) * (tx.price ?? 0) * fx
      if (tx.type === 'SELL') totalOut += (tx.quantity ?? 0) * (tx.price ?? 0) * fx
      if (tx.type === 'DEPOSIT') totalIn += (tx.amount ?? 0) * fx
      if (tx.type === 'WITHDRAW') totalOut += (tx.amount ?? 0) * fx
    }
    return { in: totalIn, out: totalOut }
  }

  private periodReturns(assets: Asset[]): PeriodReturn[] {
    const nonDebt = assets.filter((a) => a.type !== 'debt')
    const nowMs = Date.now()
    return periodReturnsFor(
      nonDebt,
      (a, atMs) => this.valueAt(a, atMs),
      (a, atMs) => this.flowsUpTo(a, atMs),
      nowMs,
    )
  }

  summary(): PortfolioSummary {
    const active = this.assets.filter((a) => !a.archived)
    const snapshots = active.map((a) => this.snapshot(a))

    let totalAssets = 0
    let totalDebt = 0
    let totalPnl = 0
    const byTypeMap = new Map<AssetType, number>()
    for (const s of snapshots) {
      if (s.asset.type === 'debt') {
        totalDebt += s.valueCNY
      } else {
        totalAssets += s.valueCNY
        totalPnl += s.totalPnlCNY
      }
      byTypeMap.set(s.asset.type, (byTypeMap.get(s.asset.type) ?? 0) + s.valueCNY)
    }

    return {
      totalAssetsCNY: totalAssets,
      totalDebtCNY: totalDebt,
      netWorthCNY: totalAssets - totalDebt,
      totalPnlCNY: totalPnl,
      byType: [...byTypeMap.entries()]
        .map(([type, valueCNY]) => ({ type, valueCNY }))
        .sort((a, b) => b.valueCNY - a.valueCNY),
      snapshots: snapshots.sort((a, b) => b.valueCNY - a.valueCNY),
      history: this.history(active),
      periodReturns: this.periodReturns(active),
    }
  }

  private history(assets: Asset[]) {
    let earliestMs: number | undefined
    for (const list of this.txByAsset.values()) {
      for (const tx of list) {
        if (earliestMs == null || tx.occurredAt < earliestMs) earliestMs = tx.occurredAt
      }
    }
    if (earliestMs == null) return []

    const start = startOfDay(earliestMs)
    const end = todayEndMs()
    const spanDays = Math.max(1, Math.round((end - start) / DAY_MS))
    const step = spanDays > 730 ? 7 : 1

    const result: { date: string; netWorth: number; assets: number; debt: number }[] = []
    for (let ms = start; ; ms += step * DAY_MS) {
      const atMs = Math.min(endOfDay(ms), end)
      const date = formatDateKey(atMs)
      let assetVal = 0
      let debtVal = 0
      for (const a of assets) {
        const v = this.valueAt(a, atMs)
        if (a.type === 'debt') debtVal += v
        else assetVal += v
      }
      result.push({ date, netWorth: assetVal - debtVal, assets: assetVal, debt: debtVal })
      if (atMs >= end) break
    }
    return result
  }
}
