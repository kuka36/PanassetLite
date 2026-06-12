import type {
  Asset,
  AssetSnapshot,
  AssetType,
  PeriodReturn,
  PortfolioSummary,
  PriceHistory,
  Settings,
  Transaction,
} from '../types'
import { isQuantityBased } from '../types'
import { xirr, type CashFlow } from './xirr'
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
      switch (tx.type) {
        case 'DEPOSIT':
        case 'BORROW':
        case 'INCOME':
          value += tx.amount ?? 0
          break
        case 'WITHDRAW':
        case 'REPAY':
          value -= tx.amount ?? 0
          break
        case 'VALUATION':
          value = tx.value ?? value
          break
        default:
          break
      }
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
    const flows: CashFlow[] = []
    let totalIn = 0
    let totalOut = 0
    for (const tx of txs) {
      let amt = 0
      if (tx.type === 'BUY') amt = -(tx.quantity ?? 0) * (tx.price ?? 0) * fx
      if (tx.type === 'SELL') amt = (tx.quantity ?? 0) * (tx.price ?? 0) * fx
      if (tx.type === 'DEPOSIT') amt = -(tx.amount ?? 0) * fx
      if (tx.type === 'WITHDRAW') amt = (tx.amount ?? 0) * fx
      if (amt !== 0) {
        flows.push({ date: tx.date, amount: amt })
        if (amt < 0) totalIn += -amt
        else totalOut += amt
      }
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
    const vals = (this.txByAsset.get(asset.id) ?? []).filter(
      (t) => t.type === 'VALUATION' && t.value != null,
    )
    if (vals.length < 2) return null
    const v1 = vals[vals.length - 2]
    const v2 = vals[vals.length - 1]
    const days = (Date.parse(v2.date) - Date.parse(v1.date)) / DAY_MS
    if (days < 1) return null

    let netFlow = 0
    for (const tx of this.txByAsset.get(asset.id) ?? []) {
      if (tx.date <= v1.date || tx.date > v2.date) continue
      if (tx.type === 'DEPOSIT') netFlow += tx.amount ?? 0
      if (tx.type === 'WITHDRAW') netFlow -= tx.amount ?? 0
    }
    const base = (v1.value ?? 0) + Math.max(0, netFlow)
    if (base <= 0) return null
    const gain = (v2.value ?? 0) - (v1.value ?? 0) - netFlow
    return (gain / base) * (365 / days)
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
    const t = today()
    const now = new Date()
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    // 各区间的基准日(区间起点的前一天)
    const dow = (now.getDay() + 6) % 7 // 周一=0
    const periods: { key: PeriodReturn['key']; label: string; baseline: Date }[] = [
      { key: 'week', label: '本周', baseline: new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 1) },
      { key: 'month', label: '本月', baseline: new Date(now.getFullYear(), now.getMonth(), 0) },
      { key: 'ytd', label: '今年以来', baseline: new Date(now.getFullYear() - 1, 11, 31) },
      { key: 'year', label: '近一年', baseline: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
    ]

    const nonDebt = assets.filter((a) => a.type !== 'debt')
    return periods.map(({ key, label, baseline }) => {
      const b = fmtDate(baseline)
      let pnl = 0
      let baseValue = 0
      let netInflow = 0
      for (const a of nonDebt) {
        const v0 = this.valueAt(a, b)
        const v1 = this.valueAt(a, t)
        const f0 = this.flowsUpTo(a, b)
        const f1 = this.flowsUpTo(a, t)
        pnl += v1 + f1.out - f1.in - (v0 + f0.out - f0.in)
        baseValue += v0
        netInflow += f1.in - f0.in - (f1.out - f0.out)
      }
      const base = baseValue + Math.max(0, netInflow)
      return { key, label, pnlCNY: pnl, ratio: base > 1 ? pnl / base : null }
    })
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
