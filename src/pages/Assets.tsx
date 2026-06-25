import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { usePortfolioEngine, useSummary } from '../hooks/useSummary'
import { useStrategyEngine } from '../hooks/useStrategySummary'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import Modal, { btnGhost, btnPrimary } from '../components/Modal'
import AssetForm from '../components/AssetForm'
import {
  isRecordTxModal,
  openRecordTx,
  RecordTxModals,
  type RecordTxModalState,
} from '../components/RecordTxModals'
import TxForm from '../components/TxForm'
import StrategyList from '../components/StrategyList'
import StrategyDetail from '../components/StrategyDetail'
import StrategyForm from '../components/StrategyForm'
import { SortTh } from '../components/SortTh'
import { Card, CardHeader } from '../components/ui/Card'
import PeriodReturnsCard from '../components/PeriodReturnsCard'
import { color } from '../theme/colors'
import { useTableSort } from '../hooks/useTableSort'
import type { Asset, AssetSnapshot, AssetType, StrategySnapshot, Transaction, TxLedgerRow } from '../types'
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, TX_TYPE_LABEL, isQuantityBased } from '../types'
import { fmtDateTime, fmtMoney, fmtNum, fmtPct, isUpdateStale, pnlColor, staleUpdateCls } from '../utils/format'
import { sortBy, type SortState } from '../utils/tableSort'

const assetTheadCls = 'bg-slate-50/80'
const assetTheadRowCls = 'border-b border-slate-200/70 text-left text-xs text-slate-500'
const assetThBase = 'py-2.5 font-medium whitespace-nowrap'
const assetThName = `px-4 ${assetThBase}`
const assetThNum = `px-2 ${assetThBase} text-right`
const assetThAction = `px-4 ${assetThBase} text-right`

type AssetSortKey =
  | 'name'
  | 'quantity'
  | 'valueCNY'
  | 'totalPnlCNY'
  | 'xirr'
  | 'recentAnnualized'
  | 'lastUpdated'

const ASSET_TEXT_KEYS: readonly AssetSortKey[] = ['name']
const DEFAULT_ASSET_SORT: SortState<AssetSortKey> = { key: 'valueCNY', dir: 'desc' }

const ASSET_SORT_ACCESSORS: Record<AssetSortKey, (s: AssetSnapshot) => string | number | null | undefined> = {
  name: (s) => s.asset.name,
  quantity: (s) => s.quantity,
  valueCNY: (s) => s.valueCNY,
  totalPnlCNY: (s) => s.totalPnlCNY,
  xirr: (s) => s.xirr,
  recentAnnualized: (s) => s.recentAnnualized,
  lastUpdated: (s) => s.lastUpdated,
}

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; asset: Asset }
  | RecordTxModalState
  | { kind: 'editTx'; tx: Transaction; returnAssetId?: string }
  | { kind: 'detail'; assetId: string }
  | null

function closeRecordTxModal(txModal: RecordTxModalState, setModal: (m: ModalState) => void) {
  setModal(txModal.returnAssetId ? { kind: 'detail', assetId: txModal.returnAssetId } : null)
}

function closeEditTx(
  editModal: Extract<ModalState, { kind: 'editTx' }>,
  setModal: (m: ModalState) => void,
) {
  setModal(editModal.returnAssetId ? { kind: 'detail', assetId: editModal.returnAssetId } : null)
}

export default function Assets({
  onViewClosedStrategies,
  onViewAllFlows,
}: {
  onViewClosedStrategies?: (assetId: string) => void
  onViewAllFlows?: (assetId?: string) => void
} = {}) {
  const summary = useSummary()
  const assets = useStore((s) => s.assets)
  const addAsset = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const settings = useStore((s) => s.settings)
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const [modal, setModal] = useState<ModalState>(null)
  const { sort, handleSort } = useTableSort(DEFAULT_ASSET_SORT, ASSET_TEXT_KEYS)

  useKeyboardShortcuts(
    useMemo(
      () => [
        { key: 'a', action: () => setModal({ kind: 'add' }) },
        {
          key: 't',
          action: () => {
            if (assets.length > 0) setModal(openRecordTx())
          },
        },
      ],
      [assets.length],
    ),
    modal === null,
  )

  const groups = useMemo(() => {
    const map = new Map<AssetType, AssetSnapshot[]>()
    for (const s of summary.snapshots) {
      const list = map.get(s.asset.type) ?? []
      list.push(s)
      map.set(s.asset.type, list)
    }
    return [...map.entries()]
  }, [summary.snapshots])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">资产</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onViewAllFlows && (
            <button
              type="button"
              className={btnGhost}
              disabled={assets.length === 0}
              onClick={() => onViewAllFlows()}
            >
              全部流水
            </button>
          )}
          <button
            className={btnGhost}
            disabled={assets.length === 0}
            onClick={() => setModal(openRecordTx())}
          >
            记一笔
          </button>
          <button className={btnPrimary} onClick={() => setModal({ kind: 'add' })}>
            + 添加资产
          </button>
        </div>
      </div>

      {groups.length > 0 && (
        <PeriodReturnsCard
          title="资产概览"
          primary={[
            { label: '净资产', value: fmtMoney(summary.netWorthCNY), featured: true },
            { label: '总资产', value: fmtMoney(summary.totalAssetsCNY) },
            { label: '总负债', value: fmtMoney(summary.totalDebtCNY), accent: color.danger },
          ]}
          returns={summary.periodReturns}
          totalPnl={{
            label: '累计盈亏',
            amount: summary.totalPnlCNY,
            ratio: summary.totalPnlRatio,
          }}
        />
      )}

      {groups.length === 0 && (
        <p className="py-20 text-center text-sm text-slate-500">
          还没有任何资产,点击右上角「添加资产」开始。
        </p>
      )}

      {groups.map(([type, snaps]) => {
        const sortedSnaps = sortBy(snaps, sort, ASSET_SORT_ACCESSORS)
        return (
        <Card key={type}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: ASSET_TYPE_COLOR[type] }}
              />
              <h3 className="text-sm font-medium text-slate-700">{ASSET_TYPE_LABEL[type]}</h3>
              <span className="ml-auto text-sm tabular-nums text-slate-600">
                {fmtMoney(snaps.reduce((s, x) => s + x.valueCNY, 0))}
              </span>
            </div>
          </CardHeader>

          {/* 桌面端表格 */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className={assetTheadCls}>
                <tr className={assetTheadRowCls}>
                  <SortTh
                    label="名称"
                    sortKey="name"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThName}
                  />
                  <SortTh
                    label="持有"
                    sortKey="quantity"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThNum}
                    align="right"
                  />
                  <SortTh
                    label="市值"
                    sortKey="valueCNY"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThNum}
                    align="right"
                  />
                  <SortTh
                    label="累计盈亏"
                    sortKey="totalPnlCNY"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThNum}
                    align="right"
                  />
                  <SortTh
                    label="年化(XIRR)"
                    sortKey="xirr"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThNum}
                    align="right"
                    title="年化内部收益率（XIRR）：自持有以来的内部收益率，与「近期年化」口径不同"
                  />
                  <SortTh
                    label="近期年化"
                    sortKey="recentAnnualized"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThNum}
                    align="right"
                    title="最近两次估值之间的区间年化（已扣除区间内存取），非固定天数"
                  />
                  <SortTh
                    label="最近记录"
                    sortKey="lastUpdated"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThNum}
                    align="right"
                    title="末次流水或行情对应的业务时间；超过一个月未更新时数据行会标黄"
                  />
                  <th scope="col" className={assetThAction}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSnaps.map((s) => (
                  <AssetTableRow
                    key={s.asset.id}
                    snap={s}
                    type={type}
                    onOpen={() => setModal({ kind: 'detail', assetId: s.asset.id })}
                    onRecordTx={() => setModal(openRecordTx({ asset: s.asset }))}
                    onValuation={() =>
                      setModal(openRecordTx({ asset: s.asset, defaultType: 'VALUATION' }))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片 */}
          <div className="space-y-2 p-4 md:hidden">
            {sortedSnaps.map((s) => (
              <AssetMobileCard
                key={s.asset.id}
                snap={s}
                type={type}
                onOpen={() => setModal({ kind: 'detail', assetId: s.asset.id })}
                onRecordTx={() => setModal(openRecordTx({ asset: s.asset }))}
                onValuation={() =>
                  setModal(openRecordTx({ asset: s.asset, defaultType: 'VALUATION' }))
                }
              />
            ))}
          </div>
        </Card>
        )
      })}

      {modal?.kind === 'add' && (
        <Modal title="添加资产" onClose={() => setModal(null)}>
          <AssetForm
            onSubmit={(a) => {
              addAsset(a)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.kind === 'edit' && (
        <Modal title="编辑资产" onClose={() => setModal(null)}>
          <AssetForm
            initial={modal.asset}
            onSubmit={(a) => {
              updateAsset(modal.asset.id, a)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {isRecordTxModal(modal) && (
        <RecordTxModals
          modal={modal}
          assets={assets}
          settings={settings}
          onClose={() => closeRecordTxModal(modal, setModal)}
          onChange={setModal}
          onSubmit={addTransaction}
        />
      )}

      {modal?.kind === 'editTx' && (
        <Modal title="编辑流水" onClose={() => closeEditTx(modal, setModal)}>
          <TxForm
            assets={assets}
            fixedAssetId={modal.tx.assetId}
            initial={modal.tx}
            onSubmit={(t) => {
              updateTransaction(modal.tx.id, t)
              closeEditTx(modal, setModal)
            }}
            onCancel={() => closeEditTx(modal, setModal)}
          />
        </Modal>
      )}

      {modal?.kind === 'detail' && (
        <AssetDetail
          assetId={modal.assetId}
          onClose={() => setModal(null)}
          onEdit={(asset) => setModal({ kind: 'edit', asset })}
          onAddTx={(asset) => setModal(openRecordTx({ asset, returnAssetId: modal.assetId }))}
          onEditTx={(tx) => setModal({ kind: 'editTx', tx, returnAssetId: modal.assetId })}
          onDelete={(asset) => {
            if (confirm(`确定删除「${asset.name}」及其全部流水?此操作不可恢复。`)) {
              deleteAsset(asset.id)
              setModal(null)
            }
          }}
          onViewClosedStrategies={onViewClosedStrategies}
          onViewAllFlows={onViewAllFlows}
        />
      )}
    </div>
  )
}

function AssetTableRow({
  snap: s,
  type,
  onOpen,
  onRecordTx,
  onValuation,
}: {
  snap: AssetSnapshot
  type: AssetType
  onOpen: () => void
  onRecordTx: () => void
  onValuation: () => void
}) {
  return (
    <tr
      className="cursor-pointer border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/50"
      onClick={onOpen}
    >
      <td className="px-4 py-2.5">
        <div className="text-slate-700">{s.asset.name}</div>
        <div className="text-xs text-slate-500">
          {s.asset.platform}
          {s.asset.currency !== 'CNY' && ` · ${s.asset.currency}`}
          {s.asset.priceSource !== 'manual' && ' · 自动行情'}
        </div>
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">
        {s.quantity > 0 ? fmtNum(s.quantity) : '—'}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{fmtMoney(s.valueCNY)}</td>
      <td className={`px-2 py-2.5 text-right tabular-nums ${pnlColor(s.totalPnlCNY)}`}>
        {type === 'debt' ? '—' : `${s.totalPnlCNY > 0 ? '+' : ''}${fmtMoney(s.totalPnlCNY)}`}
      </td>
      <td
        className={`px-2 py-2.5 text-right tabular-nums ${s.xirr != null ? pnlColor(s.xirr) : 'text-slate-500'}`}
      >
        {s.xirr != null ? fmtPct(s.xirr) : '—'}
      </td>
      <td
        className={`px-2 py-2.5 text-right tabular-nums ${s.recentAnnualized != null ? pnlColor(s.recentAnnualized) : 'text-slate-500'}`}
      >
        {s.recentAnnualized != null ? fmtPct(s.recentAnnualized) : '—'}
      </td>
      <td
        className={`px-2 py-2.5 text-right text-xs tabular-nums ${staleUpdateCls(s.lastUpdated)}`}
        title={isUpdateStale(s.lastUpdated) ? '已超过一个月未更新,建议更新估值' : undefined}
      >
        {s.lastUpdated != null ? fmtDateTime(s.lastUpdated) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <button
          className="rounded-lg px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50"
          onClick={onRecordTx}
        >
          记一笔
        </button>
        <button
          className="rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
          onClick={onValuation}
        >
          更新估值
        </button>
      </td>
    </tr>
  )
}

function AssetMobileCard({
  snap: s,
  type,
  onOpen,
  onRecordTx,
  onValuation,
}: {
  snap: AssetSnapshot
  type: AssetType
  onOpen: () => void
  onRecordTx: () => void
  onValuation: () => void
}) {
  return (
    <div
      className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors duration-200 active:bg-slate-50"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800">{s.asset.name}</p>
          <p className="text-xs text-slate-500">
            {s.asset.platform}
            {s.asset.currency !== 'CNY' && ` · ${s.asset.currency}`}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-slate-800">{fmtMoney(s.valueCNY)}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {type !== 'debt' && (
          <span className={pnlColor(s.totalPnlCNY)}>
            盈亏 {s.totalPnlCNY > 0 ? '+' : ''}
            {fmtMoney(s.totalPnlCNY)}
          </span>
        )}
        {s.xirr != null && (
          <span className={pnlColor(s.xirr)} title="自持有以来的内部收益率（XIRR）">
            年化(XIRR) {fmtPct(s.xirr)}
          </span>
        )}
        {s.recentAnnualized != null && (
          <span
            className={pnlColor(s.recentAnnualized)}
            title="最近两次估值之间的区间年化（已扣除区间内存取）"
          >
            近期年化 {fmtPct(s.recentAnnualized)}
          </span>
        )}
        <span className={staleUpdateCls(s.lastUpdated)}>
          最近记录 {s.lastUpdated != null ? fmtDateTime(s.lastUpdated) : '—'}
        </span>
      </div>
      <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-blue-600"
          onClick={onRecordTx}
        >
          记一笔
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
          onClick={onValuation}
        >
          更新估值
        </button>
      </div>
    </div>
  )
}

function AssetDetail({
  assetId,
  onClose,
  onEdit,
  onAddTx,
  onEditTx,
  onDelete,
  onViewClosedStrategies,
  onViewAllFlows,
}: {
  assetId: string
  onClose: () => void
  onEdit: (a: Asset) => void
  onAddTx: (a: Asset) => void
  onEditTx: (t: Transaction) => void
  onDelete: (a: Asset) => void
  onViewClosedStrategies?: (assetId: string) => void
  onViewAllFlows?: (assetId?: string) => void
}) {
  const summary = useSummary()
  const engine = usePortfolioEngine()
  const strategyEngine = useStrategyEngine()
  const assets = useStore((s) => s.assets)
  const addStrategy = useStore((s) => s.addStrategy)
  const updateStrategy = useStore((s) => s.updateStrategy)
  const deleteStrategy = useStore((s) => s.deleteStrategy)
  const settings = useStore((s) => s.settings)
  const deleteTransaction = useStore((s) => s.deleteTransaction)
  const snap = summary.snapshots.find((s) => s.asset.id === assetId)
  const asset = snap?.asset

  type StrategyModalState =
    | { kind: 'addStrategy' }
    | { kind: 'editStrategy'; snap: StrategySnapshot }
    | { kind: 'detailStrategy'; snap: StrategySnapshot }
    | null
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
  const fx = asset.currency === settings.baseCurrency ? 1 : (settings.fxRates[asset.currency] ?? 1)
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
        <Mini label="当前市值" value={fmtMoney(snap.valueCNY)} />
        <Mini
          label="累计盈亏"
          value={asset.type === 'debt' ? '—' : fmtMoney(snap.totalPnlCNY)}
          cls={pnlColor(snap.totalPnlCNY)}
        />
        <Mini
          label="年化(XIRR)"
          title="自持有以来的内部收益率，与「近期年化」口径不同"
          value={snap.xirr != null ? fmtPct(snap.xirr) : '—'}
          cls={snap.xirr != null ? pnlColor(snap.xirr) : ''}
        />
        <Mini
          label={snap.quantity > 0 ? '持有数量' : '净投入'}
          value={snap.quantity > 0 ? fmtNum(snap.quantity) : fmtMoney(snap.netInvestedCNY)}
        />
      </div>

      <div className="mb-4 max-h-[min(50vh,28rem)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-100">
        {onViewAllFlows && (
          <div className="flex justify-end border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              className="text-xs text-blue-600 transition-colors hover:text-blue-700"
              onClick={() => onViewAllFlows(assetId)}
            >
              在全部流水中查看 →
            </button>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">时间</th>
              <th className="px-3 py-2 font-medium">类型</th>
              {qtyBased && (
                <>
                  <th className="px-3 py-2 font-medium text-right">数量</th>
                  <th className="px-3 py-2 font-medium text-right">单价</th>
                </>
              )}
              <th className="px-3 py-2 font-medium text-right">发生额</th>
              {showFx && <th className="px-3 py-2 font-medium text-right">折合 CNY</th>}
              <th className="px-3 py-2 font-medium text-right">余额</th>
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
            {ledger.map(({ tx, amountNative, balanceAfter, balanceLabel, intervalGainNative, intervalAnnualized }) => (
              <tr key={tx.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-3 py-2 text-xs tabular-nums text-slate-500">{fmtDateTime(tx.occurredAt)}</td>
                <td className="px-3 py-2 text-slate-700">{TX_TYPE_LABEL[tx.type]}</td>
                {qtyBased && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {tx.quantity != null ? fmtNum(tx.quantity) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {tx.price != null ? `${fmtNum(tx.price)} ${asset.currency}` : '—'}
                    </td>
                  </>
                )}
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {formatTxAmount(amountNative, asset.currency)}
                </td>
                {showFx && (
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {amountNative != null ? fmtMoney(amountNative * fx) : '—'}
                  </td>
                )}
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {formatTxBalance(balanceAfter, balanceLabel, asset.currency)}
                </td>
                {showInterval && (
                  <>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        intervalGainNative != null && intervalGainNative !== 0
                          ? pnlColor(intervalGainNative)
                          : 'text-slate-500'
                      }`}
                    >
                      {intervalGainNative != null && intervalGainNative !== 0
                        ? formatTxAmount(intervalGainNative, asset.currency)
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
                  </>
                )}
                <td className="max-w-32 truncate px-3 py-2 text-xs text-slate-500">{tx.note}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="mr-3 text-xs text-blue-600 hover:underline"
                    onClick={() => onEditTx(tx)}
                  >
                    编辑
                  </button>
                  <button
                    className="text-xs text-slate-500 hover:text-red-600"
                    onClick={() => {
                      if (confirm('删除这条流水?')) deleteTransaction(tx.id)
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-6 text-center text-slate-500">
                  暂无流水记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

      {/* 跟踪策略区块 */}
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
            {' '}账户市值 {fmtMoney(snap.valueCNY)}
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

function formatTxAmount(amount: number | null, currency: string): string {
  if (amount == null) return '—'
  return `${fmtNum(amount, 2)} ${currency}`
}

function formatTxBalance(
  balance: number,
  label: TxLedgerRow['balanceLabel'],
  currency: string,
): string {
  if (label === 'quantity') return `${fmtNum(balance)} 份`
  return `${fmtNum(balance, 2)} ${currency}`
}

function Mini({
  label,
  value,
  cls = 'text-slate-800',
  title,
}: {
  label: string
  value: string
  cls?: string
  title?: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3" title={title}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}
