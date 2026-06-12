import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useSummary } from '../hooks/useSummary'
import EChart from '../components/EChart'
import { analyzePortfolio, fetchLlmAdvice, type InsightLevel } from '../services/ai'
import { btnPrimary, inputCls } from '../components/Modal'

const LEVEL_STYLE: Record<InsightLevel, { icon: string; cls: string }> = {
  danger: { icon: '⛔', cls: 'border-red-500/30 bg-red-500/5' },
  warn: { icon: '⚠️', cls: 'border-amber-500/30 bg-amber-500/5' },
  info: { icon: '💡', cls: 'border-sky-500/30 bg-sky-500/5' },
  good: { icon: '✅', cls: 'border-emerald-500/30 bg-emerald-500/5' },
}

export default function Advisor() {
  const summary = useSummary()
  const settings = useStore((s) => s.settings)
  const report = useMemo(() => analyzePortfolio(summary), [summary])

  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')

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
            itemStyle: {
              color: report.score >= 85 ? '#34d399' : report.score >= 70 ? '#38bdf8' : report.score >= 55 ? '#fbbf24' : '#f87171',
            },
          },
          axisLine: { lineStyle: { width: 14, color: [[1, '#1e293b']] as [number, string][] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 40,
            fontWeight: 700,
            color: '#e2e8f0',
            offsetCenter: [0, '-5%'],
            formatter: (v: number) => `${Math.round(v)}`,
          },
          title: { offsetCenter: [0, '32%'], color: '#94a3b8', fontSize: 14 },
          data: [{ value: report.score, name: `健康评分 · ${report.grade}` }],
        },
      ],
    }),
    [report],
  )

  const askLlm = async () => {
    setLoading(true)
    setError('')
    setAnswer('')
    try {
      const text = await fetchLlmAdvice(summary, settings, question)
      setAnswer(text)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">AI 智能顾问</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <EChart option={gaugeOption} height={240} />
          <p className="px-2 text-center text-xs text-slate-500">
            基于资产集中度、风险敞口、现金缓冲、负债率、收益表现等维度的本地规则评估,数据不出浏览器。
          </p>
        </div>

        <div className="space-y-3 lg:col-span-2">
          {report.insights.map((ins, i) => {
            const s = LEVEL_STYLE[ins.level]
            return (
              <div key={i} className={`rounded-xl border p-4 ${s.cls}`}>
                <p className="text-sm font-medium text-slate-200">
                  <span className="mr-2">{s.icon}</span>
                  {ins.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{ins.detail}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* LLM 深度分析 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-medium text-slate-300">深度分析(可选,接入大模型)</h3>
        <p className="mt-1 text-xs text-slate-500">
          {settings.llm.apiKey
            ? '将向你配置的 LLM 接口发送资产汇总数据(金额与收益率),获取个性化建议。'
            : '未配置 LLM API key。到「设置」页填写 OpenAI 兼容接口后即可使用;不配置也不影响上面的本地分析。'}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className={inputCls}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="想问什么?留空则做整体健康检查。例:我想 3 年内攒够 50 万首付,该怎么调整?"
            onKeyDown={(e) => e.key === 'Enter' && !loading && settings.llm.apiKey && askLlm()}
          />
          <button className={`${btnPrimary} shrink-0`} onClick={askLlm} disabled={loading || !settings.llm.apiKey}>
            {loading ? '分析中…' : '生成建议'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {answer && (
          <div className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-300">
            {answer}
          </div>
        )}
      </div>
    </div>
  )
}
