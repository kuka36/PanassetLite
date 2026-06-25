import { assetTypeHex } from './theme/colors'

// ── 领域模型 ────────────────────────────────────────────────────────────────

/** 资产类别 */
export type AssetType =
  | 'cash'      // 银行存款 / 货币基金
  | 'wealth'    // 理财产品(支付宝、银行理财等,手动估值)
  | 'stock'     // 股票
  | 'fund'      // 基金
  | 'crypto'    // 加密货币
  | 'property'  // 房产等实物资产
  | 'debt'      // 负债(房贷、借款)
  | 'other'

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  cash: '现金存款',
  wealth: '理财产品',
  stock: '股票',
  fund: '基金',
  crypto: '加密货币',
  property: '房产实物',
  debt: '负债',
  other: '其他',
}

export const ASSET_TYPE_COLOR: Record<AssetType, string> = { ...assetTypeHex }

/** 计价模式:quantity = 份额×单价(股票/基金/加密);value = 直接记总值(现金/理财/房产/负债) */
export function isQuantityBased(type: AssetType): boolean {
  return type === 'stock' || type === 'fund' || type === 'crypto'
}

export type PriceSource = 'manual' | 'coingecko' | 'finnhub'

export interface Asset {
  id: string
  name: string
  type: AssetType
  /** 计价货币,如 CNY / USD / HKD */
  currency: string
  /** 行情代码:coingecko id(如 bitcoin)或股票 ticker(如 AAPL) */
  symbol?: string
  priceSource: PriceSource
  /** 平台/渠道,如 支付宝、招商银行、币安 */
  platform?: string
  note?: string
  archived?: boolean
  createdAt: number
}

/** 交易事件类型(事件溯源的事实来源) */
export type TxType =
  | 'BUY'        // 买入:quantity + price
  | 'SELL'       // 卖出:quantity + price
  | 'DEPOSIT'    // 存入/投入本金:amount
  | 'WITHDRAW'   // 取出/赎回:amount
  | 'INCOME'     // 利息/分红/收益到账(留在资产内):amount
  | 'VALUATION'  // 手动估值:value = 当日总市值
  | 'BORROW'     // 负债增加:amount
  | 'REPAY'      // 还款:amount

export const TX_TYPE_LABEL: Record<TxType, string> = {
  BUY: '买入',
  SELL: '卖出',
  DEPOSIT: '存入',
  WITHDRAW: '取出',
  INCOME: '收益入账',
  VALUATION: '估值更新',
  BORROW: '借入',
  REPAY: '还款',
}

export interface Transaction {
  id: string
  assetId: string
  type: TxType
  /** 业务发生时刻（毫秒时间戳） */
  occurredAt: number
  quantity?: number
  /** 单价(资产币种) */
  price?: number
  /** 现金流金额(资产币种) */
  amount?: number
  /** VALUATION:当日总市值(资产币种) */
  value?: number
  note?: string
  createdAt: number
  /** 系统维护：最后添加或修改时间戳 */
  updatedAt: number
}

// ── 行情与汇率 ──────────────────────────────────────────────────────────────

/** 已观测的价格点:symbol -> date(YYYY-MM-DD) -> 单价(CNY) */
export type PriceHistory = Record<string, Record<string, number>>

export interface Settings {
  /** 基准货币(目前固定 CNY,展示用) */
  baseCurrency: string
  /** 1 单位外币 = ? CNY */
  fxRates: Record<string, number>
  fxUpdatedAt?: number
  finnhubKey?: string
  /** OpenAI 兼容接口配置(可选,用于 AI 助手;默认 DeepSeek) */
  llm: { baseUrl: string; apiKey: string; model: string }
  /** NL 记一笔时是否将资产名称列表发给 LLM 以辅助匹配;关闭后仅发送用户原文 */
  llmSendAssetNames?: boolean
  /**
   * AI 助手/顾问发送给 LLM 的组合上下文粒度。
   * summary=仅汇总数字与类别占比;detailed=另含持仓明细(资产名、市值、盈亏、年化)。
   */
  llmContextPrivacy?: 'summary' | 'detailed'
  pricesUpdatedAt?: number
}

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'CNY',
  fxRates: { USD: 7.2, HKD: 0.92, EUR: 7.8, USDT: 7.2 },
  llm: { baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-chat' },
  llmSendAssetNames: true,
  llmContextPrivacy: 'detailed',
}

// ── 引擎输出 ────────────────────────────────────────────────────────────────

export interface AssetSnapshot {
  asset: Asset
  /** 当前持有份额(quantity 型) */
  quantity: number
  /** 当前市值(CNY) */
  valueCNY: number
  /** 当前市值(资产币种) */
  valueNative: number
  /** 当前单价(资产币种,quantity 型) */
  unitPrice?: number
  /** 净投入本金(CNY):流入 - 流出 */
  netInvestedCNY: number
  /** 累计盈亏(CNY) = 市值 + 累计流出 - 累计流入 */
  totalPnlCNY: number
  /** 年化收益率(XIRR),无法计算时为 null */
  xirr: number | null
  /** 最近一次估值/价格更新时刻（毫秒时间戳） */
  lastUpdated?: number
  /** 最近两次估值之间的区间年化(理财产品判断"还值不值得买") */
  recentAnnualized?: number | null
}

/** 单资产交易账本行(由事件重放推导) */
export interface TxLedgerRow {
  tx: Transaction
  /** 发生额(原币种);VALUATION 为当日总市值 */
  amountNative: number | null
  /** 该笔事件后的余额/持仓(原币种: 份额或金额) */
  balanceAfter: number
  balanceLabel: 'quantity' | 'value' | 'debt'
  /** 相对上一笔的区间盈亏(原币种);首笔或无意义区间为 null */
  intervalGainNative?: number | null
  /** 相对上一笔的区间年化(小数);不可算时为 null */
  intervalAnnualized?: number | null
}

/** 区间收益(本周/本月/近30天/今年以来/近一年) */
export interface PeriodReturn {
  key: 'week' | 'month' | 'd30' | 'ytd' | 'year'
  label: string
  /** 区间收益(CNY),已剔除区间内存取/买卖的本金变动,与 totalPnlCNY 同口径 */
  pnlCNY: number
  /** 区间收益率 = 收益 / (期初市值 + 区间净投入正部分);基数不足时为 null */
  ratio: number | null
  /** 同期净资产变化(CNY)，含存取/还债；仅总览组合层填充 */
  netWorthChangeCNY?: number
  /** 净资产变化率 = 变化 / |期初净资产| */
  netWorthChangeRatio?: number | null
}

export interface PortfolioSummary {
  totalAssetsCNY: number   // 正资产合计
  totalDebtCNY: number     // 负债合计(正数表示欠款)
  netWorthCNY: number      // 净资产
  totalPnlCNY: number
  /** 累计收益率 = totalPnlCNY / 净投入合计；净投入不足时为 null */
  totalPnlRatio: number | null
  byType: { type: AssetType; valueCNY: number }[]
  snapshots: AssetSnapshot[]
  /** 净值历史(按日) */
  history: { date: string; netWorth: number; assets: number; debt: number }[]
  /** 区间收益 */
  periodReturns: PeriodReturn[]
}

// ── 策略跟踪 ────────────────────────────────────────────────────────────────
// 策略是独立于资产流水的「收益分析透镜」，不参与净资产汇总。
// 一个资产账户可以有零到多个策略，用于单独跟踪账户内部分资金的收益。

export type StrategyKind = 'dca' | 'grid' | 'manual'

export const STRATEGY_KIND_LABEL: Record<StrategyKind, string> = {
  dca: '定投',
  grid: '网格',
  manual: '手动',
}

export interface Strategy {
  id: string
  /** 归属哪个账户（关联展示用，不做资金穿透） */
  assetId: string
  name: string
  kind: StrategyKind
  /** 创建时默认继承 asset.currency */
  currency: string
  note?: string
  archived?: boolean
  createdAt: number
}

/**
 * 策略流水类型，收窄为金额型子集。
 * 不复用 TxType，避免 BUY/SELL/BORROW/REPAY 进入策略引擎产生防御分支。
 */
export type StrategyTxType = 'DEPOSIT' | 'WITHDRAW' | 'INCOME' | 'VALUATION'

export const STRATEGY_TX_TYPE_LABEL: Record<StrategyTxType, string> = {
  DEPOSIT: '存入',
  WITHDRAW: '取出',
  INCOME: '收益入账',
  VALUATION: '估值更新',
}

export interface StrategyTransaction {
  id: string
  strategyId: string
  type: StrategyTxType
  /** 业务发生时刻（毫秒时间戳） */
  occurredAt: number
  /** DEPOSIT / WITHDRAW / INCOME 用 */
  amount?: number
  /** VALUATION：策略当日总市值（策略币种） */
  value?: number
  note?: string
  createdAt: number
}

/** 策略快照（不加入 PortfolioSummary.totalAssetsCNY） */
export interface StrategySnapshot {
  strategy: Strategy
  /** 当前市值（策略币种） */
  valueNative: number
  /** 当前市值（CNY） */
  valueCNY: number
  /** 净投入本金（CNY）：流入 - 流出 */
  netInvestedCNY: number
  /** 累计盈亏（CNY）= 市值 + 累计流出 - 累计流入 */
  totalPnlCNY: number
  /** 年化收益率（XIRR），无法计算时为 null */
  xirr: number | null
  /** 最近两次 VALUATION 之间的区间年化 */
  recentAnnualized?: number | null
  /** 最近一笔流水业务时刻（毫秒时间戳） */
  lastUpdated?: number
}

/** 策略账本行（独立类型，不强转 TxLedgerRow，避免 tx: Transaction 硬类型） */
export interface StrategyLedgerRow {
  tx: StrategyTransaction
  /** 发生额（策略币种）；VALUATION 为当日总市值 */
  amountNative: number | null
  /** 该笔事件后的余额（策略币种） */
  balanceAfter: number
  /** 相对上一笔的区间盈亏（策略币种）；首笔为 null */
  intervalGainNative?: number | null
  /** 相对上一笔的区间年化（小数）；不可算时为 null */
  intervalAnnualized?: number | null
}
