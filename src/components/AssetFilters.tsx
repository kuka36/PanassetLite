import { FilterBar, FilterClearButton } from './ui/FilterBar'
import { FilterRow } from './ui/FilterRow'
import { FilterChip } from './ui/FilterChip'
import { ASSET_TYPE_LABEL, type AssetType } from '../types'

interface TypeOption {
  type: AssetType
  count: number
}

interface AssetOption {
  id: string
  name: string
}

interface Props {
  filterType: string
  filterAsset: string
  typeOptions: TypeOption[]
  assetOptions: AssetOption[]
  onTypeChange: (type: string) => void
  onAssetChange: (id: string) => void
  onClear: () => void
}

export default function AssetFilters({
  filterType,
  filterAsset,
  typeOptions,
  assetOptions,
  onTypeChange,
  onAssetChange,
  onClear,
}: Props) {
  const hasFilter = !!filterType || !!filterAsset

  return (
    <FilterBar actions={hasFilter ? <FilterClearButton onClick={onClear} /> : undefined}>
      <FilterRow label="类型">
        <FilterChip label="全部" active={!filterType} onClick={() => onTypeChange('')} />
        {typeOptions.map(({ type, count }) => (
          <FilterChip
            key={type}
            label={ASSET_TYPE_LABEL[type]}
            count={count}
            active={filterType === type}
            onClick={() => onTypeChange(type)}
          />
        ))}
      </FilterRow>

      <FilterRow label="名称" scroll>
        <FilterChip label="全部" active={!filterAsset} onClick={() => onAssetChange('')} />
        {assetOptions.map(({ id, name }) => (
          <FilterChip
            key={id}
            label={name}
            active={filterAsset === id}
            onClick={() => onAssetChange(id)}
          />
        ))}
      </FilterRow>
    </FilterBar>
  )
}
