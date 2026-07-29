import type { TxLedgerRow } from '../types'
import { fmtNum } from './format'

export function formatLedgerAmount(amount: number | null, currency: string): string {
  if (amount == null) return '—'
  return `${fmtNum(amount, 2)} ${currency}`
}

export function formatLedgerBalance(
  balance: number,
  label: TxLedgerRow['balanceLabel'],
  currency: string,
): string {
  if (label === 'quantity') return `${fmtNum(balance)} 份`
  return `${fmtNum(balance, 2)} ${currency}`
}
