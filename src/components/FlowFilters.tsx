import { FilterBar, FilterClearButton } from './ui/FilterBar'
import { FilterRow } from './ui/FilterRow'
import { FilterChip } from './ui/FilterChip'
import SegmentedTabs from './ui/SegmentedTabs'

type FlowTab = 'asset' | 'strategy'

interface AssetOption {
  id: string
  name: string
  count?: number
}

interface StrategyOption {
  id: string
  name: string
  archived?: boolean
  count?: number
}

interface Props {
  tab: FlowTab
  onTabChange: (tab: FlowTab) => void
  filterAsset: string
  filterStrategyAsset: string
  filterStrategy: string
  assetOptions: AssetOption[]
  strategyOptions: StrategyOption[]
  onAssetChange: (id: string) => void
  onStrategyAssetChange: (id: string) => void
  onStrategyChange: (id: string) => void
  onClear: () => void
}

export default function FlowFilters({
  tab,
  onTabChange,
  filterAsset,
  filterStrategyAsset,
  filterStrategy,
  assetOptions,
  strategyOptions,
  onAssetChange,
  onStrategyAssetChange,
  onStrategyChange,
  onClear,
}: Props) {
  const hasFilter =
    tab === 'asset'
      ? !!filterAsset
      : !!filterStrategyAsset || !!filterStrategy

  return (
    <FilterBar actions={hasFilter ? <FilterClearButton onClick={onClear} /> : undefined}>
      <FilterRow label="账本">
        <SegmentedTabs
          value={tab}
          onChange={onTabChange}
          ariaLabel="流水类型"
          tabs={[
            { id: 'asset', label: '资产流水' },
            { id: 'strategy', label: '策略流水' },
          ]}
        />
      </FilterRow>

      {tab === 'asset' ? (
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
      ) : (
        <>
          <FilterRow label="资产" scroll>
            <FilterChip
              label="全部"
              active={!filterStrategyAsset}
              onClick={() => onStrategyAssetChange('')}
            />
            {assetOptions.map(({ id, name }) => (
              <FilterChip
                key={id}
                label={name}
                active={filterStrategyAsset === id}
                onClick={() => onStrategyAssetChange(id)}
              />
            ))}
          </FilterRow>

          <FilterRow label="策略" scroll>
            <FilterChip
              label="全部"
              active={!filterStrategy}
              onClick={() => onStrategyChange('')}
            />
            {strategyOptions.map(({ id, name, archived, count }) => (
              <FilterChip
                key={id}
                label={archived ? `${name}（已关闭）` : name}
                count={count}
                active={filterStrategy === id}
                onClick={() => onStrategyChange(id)}
              />
            ))}
          </FilterRow>
        </>
      )}
    </FilterBar>
  )
}
