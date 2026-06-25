import type { SortState } from '../utils/tableSort'

export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = 'left',
  title,
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onSort: (key: K) => void
  className: string
  align?: 'left' | 'right'
  title?: string
}) {
  const active = sort.key === sortKey
  return (
    <th scope="col" className={className} title={title}>
      <button
        type="button"
        className={`inline-flex w-full items-center gap-1 transition-colors hover:text-slate-700 ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${active ? 'text-slate-700' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        {active && (
          <span className="text-[10px] text-sky-600" aria-hidden>
            {sort.dir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </th>
  )
}
