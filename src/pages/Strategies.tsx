import { useEffect, useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '../store'
import {
  useArchivedStrategySnapshots,
  useStrategyEngine,
  useStrategySnapshots,
} from '../hooks/useStrategySummary'
import { StorageService } from '../services/storage'
import Modal, { btnGhost, btnPrimary } from '../components/Modal'
import { SortTh } from '../components/SortTh'
import StrategyForm from '../components/StrategyForm'
import StrategyList from '../components/StrategyList'
import StrategyDetail from '../components/StrategyDetail'
import StrategyFilters from '../components/StrategyFilters'
import PeriodReturnsCard from '../components/PeriodReturnsCard'
import { Card, CardHeader } from '../components/ui/Card'
import { useTableSort } from '../hooks/useTableSort'
import type { StrategySnapshot } from '../types'
import { STRATEGY_KIND_LABEL } from '../types'
import { fmtDateTime, fmtMoney, fmtPct, isUpdateStale, pnlColor, staleUpdateCls } from '../utils/format'
import { sortBy, type SortState } from '../utils/tableSort'

type StrategySortKey = 'name' | 'kind' | 'asset' | 'valueCNY' | 'totalPnlCNY' | 'xirr' | 'recentAnnualized' | 'lastUpdated'

const STRATEGY_TEXT_KEYS: readonly StrategySortKey[] = ['name', 'kind', 'asset']
const DEFAULT_STRATEGY_SORT: SortState<StrategySortKey> = { key: 'valueCNY', dir: 'desc' }

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; snap: StrategySnapshot }
  | { kind: 'detail'; snap: StrategySnapshot }
  | null

export interface StrategiesInit {
  filterAsset?: string
  showClosed?: boolean
}

interface Props {
  initial?: StrategiesInit
  onViewAllFlows?: () => void
}

function filterSnapshots(
  snapshots: StrategySnapshot[],
  filterAsset: string,
  filterKind: string,
) {
  return snapshots.filter((s) => {
    if (filterAsset && s.strategy.assetId !== filterAsset) return false
    if (filterKind && s.strategy.kind !== filterKind) return false
    return true
  })
}

function StrategyTableRow({
  snap,
  assetMap,
  archived,
  onSelect,
}: {
  snap: StrategySnapshot
  assetMap: Map<string, { name: string; platform?: string }>
  archived?: boolean
  onSelect: (snap: StrategySnapshot) => void
}) {
  const { strategy } = snap
  const asset = assetMap.get(strategy.assetId)
  return (
    <tr
      key={strategy.id}
      className={`cursor-pointer border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/50 ${
        archived ? 'bg-slate-50/80 opacity-75' : ''
      }`}
      onClick={() => onSelect(snap)}
    >
      <td className={`px-4 py-2.5 font-medium ${archived ? 'text-slate-600' : 'text-slate-800'}`}>
        <span className="inline-flex flex-wrap items-center gap-2">
          {strategy.name}
          {archived && (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
              已关闭
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
          {STRATEGY_KIND_LABEL[strategy.kind]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-600">
        {asset?.name ?? '(已删除)'}
        {asset?.platform && (
          <span className="text-slate-400"> · {asset.platform}</span>
        )}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${archived ? 'text-slate-600' : 'text-slate-800'}`}>
        {fmtMoney(snap.valueCNY)}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${pnlColor(snap.totalPnlCNY)}`}>
        {snap.totalPnlCNY >= 0 ? '+' : ''}{fmtMoney(snap.totalPnlCNY)}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${snap.xirr != null ? pnlColor(snap.xirr) : 'text-slate-400'}`}>
        {snap.xirr != null ? fmtPct(snap.xirr) : '—'}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${snap.recentAnnualized != null ? pnlColor(snap.recentAnnualized) : 'text-slate-400'}`}>
        {snap.recentAnnualized != null ? fmtPct(snap.recentAnnualized) : '—'}
      </td>
      <td
        className={`px-3 py-2.5 text-right text-xs tabular-nums ${staleUpdateCls(snap.lastUpdated)}`}
        title={isUpdateStale(snap.lastUpdated) ? '已超过一个月未更新,建议更新估值' : undefined}
      >
        {snap.lastUpdated != null ? fmtDateTime(snap.lastUpdated) : '—'}
      </td>
    </tr>
  )
}

export default function Strategies({ initial, onViewAllFlows }: Props) {
  const assets = useStore((s) => s.assets)
  const addStrategy = useStore((s) => s.addStrategy)
  const updateStrategy = useStore((s) => s.updateStrategy)
  const deleteStrategy = useStore((s) => s.deleteStrategy)

  const allSnapshots = useStrategySnapshots()
  const archivedSnapshots = useArchivedStrategySnapshots()
  const engine = useStrategyEngine()

  const [filterAsset, setFilterAsset] = useState(
    () => initial?.filterAsset ?? StorageService.loadStrategiesFilterAsset(),
  )
  const [filterKind, setFilterKind] = useState(() => StorageService.loadStrategiesFilterKind())
  const [showClosed, setShowClosed] = useState(
    () => initial?.showClosed ?? StorageService.loadStrategiesShowClosed(),
  )
  const [modal, setModal] = useState<ModalState>(null)

  useEffect(() => {
    if (initial?.filterAsset != null) setFilterAsset(initial.filterAsset)
  }, [initial?.filterAsset])

  useEffect(() => {
    if (initial?.showClosed) {
      StorageService.saveStrategiesShowClosed(true)
    }
  }, [initial?.showClosed])

  useEffect(() => {
    StorageService.saveStrategiesFilterAsset(filterAsset)
  }, [filterAsset])

  useEffect(() => {
    StorageService.saveStrategiesFilterKind(filterKind)
  }, [filterKind])
  const { sort, handleSort } = useTableSort(DEFAULT_STRATEGY_SORT, STRATEGY_TEXT_KEYS)

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const activeAssets = assets.filter((a) => !a.archived)

  const assetOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of allSnapshots) {
      counts.set(s.strategy.assetId, (counts.get(s.strategy.assetId) ?? 0) + 1)
    }
    if (showClosed) {
      for (const s of archivedSnapshots) {
        counts.set(s.strategy.assetId, (counts.get(s.strategy.assetId) ?? 0) + 1)
      }
    }
    return [...counts.entries()].map(([id, count]) => ({
      id,
      name: assetMap.get(id)?.name ?? '(已删除)',
      count,
    }))
  }, [allSnapshots, archivedSnapshots, showClosed, assetMap])

  const filtered = useMemo(
    () => filterSnapshots(allSnapshots, filterAsset, filterKind),
    [allSnapshots, filterAsset, filterKind],
  )

  const filteredClosed = useMemo(
    () => filterSnapshots(archivedSnapshots, filterAsset, filterKind),
    [archivedSnapshots, filterAsset, filterKind],
  )

  const strategyAccessors = useMemo(
    (): Record<StrategySortKey, (s: StrategySnapshot) => string | number | null | undefined> => ({
      name: (s) => s.strategy.name,
      kind: (s) => STRATEGY_KIND_LABEL[s.strategy.kind],
      asset: (s) => assetMap.get(s.strategy.assetId)?.name ?? '',
      valueCNY: (s) => s.valueCNY,
      totalPnlCNY: (s) => s.totalPnlCNY,
      xirr: (s) => s.xirr,
      recentAnnualized: (s) => s.recentAnnualized,
      lastUpdated: (s) => s.lastUpdated,
    }),
    [assetMap],
  )

  const sorted = useMemo(
    () => sortBy(filtered, sort, strategyAccessors),
    [filtered, sort, strategyAccessors],
  )

  const sortedClosed = useMemo(
    () => sortBy(filteredClosed, sort, strategyAccessors),
    [filteredClosed, sort, strategyAccessors],
  )

  const totalValue = filtered.reduce((sum, s) => sum + s.valueCNY, 0)
  const totalPnl = filtered.reduce((sum, s) => sum + s.totalPnlCNY, 0)
  const totalNetInvested = filtered.reduce((sum, s) => sum + s.netInvestedCNY, 0)
  const totalPnlRatio = totalNetInvested > 0 ? totalPnl / totalNetInvested : null

  const filteredStrategies = useMemo(() => filtered.map((s) => s.strategy), [filtered])
  const periodReturns = useMemo(
    () => engine.periodReturnsForStrategies(filteredStrategies),
    [engine, filteredStrategies],
  )

  const refreshSnap = (old: StrategySnapshot): StrategySnapshot =>
    engine.snapshotById(old.strategy.id) ?? old

  const toggleShowClosed = () => {
    setShowClosed((v) => {
      const next = !v
      StorageService.saveStrategiesShowClosed(next)
      return next
    })
  }

  const openShowClosed = () => {
    setShowClosed(true)
    StorageService.saveStrategiesShowClosed(true)
  }

  const hasAnyStrategy = allSnapshots.length > 0 || archivedSnapshots.length > 0
  const onlyArchived = allSnapshots.length === 0 && archivedSnapshots.length > 0

  const modals = (
    <>
      {modal?.kind === 'add' && (
        <Modal title="添加策略" onClose={() => setModal(null)}>
          <StrategyForm
            assets={assets}
            onSubmit={(s) => {
              addStrategy(s)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.kind === 'edit' && (
        <Modal title="编辑策略" onClose={() => setModal(null)}>
          <StrategyForm
            assets={assets}
            fixedAssetId={modal.snap.strategy.assetId}
            initial={modal.snap.strategy}
            onSubmit={(s) => {
              updateStrategy(modal.snap.strategy.id, s)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
            onPermanentDelete={
              !modal.snap.strategy.archived
                ? () => {
                    if (
                      confirm(
                        `永久删除策略「${modal.snap.strategy.name}」及其全部流水？\n\n` +
                          '此操作不可恢复。若只是想停止跟踪，请使用「关闭策略」。',
                      )
                    ) {
                      deleteStrategy(modal.snap.strategy.id)
                      setModal(null)
                    }
                  }
                : undefined
            }
          />
        </Modal>
      )}

      {modal?.kind === 'detail' && (
        <StrategyDetail
          snap={refreshSnap(modal.snap)}
          onClose={() => setModal(null)}
          onEdit={(snap) => setModal({ kind: 'edit', snap })}
          onArchive={(snap) => updateStrategy(snap.strategy.id, { archived: true })}
          onReopen={(snap) => updateStrategy(snap.strategy.id, { archived: false })}
          onDelete={(snap) => {
            deleteStrategy(snap.strategy.id)
            setModal(null)
          }}
        />
      )}
    </>
  )

  if (!hasAnyStrategy) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800">策略</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {onViewAllFlows && (
              <button type="button" className={btnGhost} onClick={onViewAllFlows}>
                全部流水
              </button>
            )}
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setModal({ kind: 'add' })}
              disabled={activeAssets.length === 0}
            >
              + 添加策略
            </button>
          </div>
        </div>

        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Target className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">单独跟踪资产内的投资策略</h2>
          <p className="max-w-md text-sm text-slate-500">
            策略是对资产内部分资金的独立收益分析透镜，如定投、网格机器人。
            策略流水与资产流水完全隔离，不影响净资产统计。
          </p>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setModal({ kind: 'add' })}
            disabled={activeAssets.length === 0}
          >
            + 添加第一个策略
          </button>
        </div>

        {modals}
      </div>
    )
  }

  if (onlyArchived && !showClosed) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800">策略</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {onViewAllFlows && (
              <button type="button" className={btnGhost} onClick={onViewAllFlows}>
                全部流水
              </button>
            )}
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setModal({ kind: 'add' })}
              disabled={activeAssets.length === 0}
            >
              + 添加策略
            </button>
          </div>
        </div>

        <div className="flex h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Target className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">暂无进行中的策略</h2>
          <p className="max-w-md text-sm text-slate-500">
            你有 {archivedSnapshots.length} 个已关闭的策略可查看。
          </p>
          <button
            type="button"
            className={btnGhost}
            onClick={openShowClosed}
          >
            显示已关闭
          </button>
        </div>

        {modals}
      </div>
    )
  }

  const tableEmpty = sorted.length === 0 && (!showClosed || sortedClosed.length === 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">策略</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onViewAllFlows && (
            <button type="button" className={btnGhost} onClick={onViewAllFlows}>
              全部流水
            </button>
          )}
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setModal({ kind: 'add' })}
            disabled={activeAssets.length === 0}
          >
            + 添加策略
          </button>
        </div>
      </div>

      <StrategyFilters
        filterAsset={filterAsset}
        filterKind={filterKind}
        onAssetChange={setFilterAsset}
        onKindChange={setFilterKind}
        assetOptions={assetOptions}
        onClear={() => {
          setFilterAsset('')
          setFilterKind('')
        }}
        showClosed={showClosed}
        archivedCount={archivedSnapshots.length}
        onToggleClosed={toggleShowClosed}
      />

      {filtered.length > 0 && (
        <PeriodReturnsCard
          title="策略概览"
          primary={[
            { label: '跟踪市值', value: fmtMoney(totalValue), sub: '不计入净资产' },
            {
              label: '策略数量',
              value: String(filtered.length),
              sub: filterAsset || filterKind ? '已筛选' : undefined,
            },
          ]}
          returns={periodReturns}
          totalPnl={{
            label: '累计盈亏',
            amount: totalPnl,
            ratio: totalPnlRatio,
          }}
        />
      )}

      <Card className="hidden overflow-hidden md:block">
        <CardHeader>
          <h3 className="text-sm font-medium text-slate-700">策略列表</h3>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
                <SortTh label="策略名称" sortKey="name" sort={sort} onSort={handleSort} className="px-4 py-3 font-medium" />
                <SortTh label="类型" sortKey="kind" sort={sort} onSort={handleSort} className="px-3 py-3 font-medium" />
                <SortTh label="归属资产" sortKey="asset" sort={sort} onSort={handleSort} className="px-3 py-3 font-medium" />
                <SortTh label="市值" sortKey="valueCNY" sort={sort} onSort={handleSort} className="px-3 py-3 font-medium" align="right" />
                <SortTh label="累计盈亏" sortKey="totalPnlCNY" sort={sort} onSort={handleSort} className="px-3 py-3 font-medium" align="right" />
                <SortTh label="年化(XIRR)" sortKey="xirr" sort={sort} onSort={handleSort} className="px-3 py-3 font-medium" align="right" title="自开始跟踪以来的内部收益率" />
                <SortTh
                  label="近期年化"
                  sortKey="recentAnnualized"
                  sort={sort}
                  onSort={handleSort}
                  className="px-3 py-3 font-medium"
                  align="right"
                  title="最近两次估值之间的区间年化"
                />
                <SortTh
                  label="最近记录"
                  sortKey="lastUpdated"
                  sort={sort}
                  onSort={handleSort}
                  className="px-3 py-3 font-medium"
                  align="right"
                  title="末次流水对应的业务时间；超过一个月未更新时数据行会标黄"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((snap) => (
                <StrategyTableRow
                  key={snap.strategy.id}
                  snap={snap}
                  assetMap={assetMap}
                  onSelect={(s) => setModal({ kind: 'detail', snap: s })}
                />
              ))}
              {showClosed && sortedClosed.length > 0 && (
                <tr className="border-t border-slate-200 bg-slate-50/50">
                  <td colSpan={8} className="px-4 py-2 text-xs text-slate-400">
                    已关闭的策略
                  </td>
                </tr>
              )}
              {showClosed &&
                sortedClosed.map((snap) => (
                  <StrategyTableRow
                    key={snap.strategy.id}
                    snap={snap}
                    assetMap={assetMap}
                    archived
                    onSelect={(s) => setModal({ kind: 'detail', snap: s })}
                  />
                ))}
              {tableEmpty && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    没有符合筛选条件的策略
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="md:hidden">
        <StrategyList
          snapshots={sorted}
          closedSnapshots={showClosed ? sortedClosed : []}
          assetMap={assetMap}
          onSelect={(snap) => setModal({ kind: 'detail', snap })}
          onAdd={() => setModal({ kind: 'add' })}
        />
      </div>

      {modals}
    </div>
  )
}
