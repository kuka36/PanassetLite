import type { PortfolioSummary, Settings } from '../types'
import type { AppPageId, ChatMessage, PendingAction } from '../types/assistant'
import { buildPortfolioBrief, formatLlmNowContext } from './ai'
import {
  isLocalLlmBaseUrl,
  isLocalLlmUnavailableOnRemoteHost,
  LOCAL_LLM_REMOTE_HOST_MSG,
  parseChatCompletionResponse,
  postChatCompletions,
} from './llmClient'
import {
  ASSISTANT_TOOL_DEFINITIONS,
  type AssistantToolContext,
  executeAssistantTool,
  isWriteTool,
} from './assistantTools'

const MAX_TOOL_ITERATIONS = 8

/** 可编辑/预览的出站消息(无 tool_calls) */
export type OutgoingApiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type ApiMessage =
  | OutgoingApiMessage
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface RunAssistantTurnResult {
  assistantContent: string
  pendingActions: Array<{ action: PendingAction; summary: string }>
}

export interface BuildOutgoingOptions {
  userInput: string
  history: ChatMessage[]
  summary: PortfolioSummary
  currentPage: AppPageId
  settings: Settings
  includePortfolio: boolean
}

function assertLlmReady(settings: Settings) {
  const { baseUrl, apiKey } = settings.llm
  if (isLocalLlmUnavailableOnRemoteHost(baseUrl)) {
    throw new Error(LOCAL_LLM_REMOTE_HOST_MSG)
  }
  if (!apiKey && !isLocalLlmBaseUrl(baseUrl)) {
    throw new Error('未配置 LLM API key,请到设置页填写(本地模型可留空 key)')
  }
}

export function buildSystemPrompt(
  summary: PortfolioSummary,
  currentPage: AppPageId,
  settings: Settings,
  includePortfolio: boolean,
): string {
  const nowAndPage = `当前页面:${currentPage}。${formatLlmNowContext()}。`

  if (!includePortfolio) {
    return (
      '你是 PanassetLite 内的通用 AI 助手,当前为纯对话模式。' +
      '未附带用户的资产组合数据,也未提供查询/记账等工具。' +
      '请基于对话内容用简体中文直接回答;不要声称已查询本地资产、已写入流水或已执行操作。' +
      '若用户需要基于真实持仓的分析或记账,可提示其打开「包含资产上下文」。' +
      nowAndPage
    )
  }

  return (
    '你是 PanassetLite 的 AI 助手,帮助用户管理本地个人资产。' +
    '你可以查询组合摘要、区间收益、单资产 XIRR/近期年化、流水账本、分析风险、导航页面、刷新行情,以及提议添加/修改/删除资产与流水。' +
    '回答收益、值不值得留、涨跌等问题时,优先调用 get_period_returns / get_asset_detail / list_assets / list_ledger,并引用工具返回的具体数字;禁止无数据的空泛建议。' +
    '给出配置/记账类建议后,若用户可立即执行(如更新过期估值、记一笔流水、添加资产),应调用相应 propose_* 工具发起待确认操作,不要只停留在文字建议。' +
    '重要:所有写操作(添加/修改/删除)必须通过工具 propose_* 发起,系统会打开确认表单或对话确认,你不得声称已直接写入。' +
    '调用工具后必须用自然语言向用户解释结果,禁止只调用工具而不给出文字回复。' +
    '导入导出、清空数据、LLM 配置请用 open_settings 引导用户去设置页手动操作。' +
    nowAndPage +
    '系统上下文已附带当前资产组合摘要(含资产名称、市值与盈亏)。' +
    '\n\n当前资产组合摘要:\n' +
    buildPortfolioBrief(summary, settings)
  )
}

function dedupeTrailingUserMessage(history: OutgoingApiMessage[], userInput: string): OutgoingApiMessage[] {
  const last = history[history.length - 1]
  if (last?.role === 'user' && last.content === userInput) {
    return history.slice(0, -1)
  }
  return history
}

function chatHistoryToApi(messages: ChatMessage[]): OutgoingApiMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))
}

/** 构建即将发送给 LLM 的 messages(与 runAssistantTurn 一致) */
export function buildOutgoingApiMessages(opts: BuildOutgoingOptions): OutgoingApiMessage[] {
  const historyMessages = dedupeTrailingUserMessage(chatHistoryToApi(opts.history), opts.userInput)
  return [
    {
      role: 'system',
      content: buildSystemPrompt(
        opts.summary,
        opts.currentPage,
        opts.settings,
        opts.includePortfolio,
      ),
    },
    ...historyMessages,
    { role: 'user', content: opts.userInput },
  ]
}

/** 校验用户编辑的 messages JSON */
export function parseOutgoingApiMessages(raw: string): OutgoingApiMessage[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('上下文不是合法 JSON,请检查后再发送')
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('上下文须为非空的 messages 数组')
  }
  const roles = new Set(['system', 'user', 'assistant'])
  const messages: OutgoingApiMessage[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      throw new Error('messages 中每项须为对象')
    }
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if (typeof role !== 'string' || !roles.has(role)) {
      throw new Error('messages 仅支持 role 为 system / user / assistant')
    }
    if (typeof content !== 'string') {
      throw new Error('messages 每项的 content 须为字符串')
    }
    messages.push({ role: role as OutgoingApiMessage['role'], content })
  }
  return messages
}

/** 无 tools 的单次 chat/completions(纯 LLM) */
export async function runPlainLlmTurn(
  messages: OutgoingApiMessage[],
  settings: Settings,
  signal?: AbortSignal,
): Promise<RunAssistantTurnResult> {
  assertLlmReady(settings)
  if (messages.length === 0) {
    throw new Error('上下文为空,无法发送')
  }

  const res = await postChatCompletions(
    settings.llm.baseUrl,
    settings.llm.apiKey,
    {
      model: settings.llm.model,
      messages,
      temperature: 0.4,
      stream: false,
    },
    signal,
  )

  const message = await parseChatCompletionResponse(res)
  const assistantContent = message?.content?.trim() ?? ''
  if (!assistantContent) {
    throw new Error('LLM 返回为空')
  }
  return { assistantContent, pendingActions: [] }
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function synthesizeAssistantReply(
  apiMessages: ApiMessage[],
  ctx: AssistantToolContext,
  signal?: AbortSignal,
): Promise<string> {
  const res = await postChatCompletions(
    ctx.settings.llm.baseUrl,
    ctx.settings.llm.apiKey,
    {
      model: ctx.settings.llm.model,
      messages: [
        ...apiMessages,
        {
          role: 'user',
          content: '请根据已获得的数据,用简体中文直接回答用户最后的问题。给出具体分析和建议,不要调用工具。',
        },
      ],
      temperature: 0.4,
      stream: false,
    },
    signal,
  )

  const message = await parseChatCompletionResponse(res)
  return message?.content?.trim() ?? ''
}

/** 无 LLM 时的本地快捷回复 */
export async function runLocalQuickReply(
  input: string,
  ctx: AssistantToolContext,
): Promise<RunAssistantTurnResult | null> {
  const text = input.trim().toLowerCase()
  if (!text) return null

  if (/健康|评分|风险|分析/.test(text)) {
    const r = await executeAssistantTool('analyze_portfolio', {}, ctx)
    return { assistantContent: formatAnalyzeResult(r.content), pendingActions: [] }
  }

  if (/复盘|财富/.test(text)) {
    const summary = await executeAssistantTool('get_portfolio_summary', {}, ctx)
    const analyze = await executeAssistantTool('analyze_portfolio', {}, ctx)
    return {
      assistantContent:
        formatSummaryResult(summary.content) +
        '\n\n' +
        formatAnalyzeResult(analyze.content) +
        '\n\n*深度财富复盘需配置 LLM,或点击上方「本月财富复盘」快捷问题。*',
      pendingActions: [],
    }
  }

  if (/净资产|总资产|负债|多少钱|概况|摘要/.test(text)) {
    const r = await executeAssistantTool('get_portfolio_summary', {}, ctx)
    return { assistantContent: formatSummaryResult(r.content), pendingActions: [] }
  }

  if (/区间收益|近.?30|年化|xirr|收益率/.test(text)) {
    const returns = await executeAssistantTool('get_period_returns', {}, ctx)
    const assets = await executeAssistantTool('list_assets', {}, ctx)
    return {
      assistantContent:
        formatPeriodReturnsResult(returns.content) +
        '\n\n' +
        formatAssetsMetricsResult(assets.content) +
        '\n\n*深度解读与操作建议需配置 LLM。*',
      pendingActions: [],
    }
  }

  if (/资产列表|有哪些资产|列出资产/.test(text)) {
    const r = await executeAssistantTool('list_assets', {}, ctx)
    try {
      const data = JSON.parse(r.content) as {
        assets: Array<{
          name?: string
          type: string
          valueCNY: number
          xirr: number | null
          recentAnnualized: number | null
        }>
      }
      const lines = ['**资产列表**', '']
      for (const a of data.assets) {
        const label = a.name ?? a.type
        const xirr = a.xirr != null ? `, XIRR ${(a.xirr * 100).toFixed(1)}%` : ''
        const recent =
          a.recentAnnualized != null
            ? `, 近期年化 ${(a.recentAnnualized * 100).toFixed(1)}%`
            : ''
        lines.push(`- ${label}(${a.type}): ¥${a.valueCNY.toLocaleString()}${xirr}${recent}`)
      }
      if (data.assets.length === 0) lines.push('暂无资产')
      return { assistantContent: lines.join('\n'), pendingActions: [] }
    } catch {
      return { assistantContent: r.content, pendingActions: [] }
    }
  }

  if (/刷新行情|更新价格|汇率/.test(text)) {
    const r = await executeAssistantTool('refresh_prices', {}, ctx)
    try {
      const data = JSON.parse(r.content) as { message?: string }
      return {
        assistantContent: data.message ?? '行情已刷新',
        pendingActions: [],
      }
    } catch {
      return { assistantContent: '行情已刷新', pendingActions: [] }
    }
  }

  if (/打开设置|去设置/.test(text)) {
    await executeAssistantTool('open_settings', {}, ctx)
    return { assistantContent: '已打开设置页。', pendingActions: [] }
  }

  if (/打开资产|资产页/.test(text)) {
    await executeAssistantTool('navigate', { page: 'assets' }, ctx)
    return { assistantContent: '已切换到资产页。', pendingActions: [] }
  }

  if (/打开流水|资产流水/.test(text)) {
    await executeAssistantTool('navigate', { page: 'flows' }, ctx)
    return { assistantContent: '已切换到流水页。', pendingActions: [] }
  }

  return null
}

function formatAnalyzeResult(json: string): string {
  try {
    const data = JSON.parse(json) as {
      score: number
      grade: string
      insights: Array<{ level: string; title: string; detail: string }>
    }
    const lines = [`**健康评分 ${data.score}/100(${data.grade})**`, '']
    for (const i of data.insights) {
      lines.push(`- **${i.title}**: ${i.detail}`)
    }
    return lines.join('\n')
  } catch {
    return json
  }
}

function formatSummaryResult(json: string): string {
  try {
    const data = JSON.parse(json) as {
      netWorthCNY: number
      totalAssetsCNY: number
      totalDebtCNY: number
      totalPnlCNY: number
      byType: Array<{ type: string; valueCNY: number }>
      periodReturns?: Array<{ label: string; pnlCNY: number; ratio: number | null }>
    }
    const lines = [
      `- 净资产: ¥${data.netWorthCNY.toLocaleString()}`,
      `- 总资产: ¥${data.totalAssetsCNY.toLocaleString()}`,
      `- 负债: ¥${data.totalDebtCNY.toLocaleString()}`,
      `- 累计盈亏: ¥${data.totalPnlCNY.toLocaleString()}`,
      '',
      '**类别分布:**',
    ]
    for (const t of data.byType) {
      if (t.valueCNY > 0) lines.push(`- ${t.type}: ¥${t.valueCNY.toLocaleString()}`)
    }
    if (data.periodReturns && data.periodReturns.length > 0) {
      lines.push('', '**区间收益:**')
      for (const p of data.periodReturns) {
        const ratio =
          p.ratio != null ? ` (${(p.ratio * 100).toFixed(1)}%)` : ''
        lines.push(`- ${p.label}: ¥${p.pnlCNY.toLocaleString()}${ratio}`)
      }
    }
    return lines.join('\n')
  } catch {
    return json
  }
}

function formatPeriodReturnsResult(json: string): string {
  try {
    const data = JSON.parse(json) as {
      periodReturns: Array<{ label: string; pnlCNY: number; ratio: number | null }>
    }
    const lines = ['**区间收益**', '']
    for (const p of data.periodReturns) {
      const ratio = p.ratio != null ? ` (${(p.ratio * 100).toFixed(1)}%)` : ''
      lines.push(`- ${p.label}: ¥${p.pnlCNY.toLocaleString()}${ratio}`)
    }
    if (data.periodReturns.length === 0) lines.push('暂无区间收益数据')
    return lines.join('\n')
  } catch {
    return json
  }
}

function formatAssetsMetricsResult(json: string): string {
  try {
    const data = JSON.parse(json) as {
      assets: Array<{
        name?: string
        type: string
        valueCNY: number
        xirr: number | null
        recentAnnualized: number | null
      }>
    }
    const lines = ['**资产收益指标**', '']
    for (const a of data.assets) {
      if (a.valueCNY <= 0) continue
      const label = a.name ?? a.type
      const xirr = a.xirr != null ? `XIRR ${(a.xirr * 100).toFixed(1)}%` : 'XIRR —'
      const recent =
        a.recentAnnualized != null
          ? `近期年化 ${(a.recentAnnualized * 100).toFixed(1)}%`
          : '近期年化 —'
      lines.push(`- ${label}: ¥${a.valueCNY.toLocaleString()}, ${xirr}, ${recent}`)
    }
    if (lines.length === 2) lines.push('暂无持仓')
    return lines.join('\n')
  } catch {
    return json
  }
}

export async function runAssistantTurn(
  userInput: string,
  history: ChatMessage[],
  ctx: AssistantToolContext,
  currentPage: AppPageId,
  signal?: AbortSignal,
  includePortfolio = false,
): Promise<RunAssistantTurnResult> {
  assertLlmReady(ctx.settings)

  const outgoing = buildOutgoingApiMessages({
    userInput,
    history,
    summary: ctx.summary,
    currentPage,
    settings: ctx.settings,
    includePortfolio,
  })

  // 未包含资产上下文:纯对话,不附带 tools
  if (!includePortfolio) {
    return runPlainLlmTurn(outgoing, ctx.settings, signal)
  }

  const apiMessages: ApiMessage[] = [...outgoing]

  const pendingActions: Array<{ action: PendingAction; summary: string }> = []
  let finalContent = ''

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await postChatCompletions(
      ctx.settings.llm.baseUrl,
      ctx.settings.llm.apiKey,
      {
        model: ctx.settings.llm.model,
        messages: apiMessages,
        tools: ASSISTANT_TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.3,
        stream: false,
      },
      signal,
    )

    const message = await parseChatCompletionResponse(res)
    if (!message) throw new Error('LLM 返回为空')

    if (message.tool_calls?.length) {
      apiMessages.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: message.tool_calls,
      })

      for (const tc of message.tool_calls) {
        const args = parseToolArgs(tc.function.arguments)
        const result = await executeAssistantTool(tc.function.name, args, ctx, signal)

        if (result.pendingAction && result.pendingSummary) {
          pendingActions.push({ action: result.pendingAction, summary: result.pendingSummary })
        }

        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.content,
        })
      }
      continue
    }

    finalContent = message.content?.trim() ?? ''
    break
  }

  if (!finalContent && pendingActions.length > 0) {
    const summaries = pendingActions.map((p) => p.summary).join('、')
    finalContent = `已为你准备好操作:**${summaries}**。请在下方确认卡片中打开表单完成写入。`
  }

  if (!finalContent) {
    finalContent = await synthesizeAssistantReply(apiMessages, ctx, signal)
  }

  if (!finalContent) {
    finalContent = '抱歉,未能生成完整回复。请换一种问法,或点击上方快捷问题重试。'
  }

  return { assistantContent: finalContent, pendingActions }
}

export async function runLocalAssistantTurn(
  userInput: string,
  ctx: AssistantToolContext,
): Promise<RunAssistantTurnResult> {
  const quick = await runLocalQuickReply(userInput, ctx)
  if (quick) return quick

  return {
    assistantContent:
      '当前未配置 LLM,仅支持本地快捷查询(如「我的净资产」「健康评分」)。' +
      '深度对话与自动操作请到**设置**页配置 OpenAI 兼容接口,或点击快捷问题(需 LLM)。',
    pendingActions: [],
  }
}

export { isWriteTool }
