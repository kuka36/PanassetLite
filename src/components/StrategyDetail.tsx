import { useMemo, useState } from 'react'
import type { StrategyLedgerRow, StrategySnapshot, StrategyTransaction } from '../types'
import { STRATEGY_KIND_LABEL, STRATEGY_TX_TYPE_LABEL } from '../types'
import { useStore } from '../store'
import { useStrategyEngine } from '../hooks/useStrategySummary'
import Modal from './Modal'
import StrategyTxForm from './StrategyTxForm'
import EChart from './EChart'
import { lightAxis, lightTooltip } from './chartTheme'
import { btnGhost, btnPrimary } from './Modal'
import { hexAlpha, palette } from '../theme/colors'
import { fmtCompact, fmtDateTime, fmtMoney, fmtNum, fmtPct, pnlColor } from '../utils/format'
import { formatDateKey } from '../utils/time'

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

function needsValuationHint(lastUpdated?: number): boolean {
  if (lastUpdated == null) return true
  const days = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24)
  return days > 90
}

function confirmCloseStrategy(snap: StrategySnapshot): boolean {
  const { strategy, lastUpdated } = snap
  let msg =
    `确定关闭策略「${strategy.name}」？\n\n` +
    '关闭后将从进行中列表隐藏，历史流水保留。\n' +
    '可随时重新开启。'
  if (needsValuationHint(lastUpdated)) {
    msg += '\n\n建议：关闭前先记一笔估值，保留最终快照。'
  }
  return confirm(msg)
}

function confirmPermanentDelete(name: string): boolean {
  return confirm(
    `永久删除策略「${name}」及其全部流水？\n\n` +
      '此操作不可恢复。若只是想停止跟踪，请使用「关闭策略」。',
  )
}

interface Props {
  snap: StrategySnapshot
  onClose: () => void
  onEdit: (snap: StrategySnapshot) => void
  onArchive: (snap: StrategySnapshot) => void
  onReopen: (snap: StrategySnapshot) => void
  onDelete: (snap: StrategySnapshot) => void
}

export default function StrategyDetail({
  snap,
  onClose,
  onEdit,
  onArchive,
  onReopen,
  onDelete,
}: Props) {
  const { strategy } = snap
  const archived = !!strategy.archived
  const engine = useStrategyEngine()
  const addStrategyTransaction = useStore((s) => s.addStrategyTransaction)
  const updateStrategyTransaction = useStore((s) => s.updateStrategyTransaction)
  const deleteStrategyTransaction = useStore((s) => s.deleteStrategyTransaction)
  const [modal, setModal] = useState<ModalState>(null)

  const ledger: StrategyLedgerRow[] = engine.txLedger(strategy)
  const cur = strategy.currency
  const kindLabel = STRATEGY_KIND_LABEL[strategy.kind]

  // 市值趋势：ledger 为 newest-first，按日期取每日最终余额，按时间正序绘制
  const trend = useMemo(() => {
    const byDate = new Map<string, number>()
    for (let i = ledger.length - 1; i >= 0; i--) {
      byDate.set(formatDateKey(ledger[i].tx.occurredAt), ledger[i].balanceAfter)
    }
    return { dates: [...byDate.keys()], values: [...byDate.values()] }
  }, [ledger])

  const trendOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        ...lightTooltip,
        valueFormatter: (v: unknown) => fmtNum(Number(v)),
      },
      grid: { left: 12, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: trend.dates,
        ...lightAxis,
        boundaryGap: false,
      },
      yAxis: {
        type: 'value' as const,
        ...lightAxis,
        axisLabel: { color: palette.textMuted, formatter: (v: number) => fmtCompact(v) },
        scale: true,
      },
      series: [
        {
          name: '市值',
          type: 'line' as const,
          data: trend.values.map((v) => Math.round(v)),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: palette.blue600 },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexAlpha(palette.blue600, 0.2) },
                { offset: 1, color: hexAlpha(palette.blue600, 0.02) },
              ],
            },
          },
        },
      ],
    }),
    [trend],
  )

  return (
    <Modal
      title={
        <span className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="shrink-0">{strategy.name}</span>
          {strategy.note && (
            <span className="truncate text-sm font-normal text-slate-500" title={strategy.note}>
              {strategy.note}
            </span>
          )}
          <span className="shrink-0 rounded-md bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
            {kindLabel}
          </span>
          {archived && (
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              已关闭
            </span>
          )}
        </span>
      }
      onClose={onClose}
      size="xl"
    >
      {archived && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            此策略已关闭，不再跟踪新流水。可查看历史数据，或编辑已有记录纠错。
          </p>
          <button
            type="button"
            className={btnGhost + ' shrink-0 text-xs'}
            onClick={() => onReopen(snap)}
          >
            重新开启
          </button>
        </div>
      )}

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

      {/* 市值趋势 */}
      {trend.dates.length >= 2 && (
        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="mb-1 text-xs text-slate-400">市值趋势（{cur}）</p>
          <EChart option={trendOption} height={200} />
        </div>
      )}

      {/* 操作栏 */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          账户流水不含此策略 · 计价货币 {cur}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {!archived && (
            <button
              type="button"
              className={btnGhost + ' text-xs'}
              onClick={() => {
                if (confirmCloseStrategy(snap)) onArchive(snap)
              }}
            >
              关闭策略
            </button>
          )}
          <button
            type="button"
            className={btnGhost + ' text-xs'}
            onClick={() => onEdit(snap)}
          >
            编辑策略
          </button>
          {archived && (
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-red-500 transition-all hover:bg-red-50"
              onClick={() => {
                if (confirmPermanentDelete(strategy.name)) onDelete(snap)
              }}
            >
              永久删除
            </button>
          )}
          {!archived && (
            <button
              type="button"
              className={btnPrimary + ' text-xs'}
              onClick={() => setModal({ kind: 'addTx' })}
            >
              + 记一笔
            </button>
          )}
        </div>
      </div>

      {/* 流水表 */}
      <div className="max-h-[min(50vh,28rem)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">时间</th>
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
                <td className="px-3 py-2 text-xs tabular-nums text-slate-500">{fmtDateTime(tx.occurredAt)}</td>
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
                    type="button"
                    className="mr-3 text-xs text-blue-600 hover:underline"
                    onClick={() => setModal({ kind: 'editTx', tx })}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
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
                  {archived ? '暂无流水记录' : '还没有流水，点击「记一笔」开始记录'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
