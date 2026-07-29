import type { ReactNode } from 'react'
import { fmtDateTime, fmtPct, pnlColor } from '../utils/format'

export interface ValueLedgerRowBase {
  tx: { id: string; occurredAt: number; note?: string }
  amountNative: number | null
  balanceAfter: number
  intervalGainNative?: number | null
  intervalAnnualized?: number | null
}

interface Props<R extends ValueLedgerRowBase> {
  rows: R[]
  typeLabel: (row: R) => string
  formatAmount: (amount: number | null, row: R) => ReactNode
  formatBalance: (balance: number, row: R) => ReactNode
  formatIntervalGain?: (gain: number, row: R) => ReactNode
  showInterval?: boolean
  emptyColSpan: number
  emptyMessage: string
  onEdit: (row: R) => void
  onDelete: (id: string) => void
  toolbar?: ReactNode
  beforeAmountHeaders?: ReactNode
  beforeAmountCells?: (row: R) => ReactNode
  afterAmountHeaders?: ReactNode
  afterAmountCells?: (row: R) => ReactNode
  amountHeader?: string
  balanceHeader?: string
}

export default function ValueLedgerTable<R extends ValueLedgerRowBase>({
  rows,
  typeLabel,
  formatAmount,
  formatBalance,
  formatIntervalGain,
  showInterval = true,
  emptyColSpan,
  emptyMessage,
  onEdit,
  onDelete,
  toolbar,
  beforeAmountHeaders,
  beforeAmountCells,
  afterAmountHeaders,
  afterAmountCells,
  amountHeader = '发生额',
  balanceHeader = '余额',
}: Props<R>) {
  return (
    <div className="max-h-[min(50vh,28rem)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-100">
      {toolbar}
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
            <th className="px-3 py-2 font-medium">时间</th>
            <th className="px-3 py-2 font-medium">类型</th>
            {beforeAmountHeaders}
            <th className="px-3 py-2 font-medium text-right">{amountHeader}</th>
            {afterAmountHeaders}
            <th className="px-3 py-2 font-medium text-right">{balanceHeader}</th>
            {showInterval && (
              <>
                <th className="px-3 py-2 font-medium text-right">区间变化</th>
                <th
                  className="px-3 py-2 font-medium text-right"
                  title="相对上一笔流水，扣除存取后的区间收益年化（与列表「近期年化」同口径）"
                >
                  近期年化
                </th>
              </>
            )}
            <th className="px-3 py-2 font-medium">备注</th>
            <th className="px-3 py-2 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tx.id} className="border-t border-slate-100 hover:bg-slate-50/50">
              <td className="px-3 py-2 text-xs tabular-nums text-slate-500">
                {fmtDateTime(row.tx.occurredAt)}
              </td>
              <td className="px-3 py-2 text-slate-700">{typeLabel(row)}</td>
              {beforeAmountCells?.(row)}
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {formatAmount(row.amountNative, row)}
              </td>
              {afterAmountCells?.(row)}
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {formatBalance(row.balanceAfter, row)}
              </td>
              {showInterval && (
                <>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      row.intervalGainNative != null && row.intervalGainNative !== 0
                        ? pnlColor(row.intervalGainNative)
                        : 'text-slate-500'
                    }`}
                  >
                    {row.intervalGainNative != null && row.intervalGainNative !== 0
                      ? (formatIntervalGain?.(row.intervalGainNative, row) ??
                        String(row.intervalGainNative))
                      : '—'}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      row.intervalAnnualized != null ? pnlColor(row.intervalAnnualized) : 'text-slate-500'
                    }`}
                    title="相对上一笔流水，扣除存取后的区间收益年化"
                  >
                    {row.intervalAnnualized != null ? fmtPct(row.intervalAnnualized) : '—'}
                  </td>
                </>
              )}
              <td className="max-w-32 truncate px-3 py-2 text-xs text-slate-500">{row.tx.note}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  className="mr-3 text-xs text-blue-600 hover:underline"
                  onClick={() => onEdit(row)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-red-600"
                  onClick={() => {
                    if (confirm('删除这条流水?')) onDelete(row.tx.id)
                  }}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={emptyColSpan} className="px-3 py-6 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
