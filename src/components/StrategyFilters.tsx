import { FilterBar, FilterClearButton } from './ui/FilterBar'
import { FilterRow } from './ui/FilterRow'
import { FilterChip } from './ui/FilterChip'
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
  const showActions = (archivedCount > 0 && onToggleClosed) || hasFilter

  return (
    <FilterBar
      actions={
        showActions ? (
          <>
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
          {hasFilter && <FilterClearButton onClick={onClear} />}
          </>
        ) : undefined
      }
    >
      <FilterRow label="类型">
        {KIND_OPTIONS.map(({ value, label }) => (
          <FilterChip
            key={value || 'all'}
            label={label}
            active={filterKind === value}
            onClick={() => onKindChange(value)}
          />
        ))}
      </FilterRow>

      <FilterRow label="资产" scroll>
        <FilterChip label="全部" active={!filterAsset} onClick={() => onAssetChange('')} />
        {assetOptions.map(({ id, name, count }) => (
          <FilterChip
            key={id}
            label={name}
            count={count}
            active={filterAsset === id}
            onClick={() => onAssetChange(id)}
          />
        ))}
      </FilterRow>
    </FilterBar>
  )
}
