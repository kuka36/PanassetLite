export type SortDir = 'asc' | 'desc'

export type SortState<K extends string = string> = { key: K; dir: SortDir }

type SortValue = string | number | null | undefined

function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  const mul = dir === 'asc' ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') {
    return mul * (a - b)
  }
  return mul * String(a).localeCompare(String(b), 'zh-CN')
}

/** 点击列标题时切换排序状态；textKeys 首次点击默认升序，其余默认降序 */
export function nextSortState<K extends string>(
  prev: SortState<K>,
  key: K,
  textKeys: readonly K[],
): SortState<K> {
  if (prev.key === key) {
    return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { key, dir: textKeys.includes(key) ? 'asc' : 'desc' }
}

/** 按 accessors 映射的字段排序；可选 tieBreaker 用于同值时的稳定次序 */
export function sortBy<T, K extends string>(
  items: readonly T[],
  sort: SortState<K>,
  accessors: Record<K, (item: T) => SortValue>,
  tieBreaker?: (a: T, b: T) => number,
): T[] {
  const getValue = accessors[sort.key]
  return [...items].sort((a, b) => {
    const cmp = compareValues(getValue(a), getValue(b), sort.dir)
    if (cmp !== 0) return cmp
    return tieBreaker?.(a, b) ?? 0
  })
}
