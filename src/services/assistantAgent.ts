import type { PortfolioSummary, Settings } from '../types'
import type { AppPageId, ChatMessage, LlmContextPrivacy, PendingAction } from '../types/assistant'
import { buildPortfolioBrief } from './ai'
import {
  isLocalLlmBaseUrl,
  isLocalLlmUnavailableOnRemoteHost,
  LOCAL_LLM_REMOTE_HOST_MSG,
  postChatCompletions,
} from './llmClient'
import {
  ASSISTANT_TOOL_DEFINITIONS,
  type AssistantToolContext,
  executeAssistantTool,
  isWriteTool,
} from './assistantTools'

const MAX_TOOL_ITERATIONS = 8

type ApiMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
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

function assertLlmReady(settings: Settings) {
  const { baseUrl, apiKey } = settings.llm
  if (isLocalLlmUnavailableOnRemoteHost(baseUrl)) {
    throw new Error(LOCAL_LLM_REMOTE_HOST_MSG)
  }
  if (!apiKey && !isLocalLlmBaseUrl(baseUrl)) {
    throw new Error('未配置 LLM API key,请到设置页填写(本地模型可留空 key)')
  }
}

function resolveContextPrivacy(settings: Settings): LlmContextPrivacy {
  return settings.llmContextPrivacy === 'summary' ? 'summary' : 'detailed'
}

function buildSystemPrompt(
  summary: PortfolioSummary,
  currentPage: AppPageId,
  settings: Settings,
): string {
  const privacy = resolveContextPrivacy(settings)
  const privacyNote =
    privacy === 'summary'
      ? '当前用户已选择「仅汇总」隐私模式,系统上下文不含具体持仓名称与单项盈亏。'
      : '当前用户已选择「含明细」模式,系统上下文包含持仓名称、市值与盈亏。'
  return (
    '你是 PanassetLite 的 AI 助手,帮助用户管理本地个人资产。' +
    '你可以查询组合、分析风险、导航页面、刷新行情,以及提议添加/修改/删除资产与流水。' +
    '重要:所有写操作(添加/修改/删除)必须通过工具 propose_* 发起,系统会打开确认表单或对话确认,你不得声称已直接写入。' +
    '调用工具后必须用自然语言向用户解释结果,禁止只调用工具而不给出文字回复。' +
    '导入导出、清空数据、LLM 配置请用 open_settings 引导用户去设置页手动操作。' +
    `当前页面:${currentPage}。${privacyNote}` +
    '\n\n当前资产组合摘要:\n' +
    buildPortfolioBrief(summary, privacy)
  )
}

function dedupeTrailingUserMessage(history: ApiMessage[], userInput: string): ApiMessage[] {
  const last = history[history.length - 1]
  if (last?.role === 'user' && last.content === userInput) {
    return history.slice(0, -1)
  }
  return history
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

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM 请求失败 (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  }
  if (data.error?.message) throw new Error(data.error.message)

  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

function chatHistoryToApi(messages: ChatMessage[]): ApiMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
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

  if (/资产列表|有哪些资产|列出资产/.test(text)) {
    const r = await executeAssistantTool('list_assets', {}, ctx)
    try {
      const data = JSON.parse(r.content) as {
        assets: Array<{ name: string; type: string; valueCNY: number }>
      }
      const lines = ['**资产列表**', '']
      for (const a of data.assets) {
        lines.push(`- ${a.name}(${a.type}): ¥${a.valueCNY.toLocaleString()}`)
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
    return { assistantContent: '已切换到资产流水页。', pendingActions: [] }
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
): Promise<RunAssistantTurnResult> {
  assertLlmReady(ctx.settings)

  const historyMessages = dedupeTrailingUserMessage(chatHistoryToApi(history), userInput)
  const apiMessages: ApiMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx.summary, currentPage, ctx.settings) },
    ...historyMessages,
    { role: 'user', content: userInput },
  ]

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

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LLM 请求失败 (${res.status}): ${text.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>
      error?: { message?: string }
    }
    if (data.error?.message) throw new Error(data.error.message)

    const message = data.choices?.[0]?.message
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
