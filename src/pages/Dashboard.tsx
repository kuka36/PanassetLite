import { useMemo } from 'react'
import { Sparkles, TrendingUp } from 'lucide-react'
import { useSummary } from '../hooks/useSummary'
import { useStrategySnapshots } from '../hooks/useStrategySummary'
import { useStore } from '../store'
import { useAssistantStore } from '../assistantStore'
import EChart from '../components/EChart'
import NetWorthTrendChart from '../components/NetWorthTrendChart'
import { lightTooltip } from '../components/chartTheme'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { btnGhost } from '../components/Modal'
import { healthScoreHex, insightLevelCls, palette } from '../theme/colors'
import { analyzePortfolio } from '../services/ai'
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, type AssetSnapshot } from '../types'
import { fmtCompact, fmtMoney, fmtPct, pnlColor } from '../utils/format'

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

  const activeAssets = useMemo(() => assets.filter((a) => !a.archived), [assets])

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
  const health = useMemo(() => analyzePortfolio(summary), [summary])
  const openAssistant = useAssistantStore((s) => s.setOpen)
  const topInsights = health.insights.slice(0, 3)

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
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: healthScoreHex(health.score) }}
              title="本地规则健康评分,无需配置 LLM"
            >
              <span className="text-lg font-semibold tabular-nums leading-none">{health.score}</span>
              <span className="mt-0.5 text-[10px] opacity-90">{health.grade}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-slate-700">组合健康</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                  本地规则 · 零配置
                </span>
              </div>
              {topInsights.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">暂无洞察</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {topInsights.map((i) => (
                    <li
                      key={i.title}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs text-slate-700 ${insightLevelCls[i.level]}`}
                    >
                      <span className="font-medium">{i.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            type="button"
            className={`${btnGhost} inline-flex shrink-0 items-center gap-1.5 self-start text-xs`}
            onClick={() => openAssistant(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            打开 AI 助手
          </button>
        </CardBody>
      </Card>

      <NetWorthTrendChart assets={activeAssets} />

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
