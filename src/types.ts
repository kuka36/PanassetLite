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
  /** YYYY-MM-DD */
  date: string
  quantity?: number
  /** 单价(资产币种) */
  price?: number
  /** 现金流金额(资产币种) */
  amount?: number
  /** VALUATION:当日总市值(资产币种) */
  value?: number
  note?: string
  createdAt: number
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
  /** OpenAI 兼容接口配置(可选,用于 AI 助手) */
  llm: { baseUrl: string; apiKey: string; model: string }
  /** NL 记一笔时是否将资产名称列表发给 LLM 以辅助匹配;关闭后仅发送用户原文 */
  llmSendAssetNames?: boolean
  pricesUpdatedAt?: number
}

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'CNY',
  fxRates: { USD: 7.2, HKD: 0.92, EUR: 7.8, USDT: 7.2 },
  llm: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  llmSendAssetNames: true,
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
  /** 最近一次估值/价格更新日期 */
  lastUpdated?: string
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
}

/** 区间收益(本周/本月/今年以来/近一年) */
export interface PeriodReturn {
  key: 'week' | 'month' | 'ytd' | 'year'
  label: string
  /** 区间收益(CNY),已剔除区间内存取/买卖的本金变动,与 totalPnlCNY 同口径 */
  pnlCNY: number
  /** 区间收益率 = 收益 / (期初市值 + 区间净投入正部分);基数不足时为 null */
  ratio: number | null
}

export interface PortfolioSummary {
  totalAssetsCNY: number   // 正资产合计
  totalDebtCNY: number     // 负债合计(正数表示欠款)
  netWorthCNY: number      // 净资产
  totalPnlCNY: number
  byType: { type: AssetType; valueCNY: number }[]
  snapshots: AssetSnapshot[]
  /** 净值历史(按日) */
  history: { date: string; netWorth: number; assets: number; debt: number }[]
  /** 区间收益 */
  periodReturns: PeriodReturn[]
}
