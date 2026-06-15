import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import Modal, { btnPrimary, inputCls } from '../components/Modal'
import TxForm from '../components/TxForm'
import { Card, CardBody } from '../components/ui/Card'
import type { Transaction } from '../types'
import { TX_TYPE_LABEL } from '../types'
import { fmtNum } from '../utils/format'

type ModalState = { kind: 'add' } | { kind: 'edit'; tx: Transaction } | null

export default function Transactions() {
  const assets = useStore((s) => s.assets)
  const transactions = useStore((s) => s.transactions)
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const deleteTransaction = useStore((s) => s.deleteTransaction)
  const [filterAsset, setFilterAsset] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  useKeyboardShortcuts(
    useMemo(
      () => [
        {
          key: 'n',
          action: () => {
            if (assets.length > 0) setModal({ kind: 'add' })
          },
        },
      ],
      [assets.length],
    ),
    modal === null,
  )

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  const rows = useMemo(
    () =>
      transactions
        .filter((t) => !filterAsset || t.assetId === filterAsset)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [transactions, filterAsset],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">交易流水</h1>
        <div className="flex items-center gap-3">
          <select
            className={`${inputCls} w-48`}
            value={filterAsset}
            onChange={(e) => setFilterAsset(e.target.value)}
          >
            <option value="">全部资产</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            className={btnPrimary}
            onClick={() => setModal({ kind: 'add' })}
            disabled={assets.length === 0}
          >
            + 记一笔
          </button>
        </div>
      </div>

      {/* 桌面端表格 */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-3 py-3 font-medium">资产</th>
                <th className="px-3 py-3 font-medium">类型</th>
                <th className="px-3 py-3 font-medium text-right">明细</th>
                <th className="px-3 py-3 font-medium">备注</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const asset = assetMap.get(t.assetId)
                const cur = asset?.currency ?? ''
                return (
                  <tr
                    key={t.id}
                    className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">{t.date}</td>
                    <td className="px-3 py-2.5 text-slate-700">{asset?.name ?? '(已删除)'}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                        {TX_TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {formatDetail(t, cur)}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-xs text-slate-500">
                      {t.note}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <TxActions t={t} onEdit={() => setModal({ kind: 'edit', tx: t })} onDelete={() => deleteTransaction(t.id)} />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    暂无记录。所有财务状态都由这里的事件流计算得出 —— 买入、卖出、存取、估值更新。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 移动端卡片列表 */}
      <div className="space-y-3 md:hidden">
        {rows.map((t) => {
          const asset = assetMap.get(t.assetId)
          const cur = asset?.currency ?? ''
          return (
            <Card key={t.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{asset?.name ?? '(已删除)'}</p>
                    <p className="text-xs text-slate-500">{t.date}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {TX_TYPE_LABEL[t.type]}
                  </span>
                </div>
                <p className="text-sm tabular-nums text-slate-700">{formatDetail(t, cur)}</p>
                {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                <div className="flex justify-end pt-1">
                  <TxActions t={t} onEdit={() => setModal({ kind: 'edit', tx: t })} onDelete={() => deleteTransaction(t.id)} />
                </div>
              </CardBody>
            </Card>
          )
        })}
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            暂无记录。所有财务状态都由这里的事件流计算得出 —— 买入、卖出、存取、估值更新。
          </p>
        )}
      </div>

      {modal?.kind === 'add' && (
        <Modal title="记一笔" onClose={() => setModal(null)}>
          <TxForm
            assets={assets}
            onSubmit={(t) => {
              addTransaction(t)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.kind === 'edit' && (
        <Modal title="编辑交易" onClose={() => setModal(null)}>
          <TxForm
            assets={assets}
            initial={modal.tx}
            onSubmit={(t) => {
              updateTransaction(modal.tx.id, t)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function formatDetail(t: Transaction, cur: string): string {
  if (t.quantity != null && t.price != null) return `${fmtNum(t.quantity)} × ${fmtNum(t.price)} ${cur}`
  if (t.amount != null) return `${fmtNum(t.amount, 2)} ${cur}`
  if (t.value != null) return `市值 ${fmtNum(t.value, 2)} ${cur}`
  return '—'
}

function TxActions({
  onEdit,
  onDelete,
}: {
  t: Transaction
  onEdit: () => void
  onDelete: () => void
}) {
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
          if (confirm('删除这条记录?')) onDelete()
        }}
      >
        删除
      </button>
    </>
  )
}
