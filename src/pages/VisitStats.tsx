import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import EChart from '../components/EChart'
import { btnGhost } from '../components/Modal'
import { lightAxis, lightTooltip } from '../components/chartTheme'
import { Card, CardBody, CardHeader, MetricCard } from '../components/ui/Card'
import { analyticsStatsBaseUrl, fetchVisitStats, type VisitHit, type VisitStats } from '../services/analytics'
import { palette } from '../theme/colors'
import { fmtCountry } from '../utils/format'

const PAGE_LABEL: Record<string, string> = {
  dashboard: '总览',
  assets: '资产',
  transactions: '流水',
  settings: '设置',
}

const DEVICE_CLS: Record<string, string> = {
  Desktop: 'bg-blue-100 text-blue-700',
  Mobile: 'bg-violet-100 text-violet-700',
  Tablet: 'bg-emerald-100 text-emerald-700',
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function fmtPage(path: string): { label: string; raw: string; id: string } {
  const m = path.match(/(?:#\/|\/)([^/]+)$/)
  const id = m?.[1] ?? ''
  return {
    id,
    label: PAGE_LABEL[id] ? PAGE_LABEL[id] : path,
    raw: path,
  }
}

function DeviceTag({ device }: { device: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        DEVICE_CLS[device] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {device}
    </span>
  )
}

function HitsTable({
  title,
  rows,
  showTime,
}: {
  title: string
  rows: VisitHit[]
  showTime?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </CardHeader>
      <CardBody className="overflow-x-auto p-0 sm:p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">暂无记录</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500">
                {showTime && <th className="px-4 py-2.5 font-medium sm:px-5">时间</th>}
                <th className="px-4 py-2.5 font-medium sm:px-5">设备</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">浏览器</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">OS</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">国家</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">页面</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const page = fmtPage(h.path)
                return (
                  <tr key={`${h.sid}-${h.ts}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                    {showTime && (
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-500 sm:px-5">
                        {fmtTime(h.ts)}
                      </td>
                    )}
                    <td className="px-4 py-2.5 sm:px-5">
                      <DeviceTag device={h.device} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 sm:px-5">{h.browser}</td>
                    <td className="px-4 py-2.5 text-slate-700 sm:px-5">{h.os}</td>
                    <td className="px-4 py-2.5 text-slate-700 sm:px-5">{fmtCountry(h.country)}</td>
                    <td className="px-4 py-2.5 sm:px-5">
                      <span className="font-medium text-blue-600">{page.label}</span>
                      {page.id && PAGE_LABEL[page.id] ? (
                        <span className="ml-1 text-xs text-slate-400">{page.raw}</span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  )
}

export default function VisitStats({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<VisitStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchVisitStats())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setData(await fetchVisitStats())
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    const timer = window.setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [load])

  const trendOption = useMemo(() => {
    if (!data?.trend.length) return null
    return {
      tooltip: { trigger: 'axis' as const, ...lightTooltip },
      grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: data.trend.map((t) => t.date.slice(5)),
        ...lightAxis,
      },
      yAxis: {
        type: 'value' as const,
        minInterval: 1,
        ...lightAxis,
      },
      series: [
        {
          type: 'bar' as const,
          data: data.trend.map((t) => t.count),
          itemStyle: { color: palette.blue600, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 24,
        },
      ],
    }
  }, [data])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">访问统计</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              数据源 {analyticsStatsBaseUrl()} · 每 60 秒自动刷新
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button type="button" className={btnGhost} onClick={onClose}>
              <ArrowLeft className="mr-1.5 inline h-4 w-4" />
              返回应用
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            featured
            label="当前在线"
            value={loading && !data ? '…' : String(data?.activeCount ?? 0)}
          />
          <MetricCard
            label="累积总访问"
            value={loading && !data ? '…' : (data?.totalVisits ?? 0).toLocaleString()}
            accent="text-amber-600"
          />
          <MetricCard
            label="今日访问"
            value={loading && !data ? '…' : String(data?.todayVisits ?? 0)}
            accent="text-violet-600"
          />
          <MetricCard
            label="近 24h 访问"
            value={loading && !data ? '…' : String(data?.last24hCount ?? 0)}
          />
        </div>

        {trendOption && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">近 30 天每日访问趋势</h2>
            </CardHeader>
            <CardBody>
              <EChart option={trendOption} className="h-52 w-full" />
            </CardBody>
          </Card>
        )}

        <HitsTable title="当前在线设备" rows={data?.activeSessions ?? []} />
        <HitsTable title="近期访问记录（50 条）" rows={data?.recentHits ?? []} showTime />
      </main>
    </div>
  )
}
