import { FilterChip } from './ui/FilterChip'
import { Card, CardBody } from './ui/Card'
import { STRATEGY_KIND_LABEL, type StrategyKind } from '../types'

const KIND_OPTIONS: { value: '' | StrategyKind; label: string }[] = [
  { value: '', label: '全部' },
  ...(Object.entries(STRATEGY_KIND_LABEL) as [StrategyKind, string][]).map(([value, label]) => ({
    value,
    label,
  })),
]

interface AssetOption {
  id: string
  name: string
  count: number
}

interface Props {
  filterAsset: string
  filterKind: string
  onAssetChange: (id: string) => void
  onKindChange: (kind: string) => void
  assetOptions: AssetOption[]
  onClear: () => void
  showClosed?: boolean
  archivedCount?: number
  onToggleClosed?: () => void
}

export default function StrategyFilters({
  filterAsset,
  filterKind,
  onAssetChange,
  onKindChange,
  assetOptions,
  onClear,
  showClosed = false,
  archivedCount = 0,
  onToggleClosed,
}: Props) {
  const hasFilter = !!filterAsset || !!filterKind

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 shrink-0 text-xs font-medium text-slate-500">类型</span>
              <div className="flex flex-wrap gap-2">
                {KIND_OPTIONS.map(({ value, label }) => (
                  <FilterChip
                    key={value || 'all'}
                    label={label}
                    active={filterKind === value}
                    onClick={() => onKindChange(value)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="w-10 shrink-0 pt-1.5 text-xs font-medium text-slate-500">账户</span>
              <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <FilterChip
                  label="全部"
                  active={!filterAsset}
                  onClick={() => onAssetChange('')}
                />
                {assetOptions.map(({ id, name, count }) => (
                  <FilterChip
                    key={id}
                    label={name}
                    count={count}
                    active={filterAsset === id}
                    onClick={() => onAssetChange(id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {((archivedCount > 0 && onToggleClosed) || hasFilter) && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {archivedCount > 0 && onToggleClosed && (
                <button
                  type="button"
                  className={`text-xs tabular-nums transition-colors ${
                    showClosed
                      ? 'font-medium text-sky-600 hover:text-sky-700'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={onToggleClosed}
                  title={showClosed ? '隐藏已关闭的策略' : '显示已关闭的策略'}
                >
                  已关闭 {archivedCount}
                </button>
              )}
              {hasFilter && (
                <button
                  type="button"
                  className="text-xs text-blue-600 transition-colors hover:text-blue-700"
                  onClick={onClear}
                >
                  清除筛选
                </button>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
