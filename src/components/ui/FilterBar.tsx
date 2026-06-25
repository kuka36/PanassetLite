import type { ReactNode } from 'react'
import { Card, CardBody } from './Card'

interface FilterBarProps {
  children: ReactNode
  actions?: ReactNode
}

/** 列表页筛选条容器：Card + 可选右侧操作区 */
export function FilterBar({ children, actions }: FilterBarProps) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">{children}</div>
          {actions && (
            <div className="flex shrink-0 flex-col items-end gap-1">{actions}</div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export function FilterClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="text-xs text-blue-600 transition-colors hover:text-blue-700"
      onClick={onClick}
    >
      清除筛选
    </button>
  )
}
