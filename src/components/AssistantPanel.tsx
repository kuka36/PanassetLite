import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Braces, ClipboardList, Send, Trash2, X } from 'lucide-react'
import { findQueueIdByAction, useAssistantStore } from '../assistantStore'
import { useStore } from '../store'
import { usePortfolioEngine, useSummary } from '../hooks/useSummary'
import LightMarkdown from './LightMarkdown'
import {
  DeleteConfirmCard,
  PendingActionCard,
} from './AssistantConfirmModals'
import { btnAi, btnGhost, inputCls } from './Modal'
import { ADVISOR_PRESETS, DEFAULT_ADVISOR_PROMPT, resolveAdvisorPrompt } from '../services/ai'
import {
  buildOutgoingApiMessages,
  parseOutgoingApiMessages,
  runAssistantTurn,
  runLocalAssistantTurn,
  runPlainLlmTurn,
} from '../services/assistantAgent'
import type { AssistantToolContext } from '../services/assistantTools'
import { isLlmUsable } from '../services/llmClient'
import type { AppPageId, AuditLogEntry, PendingAction } from '../types/assistant'
import { clearAuditLog, getAuditLog } from '../services/assistantAudit'
import { color } from '../theme/colors'

interface Props {
  currentPage: AppPageId
  onNavigate: (page: AppPageId) => void
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
  const includePortfolioContext = useAssistantStore((s) => s.includePortfolioContext)
  const setIncludePortfolioContext = useAssistantStore((s) => s.setIncludePortfolioContext)

  const assets = useStore((s) => s.assets)
  const transactions = useStore((s) => s.transactions)
  const settings = useStore((s) => s.settings)
  const summary = useSummary()
  const engine = usePortfolioEngine()

  const [input, setInput] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [contextOpen, setContextOpen] = useState(false)
  const [contextText, setContextText] = useState('')
  const [contextDirty, setContextDirty] = useState(false)
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

  const llmReady = isLlmUsable(settings.llm.apiKey, settings.llm.baseUrl)

  useEffect(() => {
    if (open && messages.length === 0) {
      addMessage({
        role: 'assistant',
        content:
          '你好,我是 PanassetLite AI 助手。默认是纯对话模式(不发送资产、不附带工具)。' +
          '打开上方「包含资产上下文」后,可查询收益、分析组合,并提议记流水或改资产(需你确认)。' +
          (llmReady
            ? '也可点下方快捷问题,或直接提问。'
            : '\n\n当前未配置 LLM,可先问「我的净资产」或「健康评分」;完整能力请到设置页配置接口。'),
      })
    }
  }, [open, messages.length, addMessage, llmReady])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const autoContextText = useMemo(() => {
    const draft = input.trim() || '（在此输入本轮问题后预览会更新）'
    return JSON.stringify(
      buildOutgoingApiMessages({
        userInput: draft,
        history: messages,
        summary,
        currentPage,
        settings,
        includePortfolio: includePortfolioContext,
      }),
      null,
      2,
    )
  }, [input, messages, summary, currentPage, settings, includePortfolioContext])

  const displayContextText = contextDirty ? contextText : autoContextText

  const buildContext = (): AssistantToolContext => ({
    assets,
    transactions,
    settings,
    summary,
    navigate: onNavigate,
    getTxLedger: (assetId) => {
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) return null
      return engine.txLedger(asset)
    },
    getPeriodReturns: (assetId) => {
      if (!assetId) return summary.periodReturns
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) return null
      return engine.periodReturnsForAssets([asset])
    },
  })

  const pendingCount = actionQueue.filter((q) => q.status === 'pending' || q.status === 'active').length

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

  const applyTurnResult = (
    assistantId: string,
    result: Awaited<ReturnType<typeof runAssistantTurn>>,
  ) => {
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

  const sendPlainFromEditor = async (ac: AbortController) => {
    const apiMessages = parseOutgoingApiMessages(contextText)
    const lastUser = [...apiMessages].reverse().find((m) => m.role === 'user')
    const displayUser = lastUser?.content?.trim() || '（自定义上下文）'
    addMessage({ role: 'user', content: displayUser })
    setInput('')
    const assistantId = addMessage({ role: 'assistant', content: '' })
    const result = await runPlainLlmTurn(apiMessages, settings, ac.signal)
    applyTurnResult(assistantId, result)
    setContextDirty(false)
  }

  const sendUserMessage = async (text: string) => {
    if (loading) return
    if (!contextDirty && !text.trim()) return
    if (contextDirty && !llmReady) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError('')

    try {
      if (contextDirty) {
        await sendPlainFromEditor(ac)
        return
      }

      const trimmed = text.trim()
      addMessage({ role: 'user', content: trimmed })
      setInput('')

      const assistantId = addMessage({ role: 'assistant', content: '' })
      const history = useAssistantStore.getState().messages.filter((m) => m.id !== assistantId)

      if (llmReady) {
        const advisorPrompt = resolveAdvisorPrompt(trimmed)
        const agentInput = advisorPrompt ?? trimmed
        const apiHistory = advisorPrompt != null ? history.slice(0, -1) : history
        const result = await runAssistantTurn(
          agentInput,
          apiHistory,
          buildContext(),
          currentPage,
          ac.signal,
          includePortfolioContext,
        )
        applyTurnResult(assistantId, result)
      } else {
        const result = await runLocalAssistantTurn(trimmed, buildContext())
        applyTurnResult(assistantId, result)
      }
      setContextDirty(false)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const errMsg = (e as Error).message
      setError(errMsg)
      const last = useAssistantStore.getState().messages.at(-1)
      if (last?.role === 'assistant' && !last.content) {
        updateMessage(last.id, { content: `出错了:${errMsg}` })
      }
    } finally {
      if (abortRef.current === ac) setLoading(false)
    }
  }

  const runPreset = async (label: string, prompt: string) => {
    if (!llmReady || loading || contextDirty) return
    const q = prompt.trim() || DEFAULT_ADVISOR_PROMPT

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    addMessage({ role: 'user', content: label })
    setLoading(true)
    setError('')

    const assistantId = addMessage({ role: 'assistant', content: '' })

    try {
      const history = useAssistantStore.getState().messages.filter((m) => m.id !== assistantId)
      const result = await runAssistantTurn(
        q,
        history.slice(0, -1),
        buildContext(),
        currentPage,
        ac.signal,
        includePortfolioContext,
      )
      applyTurnResult(assistantId, result)
      setContextDirty(false)
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

  const canSend = contextDirty ? llmReady : Boolean(input.trim())

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
              {pendingCount > 0 && ` · 待确认 ${pendingCount} 项`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`rounded-xl p-2 hover:bg-slate-100 ${
                contextOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
              }`}
              onClick={() => setContextOpen((v) => !v)}
              title="查看/编辑请求上下文"
            >
              <Braces className="h-4 w-4" />
            </button>
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

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="accent-indigo-600"
              checked={includePortfolioContext}
              onChange={(e) => setIncludePortfolioContext(e.target.checked)}
            />
            <span>
              包含资产上下文
              {!includePortfolioContext && (
                <span className="ml-1 text-slate-400">（纯对话，不发送资产与工具）</span>
              )}
            </span>
          </label>
        </div>

        {contextOpen && (
          <div className="flex shrink-0 flex-col border-b border-slate-100 px-4 py-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] text-slate-500">
                发给 LLM 的 messages
                {contextDirty
                  ? ' · 已手动编辑(发送时无工具)'
                  : includePortfolioContext
                    ? ' · 自动同步 · 含资产与工具'
                    : ' · 自动同步 · 当前请求不含 tools'}
              </p>
              <button
                type="button"
                className={`${btnGhost} px-2 py-0.5 text-[10px]`}
                disabled={!contextDirty}
                onClick={() => setContextDirty(false)}
              >
                重置为自动构建
              </button>
            </div>
            <textarea
              className={`${inputCls} h-40 resize-y font-mono text-[10px] leading-relaxed`}
              value={displayContextText}
              spellCheck={false}
              onChange={(e) => {
                setContextText(e.target.value)
                setContextDirty(true)
              }}
            />
          </div>
        )}

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
            {ADVISOR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={loading || !llmReady || contextDirty}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                onClick={() => runPreset(preset.label, preset.prompt)}
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
              disabled={loading || contextDirty}
              placeholder={
                contextDirty
                  ? '已编辑上下文,点击发送将直接调用 LLM'
                  : llmReady
                    ? '问我任何问题…'
                    : '试试「我的净资产」或「健康评分」'
              }
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
              disabled={loading || !canSend}
              onClick={() => void sendUserMessage(input)}
              title={contextDirty ? '以当前上下文发送(无工具)' : '发送'}
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
          {llmReady && contextDirty && (
            <p className="mt-2 text-[10px] text-slate-500">
              将按编辑后的 messages 直接调用 LLM(不附带助手工具)。
            </p>
          )}
          {llmReady && !contextDirty && !includePortfolioContext && (
            <p className="mt-2 text-[10px] text-slate-500">
              当前为纯对话:不发送资产摘要、不附带工具。打开「包含资产上下文」可启用查询与记账。
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
