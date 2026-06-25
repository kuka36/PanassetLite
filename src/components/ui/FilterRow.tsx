import type { ReactNode } from 'react'

interface FilterRowProps {
  label: string
  scroll?: boolean
  children: ReactNode
}

/** 筛选条单行：左侧标签 + 右侧 chip 或控件 */
export function FilterRow({ label, scroll = false, children }: FilterRowProps) {
  return (
    <div className={`flex gap-2 ${scroll ? 'items-start' : 'flex-wrap items-center'}`}>
      <span
        className={`w-10 shrink-0 text-xs font-medium text-slate-500 ${scroll ? 'pt-1.5' : ''}`}
      >
        {label}
      </span>
      {scroll ? (
        <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">{children}</div>
      )}
    </div>
  )
}
