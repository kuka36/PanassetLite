import { useEffect, useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { usePortfolioEngine, useSummary } from '../hooks/useSummary'
import { useStrategySnapshots } from '../hooks/useStrategySummary'
import { useStore } from '../store'
import EChart from '../components/EChart'
import { lightAxis, lightTooltip } from '../components/chartTheme'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { btnGhost, inputCls } from '../components/Modal'
import { hexAlpha, palette } from '../theme/colors'
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, type AssetSnapshot } from '../types'
import { fmtCompact, fmtMoney, fmtPct, pnlColor } from '../utils/format'
import {
  StorageService,
  type DashboardTrendRange,
} from '../services/storage'
import {
  endOfDayFromDateKey,
  formatDateKey,
  migrateDateToOccurredAt,
  startOfDay,
  todayEndMs,
} from '../utils/time'

const NAME_PIE_COLORS = [
  palette.blue500,
  palette.pink400,
  palette.green600,
  palette.violet400,
  palette.amber500,
  palette.orange400,
  palette.indigo600,
  palette.emerald400,
  palette.blue700,
  palette.red500,
]

const TREND_RANGE_OPTIONS: { key: DashboardTrendRange; label: string; days?: number }[] = [
  { key: 'd7', label: '近7天', days: 7 },
  { key: 'd30', label: '近30天', days: 30 },
  { key: 'd90', label: '近90天', days: 90 },
  { key: 'd180', label: '近180天', days: 180 },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
]

function presetTrendRange(days: number): { fromMs: number; toMs: number } {
  const toMs = todayEndMs()
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (days - 1))
  return { fromMs: from.getTime(), toMs }
}

/** `undefined` = 全部；`null` = 自定义日期无效 */
function trendRangeFor(
  key: DashboardTrendRange,
  customFrom: string,
  customTo: string,
): { fromMs: number; toMs: number } | undefined | null {
  if (key === 'all') return undefined
  if (key === 'custom') {
    if (!customFrom || !customTo || customFrom > customTo) return null
    return {
      fromMs: startOfDay(migrateDateToOccurredAt(customFrom)),
      toMs: endOfDayFromDateKey(customTo),
    }
  }
  const days = TREND_RANGE_OPTIONS.find((o) => o.key === key)?.days
  return days ? presetTrendRange(days) : undefined
}

function pieOption(data: { name: string; value: number; itemStyle?: { color: string } }[]) {
  return {
    tooltip: {
      trigger: 'item' as const,
      ...lightTooltip,
      formatter: (p: unknown) => {
        const { name, value, percent } = p as { name: string; value: number; percent: number }
        return `${name}<br/>${fmtMoney(value)}(${percent}%)`
      },
    },
    legend: {
      type: 'scroll' as const,
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
        data,
      },
    ],
  }
}

function groupSnapshotsByName(snapshots: AssetSnapshot[]) {
  const map = new Map<string, number>()
  for (const s of snapshots) {
    if (s.asset.type === 'debt' || s.valueCNY <= 0) continue
    map.set(s.asset.name, (map.get(s.asset.name) ?? 0) + s.valueCNY)
  }
  return [...map.entries()]
    .map(([name, valueCNY]) => ({ name, valueCNY }))
    .sort((a, b) => b.valueCNY - a.valueCNY)
}

export default function Dashboard({ goTo }: { goTo: (page: string) => void }) {
  const loadDemo = useStore((s) => s.loadDemo)
  const assets = useStore((s) => s.assets)
  const summary = useSummary()
  const engine = usePortfolioEngine()
  const [trendRange, setTrendRange] = useState<DashboardTrendRange>(() =>
    StorageService.loadDashboardTrendRange(),
  )
  const [customFrom, setCustomFrom] = useState(() => StorageService.loadDashboardTrendCustomFrom())
  const [customTo, setCustomTo] = useState(() => StorageService.loadDashboardTrendCustomTo())

  useEffect(() => {
    StorageService.saveDashboardTrendRange(trendRange)
  }, [trendRange])
  useEffect(() => {
    StorageService.saveDashboardTrendCustomFrom(customFrom)
  }, [customFrom])
  useEffect(() => {
    StorageService.saveDashboardTrendCustomTo(customTo)
  }, [customTo])

  const activeAssets = useMemo(() => assets.filter((a) => !a.archived), [assets])
  const history = useMemo(() => {
    const range = trendRangeFor(trendRange, customFrom, customTo)
    if (range === null) return []
    return engine.history(activeAssets, range)
  }, [engine, activeAssets, trendRange, customFrom, customTo])

  const netWorthDelta = useMemo(() => {
    if (history.length < 2) return null
    return history[history.length - 1].netWorth - history[0].netWorth
  }, [history])

  const [todayKey] = useState(() => formatDateKey(Date.now()))

  function handleTrendRangeChange(next: DashboardTrendRange) {
    setTrendRange(next)
    if (next === 'custom' && (!customFrom || !customTo)) {
      const { fromMs, toMs } = presetTrendRange(30)
      setCustomFrom(formatDateKey(fromMs))
      setCustomTo(formatDateKey(toMs))
    }
  }

  const trendOption = useMemo(
    () => ({
      color: [palette.blue600, palette.green600, palette.red500],
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
          itemStyle: { color: palette.blue600 },
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
          itemStyle: { color: palette.green600 },
          lineStyle: { width: 1.5, color: palette.green600, type: 'dashed' as const },
        },
        {
          name: '负债',
          type: 'line' as const,
          data: history.map((h) => Math.round(h.debt)),
          smooth: true,
          showSymbol: false,
          itemStyle: { color: palette.red500 },
          lineStyle: { width: 1.5, color: palette.red500, type: 'dashed' as const },
        },
      ],
    }),
    [history],
  )

  const typePieOption = useMemo(
    () =>
      pieOption(
        summary.byType
          .filter((t) => t.type !== 'debt' && t.valueCNY > 0)
          .map((t) => ({
            name: ASSET_TYPE_LABEL[t.type],
            value: Math.round(t.valueCNY),
            itemStyle: { color: ASSET_TYPE_COLOR[t.type] },
          })),
      ),
    [summary.byType],
  )

  const namePieOption = useMemo(
    () =>
      pieOption(
        groupSnapshotsByName(summary.snapshots).map((item, i) => ({
          name: item.name,
          value: Math.round(item.valueCNY),
          itemStyle: { color: NAME_PIE_COLORS[i % NAME_PIE_COLORS.length] },
        })),
      ),
    [summary.snapshots],
  )

  const topAssets = summary.snapshots.filter((s) => s.asset.type !== 'debt' && s.valueCNY > 0).slice(0, 6)
  const strategySnapshots = useStrategySnapshots()
  const topStrategies = useMemo(
    () => [...strategySnapshots].sort((a, b) => b.valueCNY - a.valueCNY).slice(0, 6),
    [strategySnapshots],
  )
  const totalStrategyValue = useMemo(
    () => strategySnapshots.reduce((sum, s) => sum + s.valueCNY, 0),
    [strategySnapshots],
  )
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h3 className="text-sm font-medium text-slate-700">净资产趋势</h3>
              {netWorthDelta != null && (
                <span className={`text-sm font-semibold tabular-nums ${pnlColor(netWorthDelta)}`}>
                  {netWorthDelta > 0 ? '+' : ''}
                  {fmtMoney(netWorthDelta)}
                </span>
              )}
            </div>
            <div className="w-[7.5rem] shrink-0">
              <select
                className={inputCls}
                value={trendRange}
                onChange={(e) => handleTrendRangeChange(e.target.value as DashboardTrendRange)}
                aria-label="趋势时间范围"
              >
                {TREND_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {trendRange === 'custom' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="w-[10.5rem]">
                <input
                  type="date"
                  className={inputCls}
                  value={customFrom}
                  max={customTo || todayKey}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="趋势起始日期"
                />
              </div>
              <span className="text-xs text-slate-500">至</span>
              <div className="w-[10.5rem]">
                <input
                  type="date"
                  className={inputCls}
                  value={customTo}
                  min={customFrom || undefined}
                  max={todayKey}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="趋势结束日期"
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardBody className="pt-2">
          <EChart option={trendOption} height={300} />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium text-slate-700">资产分布 · 按类型</h3>
          </CardHeader>
          <CardBody className="pt-2">
            <EChart option={typePieOption} height={300} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium text-slate-700">资产分布 · 按名称</h3>
          </CardHeader>
          <CardBody className="pt-2">
            <EChart option={namePieOption} height={300} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">主要资产</h3>
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
                <div key={s.asset.id} className="flex items-center gap-2 sm:gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: ASSET_TYPE_COLOR[s.asset.type] }}
                  />
                  <span className="w-20 shrink-0 truncate text-sm text-slate-700 sm:w-40">
                    {s.asset.name}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:contents">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:min-w-0 sm:flex-1">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${Math.max(2, ratio * 100)}%`,
                          background: ASSET_TYPE_COLOR[s.asset.type],
                        }}
                      />
                    </div>
                    <span className="text-right text-xs tabular-nums text-slate-600 sm:w-24 sm:text-sm sm:text-slate-700">
                      {fmtCompact(s.valueCNY)}
                    </span>
                  </div>
                  <span
                    className={`w-14 shrink-0 text-right text-xs tabular-nums sm:w-20 ${pnlColor(s.totalPnlCNY)}`}
                  >
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

      {topStrategies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">主要策略</h3>
              <button
                className="text-xs text-blue-600 transition-colors hover:text-blue-700"
                onClick={() => goTo('strategies')}
              >
                查看全部 →
              </button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {topStrategies.map((s) => {
                const ratio = totalStrategyValue > 0 ? s.valueCNY / totalStrategyValue : 0
                const ret =
                  s.netInvestedCNY > 0 ? s.totalPnlCNY / s.netInvestedCNY : s.xirr
                return (
                  <div key={s.strategy.id} className="flex items-center gap-2 sm:gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                    <span className="w-20 shrink-0 truncate text-sm text-slate-700 sm:w-40">
                      {s.strategy.name}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:contents">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:min-w-0 sm:flex-1">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-200"
                          style={{ width: `${Math.max(2, ratio * 100)}%` }}
                        />
                      </div>
                      <span className="text-right text-xs tabular-nums text-slate-600 sm:w-24 sm:text-sm sm:text-slate-700">
                        {fmtCompact(s.valueCNY)}
                      </span>
                    </div>
                    <span
                      className={`w-14 shrink-0 text-right text-xs tabular-nums sm:w-20 ${
                        ret != null ? pnlColor(ret) : 'text-slate-400'
                      }`}
                    >
                      {ret != null ? fmtPct(ret) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
