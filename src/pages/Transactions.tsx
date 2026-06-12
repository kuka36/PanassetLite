import { useMemo, useState } from 'react'
import { useStore } from '../store'
import Modal, { btnPrimary, inputCls } from '../components/Modal'
import TxForm from '../components/TxForm'
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

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  const rows = useMemo(
    () =>
      transactions
        .filter((t) => !filterAsset || t.assetId === filterAsset)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [transactions, filterAsset],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-100">交易流水</h1>
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
          <button className={btnPrimary} onClick={() => setModal({ kind: 'add' })} disabled={assets.length === 0}>
            + 记一笔
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-normal">日期</th>
              <th className="px-3 py-3 font-normal">资产</th>
              <th className="px-3 py-3 font-normal">类型</th>
              <th className="px-3 py-3 font-normal text-right">明细</th>
              <th className="px-3 py-3 font-normal">备注</th>
              <th className="px-4 py-3 font-normal text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const asset = assetMap.get(t.assetId)
              const cur = asset?.currency ?? ''
              return (
                <tr key={t.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 tabular-nums text-slate-400">{t.date}</td>
                  <td className="px-3 py-2.5 text-slate-200">{asset?.name ?? '(已删除)'}</td>
                  <td className="px-3 py-2.5 text-slate-300">{TX_TYPE_LABEL[t.type]}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {t.quantity != null && t.price != null
                      ? `${fmtNum(t.quantity)} × ${fmtNum(t.price)} ${cur}`
                      : t.amount != null
                        ? `${fmtNum(t.amount, 2)} ${cur}`
                        : t.value != null
                          ? `市值 ${fmtNum(t.value, 2)} ${cur}`
                          : '—'}
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5 text-xs text-slate-500">{t.note}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      className="mr-3 text-xs text-sky-400 hover:underline"
                      onClick={() => setModal({ kind: 'edit', tx: t })}
                    >
                      编辑
                    </button>
                    <button
                      className="text-xs text-slate-500 hover:text-red-400"
                      onClick={() => {
                        if (confirm('删除这条记录?')) deleteTransaction(t.id)
                      }}
                    >
                      删除
                    </button>
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
