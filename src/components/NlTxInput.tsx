import { useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { Asset, Settings } from '../types'
import { isLlmUsable } from '../services/llmClient'
import { parseNaturalLanguageTx, type NlTxParseResult } from '../services/nlTx'
import { color } from '../theme/colors'
import { btnAi, btnGhost, inputCls } from './Modal'

interface Props {
  assets: Asset[]
  settings: Settings
  disabled?: boolean
  /** 从资产页进入时锁定目标资产 */
  fixedAssetId?: string
  /** 弹窗内使用,去掉外层卡片样式 */
  embedded?: boolean
  /** 已有模式切换时隐藏「手动填写」按钮 */
  hideManualAction?: boolean
  onParsed: (result: NlTxParseResult, rawInput: string) => void
  onManual: () => void
}

export default function NlTxInput({
  assets,
  settings,
  disabled,
  fixedAssetId,
  embedded,
  hideManualAction,
  onParsed,
  onManual,
}: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const canUseLlm = isLlmUsable(settings.llm.apiKey, settings.llm.baseUrl)

  const submit = async () => {
    const text = input.trim()
    if (!text || loading) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError('')
    try {
      const result = await parseNaturalLanguageTx(text, assets, settings, ac.signal)
      if (fixedAssetId) {
        result.assetId = fixedAssetId
        result.warnings = result.warnings.filter((w) => !w.includes('未能自动匹配资产'))
      }
      onParsed(result, text)
      setInput('')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const fixedAsset = fixedAssetId ? assets.find((a) => a.id === fixedAssetId) : undefined
  const placeholder = !canUseLlm
    ? '请先在设置页配置 LLM 接口'
    : fixedAsset
      ? '用一句话描述,如:今天存入 2 万'
      : '用一句话描述这笔流水…'

  const body = (
    <>
      {!embedded && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-medium text-slate-800">自然语言记一笔</h3>
          </div>
          <span className="text-xs text-slate-500">
            例:今天招商银行存了 2 万 · 支付宝理财更新估值 12 万
          </span>
        </div>
      )}
      {embedded && (
        <p className="text-xs text-slate-500">用一句话描述这笔流水，AI 解析后请你确认再写入。</p>
      )}
      <div className={`flex gap-2 ${hideManualAction ? 'flex-col sm:flex-row sm:items-stretch' : 'flex-col sm:flex-row'}`}>
        <input
          className={`${inputCls} ${hideManualAction ? 'min-w-0 flex-1' : ''}`}
          value={input}
          disabled={disabled || loading || !canUseLlm}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className={`flex shrink-0 gap-2 ${hideManualAction ? 'sm:w-auto' : ''}`}>
          <button
            className={`${btnAi} ${hideManualAction ? 'w-full sm:w-auto' : ''}`}
            disabled={disabled || loading || !canUseLlm || !input.trim()}
            onClick={submit}
          >
            {loading ? '解析中…' : 'AI 解析'}
          </button>
          {!hideManualAction && (
            <button className={btnGhost} disabled={disabled || loading} onClick={onManual}>
              手动填写
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className={`mt-2 flex flex-wrap items-center gap-2 text-sm ${color.error}`}>
          <span>{error}</span>
          <button className={`text-xs ${color.link} hover:underline`} onClick={onManual}>
            {hideManualAction ? '切换到手动填写' : '改用手动填写'}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        将发送你的原文
        {settings.llmSendAssetNames !== false && !fixedAssetId ? '及资产名称列表' : ''}
        至 LLM 解析,确认后才会写入本地。
        {!fixedAssetId && '可在设置页关闭「发送资产名称」。'}
      </p>
    </>
  )

  if (embedded) return <div className="space-y-3">{body}</div>
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200">
      {body}
    </div>
  )
}
