import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { usePortfolioEngine } from '../hooks/useSummary'
import { useStrategyEngine } from '../hooks/useStrategySummary'
import Modal, { btnGhost, btnPrimary } from './Modal'
import StrategyList from './StrategyList'
import StrategyDetail from './StrategyDetail'
import StrategyForm from './StrategyForm'
import MiniStat from './ui/MiniStat'
import ValueLedgerTable from './ValueLedgerTable'
import type { Asset, StrategySnapshot, Transaction } from '../types'
import { TX_TYPE_LABEL, isQuantityBased } from '../types'
import { fmtMoney, fmtNum, fmtPct, pnlColor } from '../utils/format'
import { formatLedgerAmount, formatLedgerBalance } from '../utils/ledgerFormat'

export interface AssetDetailProps {
  assetId: string
  onClose: () => void
  onEdit: (a: Asset) => void
  onAddTx: (a: Asset) => void
  onEditTx: (t: Transaction) => void
  onDelete: (a: Asset) => void
  onViewClosedStrategies?: (assetId: string) => void
  onViewAllFlows?: (assetId?: string) => void
}

type StrategyModalState =
  | { kind: 'addStrategy' }
  | { kind: 'editStrategy'; snap: StrategySnapshot }
  | { kind: 'detailStrategy'; snap: StrategySnapshot }
  | null

export default function AssetDetail({
  assetId,
  onClose,
  onEdit,
  onAddTx,
  onEditTx,
  onDelete,
  onViewClosedStrategies,
  onViewAllFlows,
}: AssetDetailProps) {
  const engine = usePortfolioEngine()
  const summary = useMemo(() => engine.summary(), [engine])
  const strategyEngine = useStrategyEngine()
  const assets = useStore((s) => s.assets)
  const addStrategy = useStore((s) => s.addStrategy)
  const updateStrategy = useStore((s) => s.updateStrategy)
  const deleteStrategy = useStore((s) => s.deleteStrategy)
  const deleteTransaction = useStore((s) => s.deleteTransaction)
  const snap = summary.snapshots.find((s) => s.asset.id === assetId)
  const asset = snap?.asset

  const [strategyModal, setStrategyModal] = useState<StrategyModalState>(null)

  const strategySnapshots = useMemo(
    () => strategyEngine.snapshotsByAsset(assetId),
    [strategyEngine, assetId],
  )
  const closedStrategySnapshots = useMemo(
    () => strategyEngine.archivedSnapshotsByAsset(assetId),
    [strategyEngine, assetId],
  )
  const ledger = useMemo(() => {
    const s = summary.snapshots.find((s) => s.asset.id === assetId)
    if (!s) return []
    return engine.txLedger(s.asset)
  }, [engine, assetId, summary])

  if (!snap || !asset) return null

  const qtyBased = isQuantityBased(asset.type)
  const showFx = asset.currency !== 'CNY'
  const showInterval = !qtyBased && asset.type !== 'debt'
  const fx = engine.fx(asset.currency)
  const colSpan = (qtyBased ? 8 : showInterval ? 8 : 6) + (showFx ? 1 : 0)

  return (
    <Modal
      title={
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0">{asset.name}</span>
          {asset.note && (
            <span className="truncate text-sm font-normal text-slate-500" title={asset.note}>
              {asset.note}
            </span>
          )}
        </span>
      }
      onClose={onClose}
      size="xl"
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="当前市值" value={fmtMoney(snap.valueCNY)} />
        <MiniStat
          label="累计盈亏"
          value={asset.type === 'debt' ? '—' : fmtMoney(snap.totalPnlCNY)}
          valueClassName={pnlColor(snap.totalPnlCNY)}
        />
        <MiniStat
          label="年化(XIRR)"
          title="自持有以来的内部收益率，与「近期年化」口径不同"
          value={snap.xirr != null ? fmtPct(snap.xirr) : '—'}
          valueClassName={snap.xirr != null ? pnlColor(snap.xirr) : 'text-slate-800'}
        />
        <MiniStat
          label={snap.quantity > 0 ? '持有数量' : '净投入'}
          value={snap.quantity > 0 ? fmtNum(snap.quantity) : fmtMoney(snap.netInvestedCNY)}
        />
      </div>

      <div className="mb-4">
        <ValueLedgerTable
          rows={ledger}
          typeLabel={(row) => TX_TYPE_LABEL[row.tx.type]}
          formatAmount={(amount) => formatLedgerAmount(amount, asset.currency)}
          formatBalance={(balance, row) =>
            formatLedgerBalance(balance, row.balanceLabel, asset.currency)
          }
          formatIntervalGain={(gain) => formatLedgerAmount(gain, asset.currency)}
          showInterval={showInterval}
          emptyColSpan={colSpan}
          emptyMessage="暂无流水记录"
          onEdit={(row) => onEditTx(row.tx)}
          onDelete={deleteTransaction}
          toolbar={
            onViewAllFlows ? (
              <div className="flex justify-end border-b border-slate-100 px-3 py-2">
                <button
                  type="button"
                  className="text-xs text-blue-600 transition-colors hover:text-blue-700"
                  onClick={() => onViewAllFlows(assetId)}
                >
                  在全部流水中查看 →
                </button>
              </div>
            ) : undefined
          }
          beforeAmountHeaders={
            qtyBased ? (
              <>
                <th className="px-3 py-2 font-medium text-right">数量</th>
                <th className="px-3 py-2 font-medium text-right">单价</th>
              </>
            ) : undefined
          }
          beforeAmountCells={
            qtyBased
              ? (row) => (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {row.tx.quantity != null ? fmtNum(row.tx.quantity) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {row.tx.price != null ? `${fmtNum(row.tx.price)} ${asset.currency}` : '—'}
                    </td>
                  </>
                )
              : undefined
          }
          afterAmountHeaders={
            showFx ? (
              <th className="px-3 py-2 font-medium text-right">折合 CNY</th>
            ) : undefined
          }
          afterAmountCells={
            showFx
              ? (row) => (
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {row.amountNative != null ? fmtMoney(row.amountNative * fx) : '—'}
                  </td>
                )
              : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          className="text-sm text-red-600 transition-colors hover:text-red-700"
          onClick={() => onDelete(asset)}
        >
          删除资产
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => onEdit(asset)}>
            编辑资产信息
          </button>
          <button type="button" className={btnPrimary} onClick={() => onAddTx(asset)}>
            + 记一笔
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">跟踪策略</h3>
          <button
            className="text-xs text-blue-600 transition-colors hover:text-blue-700"
            onClick={() => setStrategyModal({ kind: 'addStrategy' })}
          >
            + 添加策略
          </button>
        </div>
        {strategySnapshots.length > 0 && (
          <p className="mb-2 text-xs text-slate-500">
            已跟踪 {fmtMoney(strategySnapshots.reduce((s, sn) => s + sn.valueCNY, 0))} ·
            {' '}策略市值 {fmtMoney(snap.valueCNY)}
            {' '}· 不计入净资产
          </p>
        )}
        <StrategyList
          snapshots={strategySnapshots}
          onSelect={(s) => setStrategyModal({ kind: 'detailStrategy', snap: s })}
        />
        {closedStrategySnapshots.length > 0 && onViewClosedStrategies && (
          <p className="mt-3 text-center text-xs text-slate-500">
            还有 {closedStrategySnapshots.length} 个已关闭的策略{' '}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => {
                onClose()
                onViewClosedStrategies(assetId)
              }}
            >
              查看
            </button>
          </p>
        )}
      </div>

      {strategyModal?.kind === 'addStrategy' && (
        <Modal title="添加策略" onClose={() => setStrategyModal(null)}>
          <StrategyForm
            assets={assets}
            fixedAssetId={assetId}
            onSubmit={(s) => {
              addStrategy(s)
              setStrategyModal(null)
            }}
            onCancel={() => setStrategyModal(null)}
          />
        </Modal>
      )}
      {strategyModal?.kind === 'editStrategy' && (
        <Modal title="编辑策略" onClose={() => setStrategyModal(null)}>
          <StrategyForm
            assets={assets}
            fixedAssetId={assetId}
            initial={strategyModal.snap.strategy}
            onSubmit={(s) => {
              updateStrategy(strategyModal.snap.strategy.id, s)
              setStrategyModal(null)
            }}
            onCancel={() => setStrategyModal(null)}
            onPermanentDelete={
              !strategyModal.snap.strategy.archived
                ? () => {
                    if (
                      confirm(
                        `永久删除策略「${strategyModal.snap.strategy.name}」及其全部流水？\n\n` +
                          '此操作不可恢复。若只是想停止跟踪，请使用「关闭策略」。',
                      )
                    ) {
                      deleteStrategy(strategyModal.snap.strategy.id)
                      setStrategyModal(null)
                    }
                  }
                : undefined
            }
          />
        </Modal>
      )}
      {strategyModal?.kind === 'detailStrategy' && (
        <StrategyDetail
          snap={
            strategyEngine.snapshotById(strategyModal.snap.strategy.id) ??
            strategyModal.snap
          }
          onClose={() => setStrategyModal(null)}
          onEdit={(s) => setStrategyModal({ kind: 'editStrategy', snap: s })}
          onArchive={(s) => updateStrategy(s.strategy.id, { archived: true })}
          onReopen={(s) => updateStrategy(s.strategy.id, { archived: false })}
          onDelete={(s) => {
            deleteStrategy(s.strategy.id)
            setStrategyModal(null)
          }}
        />
      )}
    </Modal>
  )
}
