import { useState } from 'react'
import type { StrategyLedgerRow, StrategySnapshot, StrategyTransaction } from '../types'
import { STRATEGY_KIND_LABEL, STRATEGY_TX_TYPE_LABEL } from '../types'
import { useStore } from '../store'
import { useStrategyEngine } from '../hooks/useStrategySummary'
import Modal from './Modal'
import StrategyTxForm from './StrategyTxForm'
import { btnGhost, btnPrimary } from './Modal'
import { fmtMoney, fmtNum, fmtPct, pnlColor } from '../utils/format'

type ModalState =
  | { kind: 'addTx' }
  | { kind: 'editTx'; tx: StrategyTransaction }
  | null

interface MiniProps {
  label: string
  value: string
  cls?: string
  title?: string
}

function Mini({ label, value, cls = '', title }: MiniProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3" title={title}>
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${cls || 'text-slate-700'}`}>{value}</p>
    </div>
  )
}

interface Props {
  snap: StrategySnapshot
  onClose: () => void
  onEdit: (snap: StrategySnapshot) => void
  onDelete: (snap: StrategySnapshot) => void
}

export default function StrategyDetail({ snap, onClose, onEdit, onDelete }: Props) {
  const { strategy } = snap
  const engine = useStrategyEngine()
  const addStrategyTransaction = useStore((s) => s.addStrategyTransaction)
  const updateStrategyTransaction = useStore((s) => s.updateStrategyTransaction)
  const deleteStrategyTransaction = useStore((s) => s.deleteStrategyTransaction)
  const [modal, setModal] = useState<ModalState>(null)

  const ledger: StrategyLedgerRow[] = engine.txLedger(strategy)
  const cur = strategy.currency

  const kindLabel = STRATEGY_KIND_LABEL[strategy.kind]

  return (
    <Modal
      title={
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0">{strategy.name}</span>
          {strategy.note && (
            <span className="truncate text-sm font-normal text-slate-500" title={strategy.note}>
              {strategy.note}
            </span>
          )}
          <span className="shrink-0 rounded-md bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
            {kindLabel}
          </span>
        </span>
      }
      onClose={onClose}
      size="xl"
    >
      {/* 指标卡 */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="当前市值" value={fmtMoney(snap.valueCNY)} />
        <Mini
          label="累计盈亏"
          value={fmtMoney(snap.totalPnlCNY)}
          cls={pnlColor(snap.totalPnlCNY)}
        />
        <Mini
          label="年化（XIRR）"
          title="自开始跟踪以来的内部收益率"
          value={snap.xirr != null ? fmtPct(snap.xirr) : '—'}
          cls={snap.xirr != null ? pnlColor(snap.xirr) : ''}
        />
        <Mini
          label={snap.recentAnnualized != null ? '近期年化' : '净投入'}
          title={snap.recentAnnualized != null ? '最近两次估值之间的区间年化' : undefined}
          value={
            snap.recentAnnualized != null
              ? fmtPct(snap.recentAnnualized)
              : fmtMoney(snap.netInvestedCNY)
          }
          cls={snap.recentAnnualized != null ? pnlColor(snap.recentAnnualized) : ''}
        />
      </div>

      {/* 操作栏 */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          账户流水不含此策略 · 计价货币 {cur}
        </p>
        <div className="flex gap-2">
          <button
            className={btnGhost + ' text-xs'}
            onClick={() => onEdit(snap)}
          >
            编辑策略
          </button>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-red-500 transition-all hover:bg-red-50"
            onClick={() => {
              if (confirm(`删除策略「${strategy.name}」及其所有流水？`)) onDelete(snap)
            }}
          >
            删除
          </button>
          <button
            className={btnPrimary + ' text-xs'}
            onClick={() => setModal({ kind: 'addTx' })}
          >
            + 记一笔
          </button>
        </div>
      </div>

      {/* 流水表 */}
      <div className="max-h-[min(50vh,28rem)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">日期</th>
              <th className="px-3 py-2 font-medium">类型</th>
              <th className="px-3 py-2 font-medium text-right">发生额（{cur}）</th>
              <th className="px-3 py-2 font-medium text-right">余额（{cur}）</th>
              <th className="px-3 py-2 font-medium text-right">区间变化</th>
              <th
                className="px-3 py-2 font-medium text-right"
                title="相对上一笔流水，扣除存取后的区间收益年化"
              >
                近期年化
              </th>
              <th className="px-3 py-2 font-medium">备注</th>
              <th className="px-3 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {ledger.map(({ tx, amountNative, balanceAfter, intervalGainNative, intervalAnnualized }) => (
              <tr key={tx.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-3 py-2 tabular-nums text-slate-500">{tx.date}</td>
                <td className="px-3 py-2 text-slate-700">{STRATEGY_TX_TYPE_LABEL[tx.type]}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {amountNative != null ? fmtNum(amountNative) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {fmtNum(balanceAfter)}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    intervalGainNative != null && intervalGainNative !== 0
                      ? pnlColor(intervalGainNative)
                      : 'text-slate-500'
                  }`}
                >
                  {intervalGainNative != null && intervalGainNative !== 0
                    ? fmtNum(intervalGainNative)
                    : '—'}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    intervalAnnualized != null ? pnlColor(intervalAnnualized) : 'text-slate-500'
                  }`}
                  title="相对上一笔流水，扣除存取后的区间收益年化"
                >
                  {intervalAnnualized != null ? fmtPct(intervalAnnualized) : '—'}
                </td>
                <td className="max-w-32 truncate px-3 py-2 text-xs text-slate-500">{tx.note}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="mr-3 text-xs text-blue-600 hover:underline"
                    onClick={() => setModal({ kind: 'editTx', tx })}
                  >
                    编辑
                  </button>
                  <button
                    className="text-xs text-slate-400 hover:text-red-600"
                    onClick={() => {
                      if (confirm('删除这条记录？')) deleteStrategyTransaction(tx.id)
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">
                  还没有流水，点击「记一笔」开始记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 子弹窗 */}
      {modal?.kind === 'addTx' && (
        <Modal title="记一笔" onClose={() => setModal(null)}>
          <StrategyTxForm
            strategyId={strategy.id}
            currency={cur}
            onSubmit={(t) => {
              addStrategyTransaction(t)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.kind === 'editTx' && (
        <Modal title="编辑流水" onClose={() => setModal(null)}>
          <StrategyTxForm
            strategyId={strategy.id}
            currency={cur}
            initial={modal.tx}
            onSubmit={(t) => {
              updateStrategyTransaction(modal.tx.id, t)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </Modal>
  )
}
