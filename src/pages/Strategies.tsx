import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '../store'
import { useStrategyEngine, useStrategySnapshots } from '../hooks/useStrategySummary'
import Modal, { btnPrimary } from '../components/Modal'
import StrategyForm from '../components/StrategyForm'
import StrategyList from '../components/StrategyList'
import StrategyDetail from '../components/StrategyDetail'
import StrategyFilters from '../components/StrategyFilters'
import { Card, CardHeader, MetricCard } from '../components/ui/Card'
import type { StrategySnapshot } from '../types'
import { STRATEGY_KIND_LABEL } from '../types'
import { fmtMoney, fmtPct, pnlColor } from '../utils/format'

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; snap: StrategySnapshot }
  | { kind: 'detail'; snap: StrategySnapshot }
  | null

export default function Strategies() {
  const assets = useStore((s) => s.assets)
  const addStrategy = useStore((s) => s.addStrategy)
  const updateStrategy = useStore((s) => s.updateStrategy)
  const deleteStrategy = useStore((s) => s.deleteStrategy)

  const allSnapshots = useStrategySnapshots()
  const engine = useStrategyEngine()

  const [filterAsset, setFilterAsset] = useState('')
  const [filterKind, setFilterKind] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const activeAssets = assets.filter((a) => !a.archived)

  const assetOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of allSnapshots) {
      counts.set(s.strategy.assetId, (counts.get(s.strategy.assetId) ?? 0) + 1)
    }
    return [...counts.entries()].map(([id, count]) => ({
      id,
      name: assetMap.get(id)?.name ?? '(已删除)',
      count,
    }))
  }, [allSnapshots, assetMap])

  const filtered = useMemo(() => {
    return allSnapshots.filter((s) => {
      if (filterAsset && s.strategy.assetId !== filterAsset) return false
      if (filterKind && s.strategy.kind !== filterKind) return false
      return true
    })
  }, [allSnapshots, filterAsset, filterKind])

  const totalValue = filtered.reduce((sum, s) => sum + s.valueCNY, 0)
  const totalPnl = filtered.reduce((sum, s) => sum + s.totalPnlCNY, 0)

  const refreshSnap = (old: StrategySnapshot): StrategySnapshot =>
    engine.snapshot(old.strategy)

  if (allSnapshots.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800">跟踪策略</h1>
          <button
            className={btnPrimary}
            onClick={() => setModal({ kind: 'add' })}
            disabled={activeAssets.length === 0}
          >
            + 新建策略
          </button>
        </div>

        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Target className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">单独跟踪账户内的投资策略</h2>
          <p className="max-w-md text-sm text-slate-500">
            策略是对账户内部分资金的独立收益分析透镜，如定投、网格机器人。
            策略流水与资产流水完全隔离，不影响净资产统计。
          </p>
          <button
            className={btnPrimary}
            onClick={() => setModal({ kind: 'add' })}
            disabled={activeAssets.length === 0}
          >
            + 新建第一个策略
          </button>
        </div>

        {modal?.kind === 'add' && (
          <Modal title="新建策略" onClose={() => setModal(null)}>
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">跟踪策略</h1>
        <button
          className={btnPrimary}
          onClick={() => setModal({ kind: 'add' })}
          disabled={activeAssets.length === 0}
        >
          + 新建策略
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          label="跟踪市值"
          value={fmtMoney(totalValue)}
          sub="不计入净资产"
        />
        <MetricCard
          label="累计盈亏"
          value={`${totalPnl >= 0 ? '+' : ''}${fmtMoney(totalPnl)}`}
          accent={pnlColor(totalPnl)}
        />
        <MetricCard
          label="策略数量"
          value={String(filtered.length)}
          sub={filterAsset || filterKind ? '已筛选' : undefined}
        />
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
      />

      {/* 桌面端表格 */}
      <Card className="hidden overflow-hidden md:block">
        <CardHeader>
          <h3 className="text-sm font-medium text-slate-700">策略列表</h3>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">策略名称</th>
                <th className="px-3 py-3 font-medium">类型</th>
                <th className="px-3 py-3 font-medium">归属账户</th>
                <th className="px-3 py-3 font-medium text-right">市值</th>
                <th className="px-3 py-3 font-medium text-right">累计盈亏</th>
                <th className="px-3 py-3 font-medium text-right">年化(XIRR)</th>
                <th className="px-3 py-3 font-medium text-right">更新于</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((snap) => {
                const { strategy } = snap
                const asset = assetMap.get(strategy.assetId)
                return (
                  <tr
                    key={strategy.id}
                    className="cursor-pointer border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/50"
                    onClick={() => setModal({ kind: 'detail', snap })}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800">{strategy.name}</td>
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
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-800">
                      {fmtMoney(snap.valueCNY)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${pnlColor(snap.totalPnlCNY)}`}>
                      {snap.totalPnlCNY >= 0 ? '+' : ''}{fmtMoney(snap.totalPnlCNY)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${snap.xirr != null ? pnlColor(snap.xirr) : 'text-slate-400'}`}>
                      {snap.xirr != null ? fmtPct(snap.xirr) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                      {snap.lastUpdated ?? '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    没有符合筛选条件的策略
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 移动端卡片列表 */}
      <div className="md:hidden">
        <StrategyList
          snapshots={filtered}
          assetMap={assetMap}
          onSelect={(snap) => setModal({ kind: 'detail', snap })}
          onAdd={() => setModal({ kind: 'add' })}
        />
      </div>

      {modal?.kind === 'add' && (
        <Modal title="新建策略" onClose={() => setModal(null)}>
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
          />
        </Modal>
      )}

      {modal?.kind === 'detail' && (
        <StrategyDetail
          snap={refreshSnap(modal.snap)}
          onClose={() => setModal(null)}
          onEdit={(snap) => setModal({ kind: 'edit', snap })}
          onDelete={(snap) => {
            deleteStrategy(snap.strategy.id)
            setModal(null)
          }}
        />
      )}
    </div>
  )
}
