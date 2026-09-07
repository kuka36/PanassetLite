import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { StorageService } from '../services/storage'
import { usePortfolioEngine } from '../hooks/useSummary'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import Modal, { btnGhost, btnPrimary } from '../components/Modal'
import AssetForm from '../components/AssetForm'
import AssetDetail from '../components/AssetDetail'
import { RecordTxModals } from '../components/RecordTxModals'
import {
  isRecordTxModal,
  openRecordTx,
  type RecordTxModalState,
} from '../components/recordTxModal'
import TxForm from '../components/TxForm'
import { transferToTransactions } from '../utils/transfer'
import AssetFilters from '../components/AssetFilters'
import { SortTh } from '../components/SortTh'
import { Card, CardHeader } from '../components/ui/Card'
import NetWorthTrendChart from '../components/NetWorthTrendChart'
import { useTableSort } from '../hooks/useTableSort'
import type { Asset, AssetSnapshot, AssetType, Transaction } from '../types'
import { ASSET_TYPE_LABEL } from '../types'
import { fmtDateTime, fmtMoney, fmtNum, fmtPct, isAssetUpdateReminderStale, pnlColor, assetStaleUpdateCls } from '../utils/format'
import { sortBy, type SortState } from '../utils/tableSort'

const assetTheadCls = 'bg-slate-50/80'
const assetTheadRowCls = 'border-b border-slate-200/70 text-left text-xs text-slate-500'
const assetThBase = 'py-2.5 font-medium whitespace-nowrap'
const assetThName = `px-4 ${assetThBase}`
const assetThType = `px-3 ${assetThBase}`
const assetThNum = `px-2 ${assetThBase} text-right`
const assetThAction = `px-4 ${assetThBase} text-right`

type AssetSortKey =
  | 'name'
  | 'type'
  | 'quantity'
  | 'valueCNY'
  | 'totalPnlCNY'
  | 'xirr'
  | 'recentAnnualized'
  | 'lastUpdated'

const ASSET_TEXT_KEYS: readonly AssetSortKey[] = ['name', 'type']
const DEFAULT_ASSET_SORT: SortState<AssetSortKey> = { key: 'valueCNY', dir: 'desc' }

const ASSET_SORT_ACCESSORS: Record<AssetSortKey, (s: AssetSnapshot) => string | number | null | undefined> = {
  name: (s) => s.asset.name,
  type: (s) => ASSET_TYPE_LABEL[s.asset.type],
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
  const engine = usePortfolioEngine()
  const summary = useMemo(() => engine.summary(), [engine])
  const assets = useStore((s) => s.assets)
  const addAsset = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const settings = useStore((s) => s.settings)
  const addTransaction = useStore((s) => s.addTransaction)
  const addTransactions = useStore((s) => s.addTransactions)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const [modal, setModal] = useState<ModalState>(null)
  const [filterType, setFilterType] = useState(() => StorageService.loadAssetsFilterType())
  const [filterAsset, setFilterAsset] = useState(() => StorageService.loadAssetsFilterAsset())
  const { sort, handleSort } = useTableSort(DEFAULT_ASSET_SORT, ASSET_TEXT_KEYS)

  useEffect(() => {
    StorageService.saveAssetsFilterType(filterType)
  }, [filterType])

  useEffect(() => {
    StorageService.saveAssetsFilterAsset(filterAsset)
  }, [filterAsset])

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

  const hasAssets = summary.snapshots.length > 0

  const typeOptions = useMemo(() => {
    const counts = new Map<AssetType, number>()
    for (const s of summary.snapshots) {
      counts.set(s.asset.type, (counts.get(s.asset.type) ?? 0) + 1)
    }
    return [...counts.entries()].map(([type, count]) => ({ type, count }))
  }, [summary.snapshots])

  const assetOptions = useMemo(
    () =>
      summary.snapshots
        .filter((s) => !filterType || s.asset.type === filterType)
        .map((s) => ({ id: s.asset.id, name: s.asset.name })),
    [summary.snapshots, filterType],
  )

  const filteredSnapshots = useMemo(
    () =>
      summary.snapshots.filter(
        (s) =>
          (!filterType || s.asset.type === filterType) &&
          (!filterAsset || s.asset.id === filterAsset),
      ),
    [summary.snapshots, filterType, filterAsset],
  )

  const filteredAssets = useMemo(
    () => filteredSnapshots.map((s) => s.asset),
    [filteredSnapshots],
  )

  const sortedSnapshots = useMemo(
    () => sortBy(filteredSnapshots, sort, ASSET_SORT_ACCESSORS),
    [filteredSnapshots, sort],
  )

  const handleTypeChange = (type: string) => {
    setFilterType(type)
    if (filterAsset) {
      const snap = summary.snapshots.find((s) => s.asset.id === filterAsset)
      if (type && snap?.asset.type !== type) setFilterAsset('')
    }
  }

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

      {hasAssets && (
        <AssetFilters
          filterType={filterType}
          filterAsset={filterAsset}
          typeOptions={typeOptions}
          assetOptions={assetOptions}
          onTypeChange={handleTypeChange}
          onAssetChange={setFilterAsset}
          onClear={() => {
            setFilterType('')
            setFilterAsset('')
          }}
        />
      )}

      {filteredSnapshots.length > 0 && (
        <NetWorthTrendChart assets={filteredAssets} />
      )}

      {!hasAssets && (
        <p className="py-20 text-center text-sm text-slate-500">
          还没有任何资产,点击右上角「添加资产」开始。
        </p>
      )}

      {hasAssets && filteredSnapshots.length === 0 && (
        <p className="py-20 text-center text-sm text-slate-500">没有符合筛选条件的资产</p>
      )}

      {sortedSnapshots.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium text-slate-700">资产列表</h3>
          </CardHeader>

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
                    label="类型"
                    sortKey="type"
                    sort={sort}
                    onSort={handleSort}
                    className={assetThType}
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
                {sortedSnapshots.map((s) => (
                  <AssetTableRow
                    key={s.asset.id}
                    snap={s}
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

          <div className="space-y-2 p-4 md:hidden">
            {sortedSnapshots.map((s) => (
              <AssetMobileCard
                key={s.asset.id}
                snap={s}
                onOpen={() => setModal({ kind: 'detail', assetId: s.asset.id })}
                onRecordTx={() => setModal(openRecordTx({ asset: s.asset }))}
                onValuation={() =>
                  setModal(openRecordTx({ asset: s.asset, defaultType: 'VALUATION' }))
                }
              />
            ))}
          </div>
        </Card>
      )}

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
          onTransferSubmit={(t) => addTransactions(transferToTransactions(t, assets))}
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

function AssetTypeBadge({ type }: { type: AssetType }) {
  return (
    <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
      {ASSET_TYPE_LABEL[type]}
    </span>
  )
}

function AssetTableRow({
  snap: s,
  onOpen,
  onRecordTx,
  onValuation,
}: {
  snap: AssetSnapshot
  onOpen: () => void
  onRecordTx: () => void
  onValuation: () => void
}) {
  const type = s.asset.type
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
      <td className="px-3 py-2.5">
        <AssetTypeBadge type={type} />
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
        className={`px-2 py-2.5 text-right text-xs tabular-nums ${assetStaleUpdateCls(s)}`}
        title={isAssetUpdateReminderStale(s) ? '已超过一个月未更新,建议更新估值' : undefined}
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
  onOpen,
  onRecordTx,
  onValuation,
}: {
  snap: AssetSnapshot
  onOpen: () => void
  onRecordTx: () => void
  onValuation: () => void
}) {
  const type = s.asset.type
  return (
    <div
      className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors duration-200 active:bg-slate-50"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-slate-800">{s.asset.name}</span>
            <AssetTypeBadge type={type} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
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
        <span className={assetStaleUpdateCls(s)}>
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
