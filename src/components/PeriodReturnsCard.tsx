import type { PeriodReturn } from '../types'
import { Card, CardBody, CardHeader } from './ui/Card'
import { fmtMoney, fmtPct, pnlColor } from '../utils/format'

export interface MetricItem {
  label: string
  value: string
  sub?: string
  accent?: string
  subAccent?: string
  featured?: boolean
}

export interface TotalPnlItem {
  label: string
  amount: number
  ratio: number | null
}

interface Props {
  returns: PeriodReturn[]
  title?: string
  primary?: MetricItem[]
  totalPnl?: TotalPnlItem
}

function MetricCell({
  label,
  value,
  sub,
  accent,
  subAccent,
  featured,
}: MetricItem) {
  if (featured) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-3 shadow-lg shadow-blue-200/50 sm:p-4">
        <p className="text-xs font-medium text-blue-100">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-2xl">{value}</p>
        {sub && <p className="mt-1 text-xs text-blue-100/80">{sub}</p>}
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${accent ?? 'text-slate-800'}`}>
        {value}
      </p>
      {sub && (
        <p className={`mt-0.5 text-xs tabular-nums ${subAccent ?? 'text-slate-500'}`}>{sub}</p>
      )}
    </div>
  )
}

function CompactMetricLine({
  tag,
  amount,
  ratio,
}: {
  tag: string
  amount: number
  ratio: number | null | undefined
}) {
  const cls = pnlColor(amount)
  return (
    <p className="text-xs leading-snug">
      <span className="text-slate-400">{tag}</span>{' '}
      <span className={`text-sm font-semibold tabular-nums tracking-tight ${cls}`}>
        {fmtMoney(amount)}
      </span>
      {ratio != null && (
        <span className={`ml-1.5 text-[11px] font-medium tabular-nums ${cls} opacity-75`}>
          {fmtPct(ratio)}
        </span>
      )}
    </p>
  )
}

function PeriodMetricBlock({
  label,
  lines,
}: {
  label: string
  lines: Array<{ tag: string; amount: number; ratio: number | null | undefined }>
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 space-y-0.5">
        {lines.map((line) => (
          <CompactMetricLine key={line.tag} {...line} />
        ))}
      </div>
    </div>
  )
}

/** 概览指标卡：核心指标 + 区间收益 + 累计盈亏（总览页与策略页共用） */
export default function PeriodReturnsCard({
  returns,
  title = '区间收益',
  primary,
  totalPnl,
}: Props) {
  const showNetWorth = returns.some((p) => p.netWorthChangeCNY != null)
  const compact = showNetWorth || totalPnl != null

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-slate-700">{title}</h3>
      </CardHeader>
      <CardBody>
        {primary && primary.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 sm:grid-cols-3">
            {primary.map((item) => (
              <MetricCell key={item.label} {...item} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]">
          {returns.map((p) =>
            compact ? (
              <PeriodMetricBlock
                key={p.key}
                label={p.label}
                lines={[
                  { tag: '收益', amount: p.pnlCNY, ratio: p.ratio },
                  ...(p.netWorthChangeCNY != null
                    ? [{ tag: '净值', amount: p.netWorthChangeCNY, ratio: p.netWorthChangeRatio }]
                    : []),
                ]}
              />
            ) : (
              <MetricCell
                key={p.key}
                label={p.label}
                value={fmtMoney(p.pnlCNY)}
                accent={pnlColor(p.pnlCNY)}
                sub={p.ratio != null ? fmtPct(p.ratio) : '—'}
              />
            ),
          )}
          {totalPnl && (
            <PeriodMetricBlock
              label={totalPnl.label}
              lines={[{ tag: '收益', amount: totalPnl.amount, ratio: totalPnl.ratio }]}
            />
          )}
        </div>
      </CardBody>
    </Card>
  )
}
