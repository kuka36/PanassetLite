import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`border-b border-slate-100 px-4 py-3 sm:px-5 ${className}`}>{children}</div>
  )
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>
}

/** 核心指标卡：首项可用渐变强调 */
export function MetricCard({
  label,
  value,
  accent,
  sub,
  subAccent,
  featured = false,
}: {
  label: string
  value: string
  accent?: string
  sub?: string
  subAccent?: string
  featured?: boolean
}) {
  if (featured) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-4 shadow-lg shadow-blue-200/50 transition-all duration-200 sm:p-5">
        <p className="text-xs font-medium text-blue-100">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
        {sub && <p className="mt-1 text-xs text-blue-100/80">{sub}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 sm:p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ?? 'text-slate-800'}`}>
        {value}
      </p>
      {sub && <p className={`mt-1 text-xs ${subAccent ?? 'text-slate-500'}`}>{sub}</p>}
    </div>
  )
}
