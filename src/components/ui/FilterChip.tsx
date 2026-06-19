interface FilterChipProps {
  label: string
  active: boolean
  count?: number
  onClick: () => void
}

/** 胶囊筛选按钮，供列表页筛选条复用 */
export function FilterChip({ label, active, count, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
        active
          ? 'border-sky-200 bg-sky-50 font-medium text-sky-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      {count != null && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
            active ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
