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
import { xirr, type CashFlow } from './xirr'
import { applyValueTxStep, buildValueFlows, buildValueLedgerRows, periodReturnsFor, recentAnnualizedFromValueTxs } from './replayValue'
import { today } from '../services/storage'

const DAY_MS = 86400_000

/**
 * PortfolioEngine — 事件溯源核心。
 * 所有财务状态(持仓、市值、盈亏、收益率、净值历史)均由交易事件重放计算,
 * 不存储任何派生状态。价格观测点(行情缓存 + 交易价格 + 手动估值)用于插值估计历史净值。
 */
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
    const sorted = [...transactions].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
    )
    for (const tx of sorted) {
      const list = this.txByAsset.get(tx.assetId) ?? []
      list.push(tx)
      this.txByAsset.set(tx.assetId, list)
    }
  }

  /** 1 单位资产币种 = ? CNY */
  fx(currency: string): number {
    if (currency === this.settings.baseCurrency) return 1
    return this.settings.fxRates[currency] ?? 1
  }

  // ── 单资产计算 ──────────────────────────────────────────────────────────

  /** 某日持有份额(quantity 型) */
  private quantityAt(assetId: string, date: string): number {
    let qty = 0
    for (const tx of this.txByAsset.get(assetId) ?? []) {
      if (tx.date > date) break
      if (tx.type === 'BUY') qty += tx.quantity ?? 0
      if (tx.type === 'SELL') qty -= tx.quantity ?? 0
    }
    return qty
  }

  /** 价格观测点(CNY/单位):交易价格、手动估值、行情缓存 */
  private pricePoints(asset: Asset): Array<[number, number]> {
    const fx = this.fx(asset.currency)
    const points = new Map<string, number>()
    for (const tx of this.txByAsset.get(asset.id) ?? []) {
      if ((tx.type === 'BUY' || tx.type === 'SELL') && tx.price != null) {
        points.set(tx.date, tx.price * fx)
      }
      if (tx.type === 'VALUATION' && tx.value != null) {
        const qty = this.quantityAt(asset.id, tx.date)
        if (qty > 0) points.set(tx.date, (tx.value / qty) * fx)
      }
    }
    if (asset.symbol) {
      for (const [date, price] of Object.entries(this.prices[asset.symbol] ?? {})) {
        points.set(date, price) // 行情缓存统一以 CNY 记录
      }
    }
    return [...points.entries()]
      .map(([d, p]) => [Date.parse(d), p] as [number, number])
      .sort((a, b) => a[0] - b[0])
  }

  /** 某日单价(CNY),观测点之间线性插值 */
  private priceAt(points: Array<[number, number]>, dateMs: number): number {
    if (points.length === 0) return 0
    if (dateMs <= points[0][0]) return points[0][1]
    if (dateMs >= points[points.length - 1][0]) return points[points.length - 1][1]
    for (let i = 1; i < points.length; i++) {
      if (dateMs <= points[i][0]) {
        const [t0, p0] = points[i - 1]
        const [t1, p1] = points[i]
        const ratio = t1 === t0 ? 0 : (dateMs - t0) / (t1 - t0)
        return p0 + (p1 - p0) * ratio
      }
    }
    return points[points.length - 1][1]
  }

  /** 某日市值(CNY)。负债返回欠款金额(正数) */
  valueAt(asset: Asset, date: string): number {
    const txs = (this.txByAsset.get(asset.id) ?? []).filter((t) => t.date <= date)
    const fx = this.fx(asset.currency)

    if (isQuantityBased(asset.type)) {
      const qty = this.quantityAt(asset.id, date)
      if (qty <= 0) return 0
      return qty * this.priceAt(this.pricePoints(asset), Date.parse(date))
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
    const t = today()
    const quantity = isQuantityBased(asset.type) ? this.quantityAt(asset.id, t) : 0
    const valueCNY = this.valueAt(asset, t)
    const valueNative = fx === 0 ? 0 : valueCNY / fx

    // 现金流(CNY,资产视角:投入为负,收回为正)
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
          flows.push({ date: tx.date, amount: amt })
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
      rate = xirr([...flows, { date: t, amount: valueCNY }])
    }

    const lastUpdated = this.lastUpdatedDate(asset)
    const recentAnnualized = this.recentAnnualized(asset)

    const unitPrice = isQuantityBased(asset.type)
      ? this.priceAt(this.pricePoints(asset), Date.parse(t)) / (fx || 1)
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

  private lastUpdatedDate(asset: Asset): string | undefined {
    let last: string | undefined
    for (const tx of this.txByAsset.get(asset.id) ?? []) {
      if (!last || tx.date > last) last = tx.date
    }
    if (asset.symbol) {
      for (const d of Object.keys(this.prices[asset.symbol] ?? {})) {
        if (!last || d > last) last = d
      }
    }
    return last
  }

  /**
   * 区间年化收益率:基于最近两次估值点(对理财产品判断"还值不值得买"很关键)。
   * 扣除区间内的存取现金流影响。
   */
  private recentAnnualized(asset: Asset): number | null {
    if (isQuantityBased(asset.type) || asset.type === 'debt') return null
    return recentAnnualizedFromValueTxs(this.txByAsset.get(asset.id) ?? [])
  }

  /** 单笔发生额(原币种) */
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

  /**
   * 单资产交易账本:按 date + createdAt 正序重放,返回 newest-first 供列表展示。
   */
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

  /** 累计现金流(CNY)截至某日:in = 投入(买入/存入),out = 收回(卖出/取出) */
  private flowsUpTo(asset: Asset, date: string): { in: number; out: number } {
    const fx = this.fx(asset.currency)
    let totalIn = 0
    let totalOut = 0
    for (const tx of this.txByAsset.get(asset.id) ?? []) {
      if (tx.date > date) break
      if (tx.type === 'BUY') totalIn += (tx.quantity ?? 0) * (tx.price ?? 0) * fx
      if (tx.type === 'SELL') totalOut += (tx.quantity ?? 0) * (tx.price ?? 0) * fx
      if (tx.type === 'DEPOSIT') totalIn += (tx.amount ?? 0) * fx
      if (tx.type === 'WITHDRAW') totalOut += (tx.amount ?? 0) * fx
    }
    return { in: totalIn, out: totalOut }
  }

  /**
   * 区间收益:本周 / 本月 / 今年以来 / 近一年。
   * 收益 = 区间末盈亏 - 区间初盈亏(盈亏 = 市值 + 累计收回 - 累计投入),
   * 与 totalPnlCNY 同口径,自动剔除区间内存取/买卖的本金变动;负债不计入。
   */
  private periodReturns(assets: Asset[]): PeriodReturn[] {
    const nonDebt = assets.filter((a) => a.type !== 'debt')
    return periodReturnsFor(
      nonDebt,
      (a, date) => this.valueAt(a, date),
      (a, date) => this.flowsUpTo(a, date),
      today(),
    )
  }

  // ── 组合汇总 ────────────────────────────────────────────────────────────

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

  /** 净值历史:从最早事件到今天,逐日重放(超过 2 年自动按周采样) */
  private history(assets: Asset[]) {
    let earliest: string | undefined
    for (const list of this.txByAsset.values()) {
      for (const tx of list) {
        if (!earliest || tx.date < earliest) earliest = tx.date
      }
    }
    const t = today()
    if (!earliest) return []

    const start = Date.parse(earliest)
    const end = Date.parse(t)
    const spanDays = Math.max(1, Math.round((end - start) / DAY_MS))
    const step = spanDays > 730 ? 7 : 1

    const result: { date: string; netWorth: number; assets: number; debt: number }[] = []
    for (let ms = start; ; ms += step * DAY_MS) {
      const clamped = Math.min(ms, end)
      const date = new Date(clamped).toISOString().slice(0, 10)
      let assetVal = 0
      let debtVal = 0
      for (const a of assets) {
        const v = this.valueAt(a, date)
        if (a.type === 'debt') debtVal += v
        else assetVal += v
      }
      result.push({ date, netWorth: assetVal - debtVal, assets: assetVal, debt: debtVal })
      if (clamped >= end) break
    }
    return result
  }
}
