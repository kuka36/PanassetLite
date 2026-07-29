import type { StrategyTransaction, Transaction } from '../types'
import { fmtNum } from './format'

/** 资产流水明细排序值 */
export function assetFlowDetailSortValue(t: Transaction): number | null {
  if (t.amount != null) return t.amount
  if (t.value != null) return t.value
  if (t.quantity != null && t.price != null) return t.quantity * t.price
  return null
}

/** 策略流水明细排序值 */
export function strategyFlowDetailSortValue(t: StrategyTransaction): number | null {
  if (t.amount != null) return t.amount
  if (t.value != null) return t.value
  return null
}

export function formatAssetFlowDetail(t: Transaction, currency: string): string {
  if (t.quantity != null && t.price != null) {
    return `${fmtNum(t.quantity)} × ${fmtNum(t.price)} ${currency}`
  }
  if (t.amount != null) return `${fmtNum(t.amount, 2)} ${currency}`
  if (t.value != null) return `市值 ${fmtNum(t.value, 2)} ${currency}`
  return '—'
}

export function formatStrategyFlowDetail(t: StrategyTransaction, currency: string): string {
  if (t.amount != null) return `${fmtNum(t.amount, 2)} ${currency}`
  if (t.value != null) return `市值 ${fmtNum(t.value, 2)} ${currency}`
  return '—'
}
