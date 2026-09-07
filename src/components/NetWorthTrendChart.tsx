import { useEffect, useMemo, useState } from 'react'
import { usePortfolioEngine } from '../hooks/useSummary'
import EChart from './EChart'
import { lightAxis, lightTooltip } from './chartTheme'
import { Card, CardBody, CardHeader } from './ui/Card'
import { inputCls } from './Modal'
import { hexAlpha, palette } from '../theme/colors'
import type { Asset } from '../types'
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

const TREND_RANGE_OPTIONS: { key: DashboardTrendRange; label: string; days?: number }[] = [
  { key: 'd7', label: '近7天', days: 7 },
  { key: 'd30', label: '近30天', days: 30 },
  { key: 'd90', label: '近90天', days: 90 },
  { key: 'd180', label: '近180天', days: 180 },
  { key: 'ytd', label: '今年以来' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
]

const SERIES_RATIO = '累计收益率'

/** 「近 N 天」基线为今天 − N（与概览 periodReturns 一致），不是 inclusive 的 N−1 */
function presetTrendRange(days: number): { fromMs: number; toMs: number } {
  const toMs = todayEndMs()
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - days)
  return { fromMs: from.getTime(), toMs }
}

/** 今年以来：自去年 12/31 日起（与 periodReturns ytd 基线一致） */
function ytdTrendRange(): { fromMs: number; toMs: number } {
  const now = new Date()
  const from = new Date(now.getFullYear() - 1, 11, 31)
  from.setHours(0, 0, 0, 0)
  return { fromMs: from.getTime(), toMs: todayEndMs() }
}

/** `undefined` = 全部；`null` = 自定义日期无效 */
function trendRangeFor(
  key: DashboardTrendRange,
  customFrom: string,
  customTo: string,
): { fromMs: number; toMs: number } | undefined | null {
  if (key === 'all') return undefined
  if (key === 'ytd') return ytdTrendRange()
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

export default function NetWorthTrendChart({
  assets,
  height = 300,
}: {
  assets: Asset[]
  height?: number
}) {
  const engine = usePortfolioEngine()
  const [trendRange, setTrendRange] = useState<DashboardTrendRange>(() =>
    StorageService.loadDashboardTrendRange(),
  )
  const [customFrom, setCustomFrom] = useState(() => StorageService.loadDashboardTrendCustomFrom())
  const [customTo, setCustomTo] = useState(() => StorageService.loadDashboardTrendCustomTo())
  const [todayKey] = useState(() => formatDateKey(Date.now()))

  useEffect(() => {
    StorageService.saveDashboardTrendRange(trendRange)
  }, [trendRange])
  useEffect(() => {
    StorageService.saveDashboardTrendCustomFrom(customFrom)
  }, [customFrom])
  useEffect(() => {
    StorageService.saveDashboardTrendCustomTo(customTo)
  }, [customTo])

  const history = useMemo(() => {
    const range = trendRangeFor(trendRange, customFrom, customTo)
    if (range === null) return []
    return engine.history(assets, range)
  }, [engine, assets, trendRange, customFrom, customTo])

  const netWorthDelta = useMemo(() => {
    if (history.length < 2) return null
    return history[history.length - 1].netWorth - history[0].netWorth
  }, [history])

  /** 相对所选区间起点的累计收益（与曲线末点同口径） */
  const rangePnl = useMemo(() => {
    if (history.length === 0) return null
    const last = history[history.length - 1]
    return { pnlCNY: last.pnlCNY, pnlRatio: last.pnlRatio }
  }, [history])

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
      color: [palette.blue600, palette.green600, palette.red500, palette.amber500, palette.indigo600],
      tooltip: {
        trigger: 'axis' as const,
        ...lightTooltip,
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [params]
          if (items.length === 0) return ''
          const first = items[0] as { axisValueLabel?: string; axisValue?: string }
          const lines = [
            `<div style="margin-bottom:4px">${first.axisValueLabel ?? first.axisValue ?? ''}</div>`,
          ]
          for (const raw of items) {
            const p = raw as {
              marker?: string
              seriesName?: string
              value?: number | null
            }
            const v = p.value
            const formatted =
              v == null || Number.isNaN(Number(v))
                ? '—'
                : p.seriesName === SERIES_RATIO
                  ? fmtPct(Number(v))
                  : fmtMoney(Number(v))
            lines.push(
              `<div style="display:flex;justify-content:space-between;gap:16px">${p.marker ?? ''}<span>${p.seriesName ?? ''}</span><span style="font-variant-numeric:tabular-nums;font-weight:600">${formatted}</span></div>`,
            )
          }
          return lines.join('')
        },
      },
      legend: { textStyle: { color: palette.textMuted }, top: 0 },
      grid: { left: 12, right: 16, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: history.map((h) => h.date),
        ...lightAxis,
        boundaryGap: false,
      },
      yAxis: [
        {
          type: 'value' as const,
          ...lightAxis,
          axisLabel: { color: palette.textMuted, formatter: (v: number) => fmtCompact(v) },
          scale: true,
        },
        {
          type: 'value' as const,
          ...lightAxis,
          splitLine: { show: false },
          axisLabel: {
            color: palette.textMuted,
            formatter: (v: number) => fmtPct(v, 0, false),
          },
          scale: true,
        },
      ],
      series: [
        {
          name: '净资产',
          type: 'line' as const,
          yAxisIndex: 0,
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
          yAxisIndex: 0,
          data: history.map((h) => Math.round(h.assets)),
          smooth: true,
          showSymbol: false,
          itemStyle: { color: palette.green600 },
          lineStyle: { width: 1.5, color: palette.green600, type: 'dashed' as const },
        },
        {
          name: '负债',
          type: 'line' as const,
          yAxisIndex: 0,
          data: history.map((h) => Math.round(h.debt)),
          smooth: true,
          showSymbol: false,
          itemStyle: { color: palette.red500 },
          lineStyle: { width: 1.5, color: palette.red500, type: 'dashed' as const },
        },
        {
          name: '累计收益',
          type: 'line' as const,
          yAxisIndex: 0,
          data: history.map((h) => Math.round(h.pnlCNY)),
          smooth: true,
          showSymbol: false,
          itemStyle: { color: palette.amber500 },
          lineStyle: { width: 1.75, color: palette.amber500 },
        },
        {
          name: SERIES_RATIO,
          type: 'line' as const,
          yAxisIndex: 1,
          data: history.map((h) => (h.pnlRatio == null ? null : Number(h.pnlRatio.toFixed(6)))),
          smooth: true,
          showSymbol: false,
          itemStyle: { color: palette.indigo600 },
          lineStyle: { width: 1.5, color: palette.indigo600, type: 'dashed' as const },
        },
      ],
    }),
    [history],
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-sm font-medium text-slate-700">资产趋势</h3>
            {netWorthDelta != null && (
              <span className="text-xs leading-snug">
                <span className="text-slate-400">净值</span>{' '}
                <span className={`text-sm font-semibold tabular-nums ${pnlColor(netWorthDelta)}`}>
                  {netWorthDelta > 0 ? '+' : ''}
                  {fmtMoney(netWorthDelta)}
                </span>
              </span>
            )}
            {rangePnl != null && (
              <span className="text-xs leading-snug">
                <span className="text-slate-400">收益</span>{' '}
                <span className={`text-sm font-semibold tabular-nums ${pnlColor(rangePnl.pnlCNY)}`}>
                  {fmtMoney(rangePnl.pnlCNY)}
                </span>
                {rangePnl.pnlRatio != null && (
                  <span
                    className={`ml-1.5 text-[11px] font-medium tabular-nums ${pnlColor(rangePnl.pnlCNY)} opacity-75`}
                  >
                    {fmtPct(rangePnl.pnlRatio)}
                  </span>
                )}
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
        <EChart option={trendOption} height={height} />
      </CardBody>
    </Card>
  )
}
