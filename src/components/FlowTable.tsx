import type { ReactNode } from 'react'
import { SortTh } from './SortTh'
import { Card, CardBody } from './ui/Card'
import type { SortState } from '../utils/tableSort'

export interface FlowColumnDef<T, K extends string> {
  key: K
  label: string
  align?: 'left' | 'right'
  headerClassName?: string
  cellClassName?: string
  render: (row: T) => ReactNode
}

interface FlowTableProps<T, K extends string> {
  rows: T[]
  columns: FlowColumnDef<T, K>[]
  sort: SortState<K>
  onSort: (key: K) => void
  rowKey: (row: T) => string
  emptyMessage: string
  onEdit: (row: T) => void
  onDelete: (id: string) => void
  getId: (row: T) => string
  renderMobileCard: (row: T, actions: ReactNode) => ReactNode
}

export default function FlowTable<T, K extends string>({
  rows,
  columns,
  sort,
  onSort,
  rowKey,
  emptyMessage,
  onEdit,
  onDelete,
  getId,
  renderMobileCard,
}: FlowTableProps<T, K>) {
  return (
    <>
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                {columns.map((col) => (
                  <SortTh
                    key={col.key}
                    label={col.label}
                    sortKey={col.key}
                    sort={sort}
                    onSort={onSort}
                    className={col.headerClassName ?? 'px-3 py-3 font-medium'}
                    align={col.align}
                  />
                ))}
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/50"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.cellClassName ?? 'px-3 py-2.5'}>
                      {col.render(row)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <FlowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(getId(row))} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <Card key={rowKey(row)}>
            <CardBody className="space-y-2">
              {renderMobileCard(
                row,
                <div className="flex justify-end pt-1">
                  <FlowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(getId(row))} />
                </div>,
              )}
            </CardBody>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </>
  )
}

export function FlowTypeBadge({
  label,
  variant = 'default',
}: {
  label: string
  variant?: 'default' | 'strategy'
}) {
  const cls =
    variant === 'strategy'
      ? 'rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs text-sky-700'
      : 'rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs text-slate-600'
  return <span className={cls}>{label}</span>
}

function FlowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <button
        className="mr-3 text-xs text-blue-600 transition-colors hover:text-blue-700"
        onClick={onEdit}
      >
        编辑
      </button>
      <button
        className="text-xs text-slate-500 transition-colors hover:text-red-600"
        onClick={() => {
          if (confirm('删除这条流水?')) onDelete()
        }}
      >
        删除
      </button>
    </>
  )
}
