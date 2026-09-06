import type { TxLedgerRow } from '../types'
import { fmtNum, nativeAmountDigits } from './format'

export function formatLedgerAmount(amount: number | null, currency: string): string {
  if (amount == null) return '—'
  return `${fmtNum(amount, nativeAmountDigits(currency))} ${currency}`
}

export function formatLedgerBalance(
  balance: number,
  label: TxLedgerRow['balanceLabel'],
  currency: string,
): string {
  if (label === 'quantity') return `${fmtNum(balance)} 份`
  return `${fmtNum(balance, nativeAmountDigits(currency))} ${currency}`
}
