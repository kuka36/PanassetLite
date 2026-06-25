import { useCallback, useState } from 'react'
import { nextSortState, type SortState } from '../utils/tableSort'

export function useTableSort<K extends string>(
  defaultSort: SortState<K>,
  textKeys: readonly K[],
) {
  const [sort, setSort] = useState(defaultSort)
  const handleSort = useCallback(
    (key: K) => setSort((prev) => nextSortState(prev, key, textKeys)),
    [textKeys],
  )
  return { sort, handleSort, setSort }
}
