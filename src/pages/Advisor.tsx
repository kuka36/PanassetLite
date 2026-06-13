import { useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { useSummary } from '../hooks/useSummary'
import EChart from '../components/EChart'
import LightMarkdown from '../components/LightMarkdown'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import {
  ADVISOR_PRESETS,
  analyzePortfolio,
  streamLlmAdvice,
  type AdvisorPreset,
  type InsightLevel,
} from '../services/ai'
import { btnAi, inputCls } from '../components/Modal'
import { color, healthScoreHex, insightLevelCls, palette } from '../theme/colors'

const LEVEL_ICON: Record<InsightLevel, string> = {
  danger: '⛔',
  warn: '⚠️',
  info: '💡',
  good: '✅',
}

const LEVEL_TEXT: Record<InsightLevel, string> = {
  danger: 'text-red-700',
  warn: 'text-amber-700',
  info: 'text-blue-700',
  good: 'text-green-700',
}

export default function Advisor() {
  const summary = useSummary()
  const settings = useStore((s) => s.settings)
  const report = useMemo(() => analyzePortfolio(summary), [summary])

  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const gaugeOption = useMemo(
    () => ({
      series: [
        {
          type: 'gauge' as const,
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          progress: {
            show: true,
            width: 14,
            itemStyle: { color: healthScoreHex(report.score) },
          },
          axisLine: {
            lineStyle: { width: 14, color: [[1, '#e2e8f0']] as [number, string][] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 40,
            fontWeight: 700,
            color: palette.textTitle,
            offsetCenter: [0, '-5%'],
            formatter: (v: number) => `${Math.round(v)}`,
          },
          title: { offsetCenter: [0, '32%'], color: palette.textMuted, fontSize: 14 },
          data: [{ value: report.score, name: `健康评分 · ${report.grade}` }],
        },
      ],
    }),
    [report],
  )

  const askLlm = async (promptOverride?: string) => {
    const q = promptOverride !== undefined ? promptOverride : question
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError('')
    setAnswer('')
    try {
      await streamLlmAdvice(summary, settings, q, setAnswer, ac.signal)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
    } finally {
      if (abortRef.current === ac) setLoading(false)
    }
  }

  const runPreset = (preset: AdvisorPreset) => {
    setQuestion(preset.prompt)
    void askLlm(preset.prompt)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">AI 智能顾问</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody>
            <EChart option={gaugeOption} height={240} />
            <p className="px-2 text-center text-xs text-slate-500">
              基于资产集中度、风险敞口、现金缓冲、负债率、收益表现等维度的本地规则评估,数据不出浏览器。
            </p>
          </CardBody>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          {report.insights.map((ins, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-4 transition-all duration-200 ${insightLevelCls[ins.level]}`}
            >
              <p className={`text-sm font-medium ${LEVEL_TEXT[ins.level]}`}>
                <span className="mr-2">{LEVEL_ICON[ins.level]}</span>
                {ins.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{ins.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-medium text-slate-700">深度分析(可选,接入大模型)</h3>
          <p className="mt-1 text-xs text-slate-500">
            {settings.llm.apiKey
              ? '将向你配置的 LLM 接口发送资产汇总数据(金额与收益率),获取个性化建议。'
              : '未配置 LLM API key。到「设置」页填写 OpenAI 兼容接口后即可使用;不配置也不影响上面的本地分析。'}
          </p>
        </CardHeader>
        <CardBody className="pt-4">
          <div className="flex flex-wrap gap-2">
            {ADVISOR_PRESETS.map((preset) => {
              const active = question === preset.prompt
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  disabled={loading || !settings.llm.apiKey}
                  onClick={() => runPreset(preset)}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className={inputCls}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="也可以自定义问题,或点上方快捷问题一键分析"
              onKeyDown={(e) => e.key === 'Enter' && !loading && settings.llm.apiKey && askLlm()}
            />
            <button
              className={`${btnAi} shrink-0`}
              onClick={() => askLlm()}
              disabled={loading || !settings.llm.apiKey}
            >
              {loading ? (answer ? '生成中…' : '连接中…') : '生成建议'}
            </button>
          </div>
          {error && <p className={`mt-3 text-sm ${color.error}`}>{error}</p>}
          {(loading || answer) && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {answer ? <LightMarkdown text={answer} /> : null}
              {loading && (
                <span
                  className={`${color.ai} ${answer ? 'ml-0.5 inline animate-pulse' : color.muted}`}
                >
                  {answer ? '▍' : '正在生成…'}
                </span>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
