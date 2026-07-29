import type { ReactNode } from 'react'

export interface SegmentedTab<T extends string> {
  id: T
  label: ReactNode
}

interface Props<T extends string> {
  value: T
  onChange: (value: T) => void
  tabs: SegmentedTab<T>[]
  ariaLabel: string
  className?: string
  /** 均分宽度（记一笔弹窗等场景） */
  stretch?: boolean
}

function tabButtonCls(active: boolean, stretch: boolean) {
  return [
    stretch ? 'flex flex-1 items-center justify-center gap-1.5' : '',
    'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
    active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
  ]
    .filter(Boolean)
    .join(' ')
}

export default function SegmentedTabs<T extends string>({
  value,
  onChange,
  tabs,
  ariaLabel,
  className = '',
  stretch = false,
}: Props<T>) {
  return (
    <div
      className={`flex rounded-xl border border-slate-200 bg-slate-50 p-1 ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={tabButtonCls(value === tab.id, stretch)}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
