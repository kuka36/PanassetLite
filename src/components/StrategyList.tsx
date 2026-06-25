import type { Asset, StrategySnapshot } from '../types'
import { STRATEGY_KIND_LABEL } from '../types'
import { Card, CardBody } from './ui/Card'
import { fmtMoney, fmtPct, pnlColor, staleUpdateCls } from '../utils/format'

interface Props {
  snapshots: StrategySnapshot[]
  /** 已关闭策略（可选，渲染在分区下方） */
  closedSnapshots?: StrategySnapshot[]
  /** 资产映射，用于显示归属账户名（策略页全量视图使用） */
  assetMap?: Map<string, Asset>
  onSelect: (snap: StrategySnapshot) => void
  /** 新建按钮点击（可选，不传则不显示） */
  onAdd?: () => void
}

function StrategyCard({
  snap,
  asset,
  archived,
  onSelect,
}: {
  snap: StrategySnapshot
  asset?: Asset
  archived?: boolean
  onSelect: (snap: StrategySnapshot) => void
}) {
  const { strategy } = snap
  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => onSelect(snap)}
    >
      <Card
        className={`transition-all duration-200 hover:border-slate-200 hover:shadow-md active:scale-[0.99] ${
          archived ? 'bg-slate-50/80 opacity-75' : ''
        }`}
      >
        <CardBody className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`truncate font-medium ${archived ? 'text-slate-600' : 'text-slate-800'}`}>
                  {strategy.name}
                </span>
                <span className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                  {STRATEGY_KIND_LABEL[strategy.kind]}
                </span>
                {archived && (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    已关闭
                  </span>
                )}
              </div>
              {asset && (
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {asset.name}{asset.platform ? ` · ${asset.platform}` : ''}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-semibold tabular-nums ${archived ? 'text-slate-600' : 'text-slate-800'}`}>
                {fmtMoney(snap.valueCNY)}
              </p>
              <p className={`text-xs tabular-nums ${pnlColor(snap.totalPnlCNY)}`}>
                {snap.totalPnlCNY >= 0 ? '+' : ''}{fmtMoney(snap.totalPnlCNY)}
                {snap.xirr != null && (
                  <span className="ml-1 text-slate-500">
                    / {fmtPct(snap.xirr)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <p className="text-xs">
            <span className={staleUpdateCls(snap.lastUpdated)}>更新 {snap.lastUpdated ?? '—'}</span>
          </p>
        </CardBody>
      </Card>
    </button>
  )
}

export default function StrategyList({
  snapshots,
  closedSnapshots = [],
  assetMap,
  onSelect,
  onAdd,
}: Props) {
  const hasActive = snapshots.length > 0
  const hasClosed = closedSnapshots.length > 0

  if (!hasActive && !hasClosed) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <p className="text-sm text-slate-500">没有符合筛选条件的策略</p>
          {onAdd && (
            <button
              type="button"
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition-all hover:bg-slate-50"
              onClick={onAdd}
            >
              + 新建策略
            </button>
          )}
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {snapshots.map((snap) => (
        <StrategyCard
          key={snap.strategy.id}
          snap={snap}
          asset={assetMap?.get(snap.strategy.assetId)}
          onSelect={onSelect}
        />
      ))}

      {hasClosed && (
        <>
          <p className="pt-2 text-xs text-slate-400">已关闭的策略</p>
          {closedSnapshots.map((snap) => (
            <StrategyCard
              key={snap.strategy.id}
              snap={snap}
              asset={assetMap?.get(snap.strategy.assetId)}
              archived
              onSelect={onSelect}
            />
          ))}
        </>
      )}

      {onAdd && (
        <button
          type="button"
          className="w-full rounded-2xl border border-dashed border-slate-200 py-3 text-sm text-slate-500 transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700"
          onClick={onAdd}
        >
          + 新建策略
        </button>
      )}
    </div>
  )
}
