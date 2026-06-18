import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useSummary } from '../hooks/useSummary'
import { useStore } from '../store'
import EChart from '../components/EChart'
import { lightAxis, lightTooltip } from '../components/chartTheme'
import { Card, CardBody, CardHeader, MetricCard } from '../components/ui/Card'
import { btnGhost } from '../components/Modal'
import { color, hexAlpha, palette } from '../theme/colors'
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL } from '../types'
import { fmtCompact, fmtMoney, fmtPct, pnlColor } from '../utils/format'

export default function Dashboard({ goTo }: { goTo: (page: string) => void }) {
  const loadDemo = useStore((s) => s.loadDemo)
  const summary = useSummary()
  const { history } = summary
  const monthDelta = useMemo(() => {
    if (history.length < 2) return null
    const last = history[history.length - 1]
    const target = Date.parse(last.date) - 30 * 86400_000
    let base = history[0]
    for (const h of history) {
      if (Date.parse(h.date) <= target) base = h
      else break
    }
    return { delta: last.netWorth - base.netWorth, since: base.date }
  }, [history])

  const trendOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        ...lightTooltip,
        valueFormatter: (v: unknown) => fmtMoney(Number(v)),
      },
      legend: { textStyle: { color: palette.textMuted }, top: 0 },
      grid: { left: 12, right: 16, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: history.map((h) => h.date),
        ...lightAxis,
        boundaryGap: false,
      },
      yAxis: {
        type: 'value' as const,
        ...lightAxis,
        axisLabel: { color: palette.textMuted, formatter: (v: number) => fmtCompact(v) },
        scale: true,
      },
      series: [
        {
          name: '净资产',
          type: 'line' as const,
          data: history.map((h) => Math.round(h.netWorth)),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: palette.blue600 },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexAlpha(palette.blue600, 0.2) },
                { offset: 1, color: hexAlpha(palette.blue600, 0.02) },
              ],
            },
          },
        },
        {
          name: '总资产',
          type: 'line' as const,
          data: history.map((h) => Math.round(h.assets)),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1.5, color: palette.green600, type: 'dashed' as const },
        },
        {
          name: '负债',
          type: 'line' as const,
          data: history.map((h) => Math.round(h.debt)),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1.5, color: palette.red500, type: 'dashed' as const },
        },
      ],
    }),
    [history],
  )

  const pieOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item' as const,
        ...lightTooltip,
        formatter: (p: unknown) => {
          const { name, value, percent } = p as { name: string; value: number; percent: number }
          return `${name}<br/>${fmtMoney(value)}(${percent}%)`
        },
      },
      legend: {
        orient: 'vertical' as const,
        right: 8,
        top: 'center',
        textStyle: { color: palette.textMuted },
      },
      series: [
        {
          type: 'pie' as const,
          radius: ['52%', '76%'],
          center: ['38%', '50%'],
          itemStyle: { borderColor: palette.surface, borderWidth: 2 },
          label: { show: false },
          data: summary.byType
            .filter((t) => t.type !== 'debt' && t.valueCNY > 0)
            .map((t) => ({
              name: ASSET_TYPE_LABEL[t.type],
              value: Math.round(t.valueCNY),
              itemStyle: { color: ASSET_TYPE_COLOR[t.type] },
            })),
        },
      ],
    }),
    [summary.byType],
  )

  const topAssets = summary.snapshots.filter((s) => s.asset.type !== 'debt' && s.valueCNY > 0).slice(0, 6)
  const hasData = summary.snapshots.length > 0

  if (!hasData) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <TrendingUp className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">把散落各处的资产聚到一个地方</h2>
        <p className="max-w-md text-sm text-slate-500">
          股票、基金、加密货币、存款、支付宝理财、房贷……全部加进来,
          一眼看清总资产、分布与收益。数据只存在你的浏览器里。
        </p>
        <div className="flex gap-3">
          <button
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-all duration-200 hover:bg-blue-700 active:scale-95"
            onClick={() => goTo('assets')}
          >
            添加第一项资产
          </button>
          <button className={btnGhost + ' px-5 py-2.5'} onClick={() => loadDemo()}>
            或加载演示数据
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">总览</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="净资产" value={fmtMoney(summary.netWorthCNY)} featured />
        <MetricCard label="总资产" value={fmtMoney(summary.totalAssetsCNY)} />
        <MetricCard
          label="总负债"
          value={fmtMoney(summary.totalDebtCNY)}
          accent={color.danger}
        />
        <MetricCard
          label="累计盈亏"
          value={`${summary.totalPnlCNY > 0 ? '+' : ''}${fmtMoney(summary.totalPnlCNY)}`}
          accent={pnlColor(summary.totalPnlCNY)}
          sub={
            monthDelta
              ? `近30天 ${monthDelta.delta >= 0 ? '+' : ''}${fmtCompact(monthDelta.delta)}`
              : undefined
          }
          subAccent={monthDelta ? pnlColor(monthDelta.delta) : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-medium text-slate-700">区间收益</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {summary.periodReturns.map((p) => (
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

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <h3 className="text-sm font-medium text-slate-700">净资产趋势</h3>
          </CardHeader>
          <CardBody className="pt-2">
            <EChart option={trendOption} height={300} />
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <h3 className="text-sm font-medium text-slate-700">资产分布</h3>
          </CardHeader>
          <CardBody className="pt-2">
            <EChart option={pieOption} height={300} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">主要持仓</h3>
            <button
              className="text-xs text-blue-600 transition-colors hover:text-blue-700"
              onClick={() => goTo('assets')}
            >
              查看全部 →
            </button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {topAssets.map((s) => {
              const ratio = summary.totalAssetsCNY > 0 ? s.valueCNY / summary.totalAssetsCNY : 0
              return (
                <div key={s.asset.id} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: ASSET_TYPE_COLOR[s.asset.type] }}
                  />
                  <span className="w-32 truncate text-sm text-slate-700 sm:w-40">{s.asset.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${Math.max(2, ratio * 100)}%`,
                        background: ASSET_TYPE_COLOR[s.asset.type],
                      }}
                    />
                  </div>
                  <span className="w-20 text-right text-sm tabular-nums text-slate-700 sm:w-24">
                    {fmtCompact(s.valueCNY)}
                  </span>
                  <span className={`w-16 text-right text-xs tabular-nums sm:w-20 ${pnlColor(s.totalPnlCNY)}`}>
                    {s.asset.type === 'debt' || s.netInvestedCNY <= 0
                      ? '—'
                      : fmtPct(s.totalPnlCNY / s.netInvestedCNY)}
                  </span>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
