import { useRef, useState } from 'react'
import type { Asset, Settings, Transaction } from '../types'
import { isLocalLlmBaseUrl } from '../services/llmClient'
import { parseNaturalLanguageTx, type NlTxParseResult } from '../services/nlTx'
import { btnGhost, btnPrimary, inputCls } from './Modal'

interface Props {
  assets: Asset[]
  settings: Settings
  disabled?: boolean
  onParsed: (result: NlTxParseResult, rawInput: string) => void
  onManual: () => void
}

export default function NlTxInput({ assets, settings, disabled, onParsed, onManual }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const canUseLlm = !!settings.llm.apiKey || isLocalLlmBaseUrl(settings.llm.baseUrl)

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
      onParsed(result, text)
      setInput('')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-200">自然语言记一笔</h3>
        <span className="text-xs text-slate-500">
          例:今天招商银行存了 2 万 · 支付宝理财更新估值 12 万
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={inputCls}
          value={input}
          disabled={disabled || loading || !canUseLlm}
          placeholder={canUseLlm ? '用一句话描述这笔交易…' : '请先在设置页配置 LLM 接口'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="flex shrink-0 gap-2">
          <button
            className={btnPrimary}
            disabled={disabled || loading || !canUseLlm || !input.trim()}
            onClick={submit}
          >
            {loading ? '解析中…' : 'AI 解析'}
          </button>
          <button className={btnGhost} disabled={disabled || loading} onClick={onManual}>
            手动填写
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-400">
          <span>{error}</span>
          <button className="text-xs text-sky-400 hover:underline" onClick={onManual}>
            改用手动填写
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        将发送你的原文
        {settings.llmSendAssetNames !== false ? '及资产名称列表' : ''}
        至 LLM 解析,确认后才会写入本地。可在设置页关闭「发送资产名称」。
      </p>
    </div>
  )
}

/** 将 NL 解析结果转为 TxForm 可用的 initial */
export function nlResultToTxInitial(result: NlTxParseResult, assets: Asset[]): Transaction {
  const active = assets.filter((a) => !a.archived)
  const { draft, assetId } = result
  return {
    id: '',
    assetId: assetId ?? active[0]?.id ?? '',
    type: draft.type,
    date: draft.date,
    amount: draft.amount,
    quantity: draft.quantity,
    price: draft.price,
    value: draft.value,
    note: draft.note,
    createdAt: 0,
  }
}
