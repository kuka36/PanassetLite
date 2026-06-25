import type { PeriodReturn } from '../types'
import { Card, CardBody, CardHeader } from './ui/Card'
import { fmtMoney, fmtPct, pnlColor } from '../utils/format'

interface Props {
  returns: PeriodReturn[]
  title?: string
}

/** 区间收益卡片：本周 / 本月 / 今年以来 / 近一年（总览页与策略页共用） */
export default function PeriodReturnsCard({ returns, title = '区间收益' }: Props) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-slate-700">{title}</h3>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {returns.map((p) => (
            <div key={p.key}>
              <p className="text-xs text-slate-500">{p.label}</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${pnlColor(p.pnlCNY)}`}>
                {p.pnlCNY > 0 ? '+' : ''}
                {fmtMoney(p.pnlCNY)}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                {p.ratio != null ? `收益率 ${fmtPct(p.ratio)}` : '—'}
              </p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
