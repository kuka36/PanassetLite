interface Props {
  label: string
  value: string
  valueClassName?: string
  title?: string
}

/** 详情弹窗顶部的指标小卡片 */
export default function MiniStat({ label, value, valueClassName = 'text-slate-800', title }: Props) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3" title={title}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClassName}`}>{value}</p>
    </div>
  )
}
