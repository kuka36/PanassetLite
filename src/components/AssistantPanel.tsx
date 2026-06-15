import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, Send, Trash2, X } from 'lucide-react'
import { findQueueIdByAction, useAssistantStore } from '../assistantStore'
import { useStore } from '../store'
import { useSummary } from '../hooks/useSummary'
import LightMarkdown from './LightMarkdown'
import {
  DeleteConfirmCard,
  PendingActionCard,
} from './AssistantConfirmModals'
import { btnAi, btnGhost, inputCls } from './Modal'
import { ADVISOR_PRESETS, DEFAULT_ADVISOR_PROMPT, resolveAdvisorPrompt, streamLlmAdvice } from '../services/ai'
import { runAssistantTurn, runLocalAssistantTurn } from '../services/assistantAgent'
import type { AssistantToolContext } from '../services/assistantTools'
import { isLocalLlmBaseUrl } from '../services/llmClient'
import type { AppPageId, AuditLogEntry, PendingAction } from '../types/assistant'
import { clearAuditLog, getAuditLog } from '../services/assistantAudit'
import { color } from '../theme/colors'

interface Props {
  currentPage: AppPageId
  onNavigate: (page: AppPageId) => void
}

function canUseLlm(apiKey: string, baseUrl: string): boolean {
  return !!apiKey || isLocalLlmBaseUrl(baseUrl)
}

export default function AssistantPanel({ currentPage, onNavigate }: Props) {
  const open = useAssistantStore((s) => s.open)
  const setOpen = useAssistantStore((s) => s.setOpen)
  const messages = useAssistantStore((s) => s.messages)
  const addMessage = useAssistantStore((s) => s.addMessage)
  const updateMessage = useAssistantStore((s) => s.updateMessage)
  const setPendingAction = useAssistantStore((s) => s.setPendingAction)
  const enqueueActions = useAssistantStore((s) => s.enqueueActions)
  const openQueuedAction = useAssistantStore((s) => s.openQueuedAction)
  const actionQueue = useAssistantStore((s) => s.actionQueue)
  const loading = useAssistantStore((s) => s.loading)
  const setLoading = useAssistantStore((s) => s.setLoading)
  const error = useAssistantStore((s) => s.error)
  const setError = useAssistantStore((s) => s.setError)
  const clearMessages = useAssistantStore((s) => s.clearMessages)

  const assets = useStore((s) => s.assets)
  const transactions = useStore((s) => s.transactions)
  const settings = useStore((s) => s.settings)
  const refreshPrices = useStore((s) => s.refreshPrices)
  const summary = useSummary()

  const [input, setInput] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  const llmReady = canUseLlm(settings.llm.apiKey, settings.llm.baseUrl)

  useEffect(() => {
    if (open && messages.length === 0) {
      addMessage({
        role: 'assistant',
        content:
          '你好,我是 PanassetLite AI 助手。你可以问我净资产、健康评分,或让我帮你记流水、添加资产。' +
          (llmReady ? '' : '\n\n当前未配置 LLM,可先问「我的净资产」或「健康评分」;完整能力请到设置页配置接口。'),
      })
    }
  }, [open, messages.length, addMessage, llmReady])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const buildContext = (): AssistantToolContext => ({
    assets,
    transactions,
    settings,
    summary,
    navigate: onNavigate,
    refreshPrices,
  })

  const pendingCount = actionQueue.filter((q) => q.status === 'pending' || q.status === 'active').length
  const privacyMode = settings.llmContextPrivacy === 'summary' ? '仅汇总' : '含明细'

  const openFormAction = (action: PendingAction) => {
    const queueId = findQueueIdByAction(action, useAssistantStore.getState().actionQueue)
    if (queueId) openQueuedAction(queueId)
    else setPendingAction(action)
  }

  const attachPendingToMessage = (
    msgId: string,
    pending: Array<{ action: PendingAction; summary: string }>,
  ) => {
    if (pending.length === 0) return
    const first = pending[0]
    updateMessage(msgId, {
      pendingAction: first.action,
      pendingSummary: first.summary,
    })
    enqueueActions(pending, msgId)
  }

  const sendUserMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    addMessage({ role: 'user', content: trimmed })
    setInput('')
    setLoading(true)
    setError('')

    const assistantId = addMessage({ role: 'assistant', content: '' })

    try {
      const history = useAssistantStore.getState().messages.filter((m) => m.id !== assistantId)
      let result

      if (llmReady) {
        const advisorPrompt = resolveAdvisorPrompt(trimmed)
        if (advisorPrompt !== null) {
          await streamLlmAdvice(summary, settings, advisorPrompt, (acc) => {
            updateMessage(assistantId, { content: acc })
          }, ac.signal)
        } else {
          result = await runAssistantTurn(trimmed, history, buildContext(), currentPage, ac.signal)
          updateMessage(assistantId, { content: result.assistantContent })
          attachPendingToMessage(assistantId, result.pendingActions)

          for (let i = 1; i < result.pendingActions.length; i++) {
            const p = result.pendingActions[i]
            addMessage({
              role: 'assistant',
              content: `还有一项待确认:**${p.summary}**`,
              pendingAction: p.action,
              pendingSummary: p.summary,
            })
          }
        }
      } else {
        result = await runLocalAssistantTurn(trimmed, buildContext())
        updateMessage(assistantId, { content: result.assistantContent })
        attachPendingToMessage(assistantId, result.pendingActions)
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const errMsg = (e as Error).message
      setError(errMsg)
      updateMessage(assistantId, { content: `出错了:${errMsg}` })
    } finally {
      if (abortRef.current === ac) setLoading(false)
    }
  }

  const runPreset = async (prompt: string) => {
    if (!llmReady || loading) return
    const q = prompt.trim() || DEFAULT_ADVISOR_PROMPT

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    addMessage({ role: 'user', content: q })
    setLoading(true)
    setError('')

    const assistantId = addMessage({ role: 'assistant', content: '' })

    try {
      await streamLlmAdvice(summary, settings, q, (acc) => {
        updateMessage(assistantId, { content: acc })
      }, ac.signal)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const errMsg = (e as Error).message
      setError(errMsg)
      updateMessage(assistantId, { content: `出错了:${errMsg}` })
    } finally {
      if (abortRef.current === ac) setLoading(false)
    }
  }

  const handleDeleteDone = (msgId: string, message: string, action?: PendingAction) => {
    updateMessage(msgId, { pendingAction: undefined, pendingSummary: undefined })
    if (action) {
      const queueId = findQueueIdByAction(action, useAssistantStore.getState().actionQueue)
      if (queueId) useAssistantStore.getState().completeQueueItem(queueId, message.includes('取消'))
    }
    addMessage({ role: 'assistant', content: message })
  }

  const openAudit = () => {
    setAuditEntries(getAuditLog().slice().reverse())
    setAuditOpen(true)
  }

  if (!open) return null

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:bg-slate-900/10"
        onClick={() => setOpen(false)}
        aria-label="关闭 AI 助手"
      />
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-slate-100 bg-white shadow-2xl transition-transform duration-200 sm:w-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">AI 助手</h2>
            <p className="text-[10px] text-slate-500">
              对话操作 · 写操作需确认
              {llmReady && ` · LLM 上下文:${privacyMode}`}
              {pendingCount > 0 && ` · 待确认 ${pendingCount} 项`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              onClick={openAudit}
              title="操作审计"
            >
              <ClipboardList className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              onClick={clearMessages}
              title="清空对话"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              onClick={() => setOpen(false)}
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-100 bg-slate-50 text-slate-700'
                }`}
              >
                {msg.role === 'assistant' && msg.content ? (
                  <LightMarkdown text={msg.content} />
                ) : (
                  msg.content
                )}
                {msg.role === 'assistant' && loading && !msg.content && (
                  <span className={`${color.muted} animate-pulse`}>思考中…</span>
                )}

                {msg.pendingAction && msg.pendingSummary && (
                  <>
                    {(msg.pendingAction.kind === 'deleteAsset' ||
                      msg.pendingAction.kind === 'deleteTx') && (
                      <DeleteConfirmCard
                        action={msg.pendingAction}
                        summary={msg.pendingSummary}
                        onDone={(m) => handleDeleteDone(msg.id, m, msg.pendingAction)}
                      />
                    )}
                    {msg.pendingAction.kind !== 'deleteAsset' &&
                      msg.pendingAction.kind !== 'deleteTx' && (
                        <PendingActionCard
                          summary={msg.pendingSummary}
                          action={msg.pendingAction}
                          onOpen={() => openFormAction(msg.pendingAction!)}
                        />
                      )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className={`shrink-0 px-4 pb-1 text-xs ${color.error}`}>{error}</p>
        )}

        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {ADVISOR_PRESETS.slice(0, 4).map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={loading || !llmReady}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                onClick={() => runPreset(preset.prompt)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className={inputCls}
              value={input}
              disabled={loading}
              placeholder={llmReady ? '问我任何问题…' : '试试「我的净资产」或「健康评分」'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendUserMessage(input)
                }
              }}
            />
            <button
              type="button"
              className={`${btnAi} shrink-0 px-3`}
              disabled={loading || !input.trim()}
              onClick={() => void sendUserMessage(input)}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {!llmReady && (
            <button
              type="button"
              className={`${btnGhost} mt-2 w-full text-xs`}
              onClick={() => onNavigate('settings')}
            >
              去设置页配置 LLM
            </button>
          )}
          {llmReady && settings.llmContextPrivacy === 'summary' && (
            <p className="mt-2 text-[10px] text-slate-500">
              当前为「仅汇总」隐私模式,发送给 LLM 的上下文不含持仓名称与单项盈亏。
            </p>
          )}
        </div>
      </aside>

      {auditOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div
              className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">操作审计</h3>
                <button
                  type="button"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                  onClick={() => setAuditOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto p-4 text-xs">
                {auditEntries.length === 0 ? (
                  <p className="text-slate-500">暂无审计记录</p>
                ) : (
                  auditEntries.map((e) => (
                    <div key={e.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <div className="flex justify-between text-slate-500">
                        <span>{e.kind}</span>
                        <span>{new Date(e.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{e.summary}</p>
                      {e.detail && (
                        <p className="mt-0.5 truncate text-slate-500" title={e.detail}>
                          {e.detail}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    clearAuditLog()
                    setAuditEntries([])
                  }}
                >
                  清空
                </button>
                <button type="button" className={btnGhost} onClick={() => setAuditOpen(false)}>
                  关闭
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>,
    document.body,
  )
}
