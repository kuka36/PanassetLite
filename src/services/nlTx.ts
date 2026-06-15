import type { Asset, Settings, Transaction, TxType } from '../types'
import { ASSET_TYPE_LABEL } from '../types'
import {
  isLocalLlmBaseUrl,
  isLocalLlmUnavailableOnRemoteHost,
  LOCAL_LLM_REMOTE_HOST_MSG,
  postChatCompletions,
} from './llmClient'
import { today } from './storage'

/** LLM 输出的交易草稿(尚未绑定 assetId) */
export interface NlTxDraft {
  type: TxType
  /** YYYY-MM-DD */
  date: string
  assetHint?: string
  amount?: number
  quantity?: number
  price?: number
  value?: number
  note?: string
}

export interface NlTxParseResult {
  draft: NlTxDraft
  /** 根据 assetHint 本地匹配到的资产;未匹配时为 undefined */
  assetId?: string
  warnings: string[]
}

const TX_TYPES: TxType[] = [
  'DEPOSIT',
  'WITHDRAW',
  'INCOME',
  'VALUATION',
  'BUY',
  'SELL',
  'BORROW',
  'REPAY',
]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const JSON_SCHEMA_DESC = `{
  "type": "DEPOSIT" | "WITHDRAW" | "INCOME" | "VALUATION" | "BUY" | "SELL" | "BORROW" | "REPAY",
  "date": "YYYY-MM-DD",
  "assetHint": "用户提到的资产或平台名称,如 招商银行、支付宝理财",
  "amount": "仅 DEPOSIT/WITHDRAW/INCOME/BORROW/REPAY,现金流金额",
  "quantity": "仅 BUY/SELL",
  "price": "仅 BUY/SELL,单价",
  "value": "仅 VALUATION,当日总市值(不要用 amount)",
  "note": "可选备注"
}`

function assertApiReady(settings: Settings) {
  const { baseUrl, apiKey } = settings.llm
  if (isLocalLlmUnavailableOnRemoteHost(baseUrl)) {
    throw new Error(LOCAL_LLM_REMOTE_HOST_MSG)
  }
  if (!apiKey && !isLocalLlmBaseUrl(baseUrl)) {
    throw new Error('未配置 LLM API key,请到设置页填写')
  }
}

function normalizeHint(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[「」『』"'()（）]/g, '')
}

/** 根据 assetHint 在本地资产列表中匹配 */
export function matchAssetByHint(hint: string | undefined, assets: Asset[]): string | undefined {
  if (!hint?.trim()) return undefined
  const active = assets.filter((a) => !a.archived)
  if (active.length === 0) return undefined

  const h = normalizeHint(hint)
  let best: { id: string; score: number } | undefined

  for (const a of active) {
    const candidates = [a.name, a.platform, `${a.platform ?? ''}${a.name}`, `${a.name}${a.platform ?? ''}`]
      .filter(Boolean)
      .map((c) => normalizeHint(c!))

    for (const c of candidates) {
      let score = 0
      if (c === h) score = 100
      else if (c.includes(h) || h.includes(c)) score = 70 + Math.min(c.length, h.length)
      else {
        const overlap = [...h].filter((ch) => c.includes(ch)).length
        if (overlap >= Math.min(3, h.length)) score = 30 + overlap
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { id: a.id, score }
      }
    }
  }

  return best && best.score >= 40 ? best.id : undefined
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readPositiveNumber(v: unknown, field: string): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`字段 ${field} 必须是有效非负数字`)
  }
  return n
}

function readPositiveStrict(v: unknown, field: string): number {
  const n = readPositiveNumber(v, field)
  if (n == null || n <= 0) throw new Error(`字段 ${field} 必须是大于 0 的数字`)
  return n
}

/** 严格校验 LLM 返回的 JSON 草稿 */
export function validateNlTxDraft(raw: unknown): NlTxDraft {
  if (!isPlainObject(raw)) throw new Error('LLM 返回不是 JSON 对象')

  const type = raw.type
  if (typeof type !== 'string' || !TX_TYPES.includes(type as TxType)) {
    throw new Error(`无效的交易类型: ${String(type)}`)
  }
  const txType = type as TxType

  const date = raw.date
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    throw new Error('日期必须是 YYYY-MM-DD 格式')
  }
  if (date > today()) {
    throw new Error('日期不能晚于今天')
  }

  const draft: NlTxDraft = {
    type: txType,
    date,
    assetHint: typeof raw.assetHint === 'string' && raw.assetHint.trim() ? raw.assetHint.trim() : undefined,
    note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined,
  }

  const amount = readPositiveNumber(raw.amount, 'amount')
  const quantity = readPositiveNumber(raw.quantity, 'quantity')
  const price = readPositiveNumber(raw.price, 'price')
  const value = readPositiveNumber(raw.value, 'value')

  switch (txType) {
    case 'DEPOSIT':
    case 'WITHDRAW':
    case 'INCOME':
    case 'BORROW':
    case 'REPAY':
      draft.amount = readPositiveStrict(raw.amount, 'amount')
      break
    case 'VALUATION': {
      // 模型常把估值金额误写在 amount,归一化为 value
      const valuation = value ?? amount
      if (valuation == null) throw new Error('估值更新需要 value 字段(总市值)')
      draft.value = valuation
      break
    }
    case 'BUY':
    case 'SELL':
      draft.quantity = readPositiveStrict(raw.quantity, 'quantity')
      draft.price = readPositiveStrict(raw.price, 'price')
      break
  }

  // 拒绝多余字段携带未声明的数值(减少模型幻觉);VALUATION 的 amount 已在上方归一化
  if (amount != null && draft.amount == null && txType !== 'VALUATION') {
    throw new Error(`${txType} 类型不应包含 amount 字段`)
  }
  if ((quantity != null || price != null) && draft.quantity == null) {
    throw new Error(`${txType} 类型不应包含 quantity/price 字段`)
  }
  if (value != null && draft.value == null) {
    throw new Error(`${txType} 类型不应包含 value 字段`)
  }

  return draft
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    /* fall through */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    return JSON.parse(fenced[1].trim())
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1))
  }

  throw new Error('无法从 LLM 响应中解析 JSON')
}

function buildAssetCatalog(assets: Asset[], includeNames: boolean): string {
  const active = assets.filter((a) => !a.archived)
  if (active.length === 0) return '(用户尚未添加资产)'

  if (!includeNames) {
    const counts: Record<string, number> = {}
    for (const a of active) {
      counts[a.type] = (counts[a.type] ?? 0) + 1
    }
    return (
      '用户资产概况(未发送具体名称): ' +
      Object.entries(counts)
        .map(([t, n]) => `${ASSET_TYPE_LABEL[t as keyof typeof ASSET_TYPE_LABEL]}×${n}`)
        .join('、')
    )
  }

  return active
    .map((a) => {
      const parts = [`名称:${a.name}`, `类别:${ASSET_TYPE_LABEL[a.type]}`]
      if (a.platform) parts.push(`平台:${a.platform}`)
      return `- ${parts.join(', ')}`
    })
    .join('\n')
}

async function requestNlTxJson(
  settings: Settings,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const { baseUrl, apiKey, model } = settings.llm

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'system',
        content:
          '你是个人资产管理助手。根据用户的自然语言描述,输出一条交易记录的 JSON 草稿。' +
          '只输出一个 JSON 对象,不要 markdown、不要解释。' +
          '中文金额单位要换算为数字(如 2万→20000,1.5万→15000,三百→300)。' +
          '「今天」「昨日」等相对日期要换算为具体 YYYY-MM-DD。' +
          '存入本金用 DEPOSIT,取出用 WITHDRAW,利息分红到账用 INCOME,更新总市值用 VALUATION,' +
          '买入用 BUY,卖出用 SELL,借入用 BORROW,还款用 REPAY。' +
          'VALUATION 必须把金额写在 value(总市值),禁止写 amount。' +
          `今日日期:${today()}。` +
          `JSON 结构:\n${JSON_SCHEMA_DESC}`,
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    stream: false,
    response_format: { type: 'json_object' },
  }

  let res = await postChatCompletions(baseUrl, apiKey, body, signal)

  if (!res.ok) {
    const errText = await res.text()
    // 部分本地模型不支持 response_format,去掉后重试
    if (errText.includes('response_format') || res.status === 400) {
      delete body.response_format
      res = await postChatCompletions(baseUrl, apiKey, body, signal)
    } else {
      throw new Error(`LLM 接口请求失败 (${res.status}): ${errText.slice(0, 200)}`)
    }
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM 接口请求失败 (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  const err = data.error?.message
  if (err) throw new Error(err)

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('LLM 返回内容为空')
  return content
}

/**
 * 自然语言 → 交易草稿。
 * 发送:用户原文 + (可选)资产名称列表。仅在用户主动触发时调用。
 */
export async function parseNaturalLanguageTx(
  input: string,
  assets: Asset[],
  settings: Settings,
  signal?: AbortSignal,
): Promise<NlTxParseResult> {
  const text = input.trim()
  if (!text) throw new Error('请输入要记录的内容')

  assertApiReady(settings)

  const includeNames = settings.llmSendAssetNames !== false
  const catalog = buildAssetCatalog(assets, includeNames)

  const userPrompt = [
    `用户描述:「${text}」`,
    '',
    '已知资产列表:',
    catalog,
    '',
    '请解析为一条交易 JSON。',
  ].join('\n')

  const rawContent = await requestNlTxJson(settings, userPrompt, signal)
  let parsed: unknown
  try {
    parsed = extractJsonObject(rawContent)
  } catch {
    throw new Error('AI 返回格式有误,请改用手动填写或换个说法重试')
  }

  const draft = validateNlTxDraft(parsed)
  const assetId = matchAssetByHint(draft.assetHint, assets)

  const warnings: string[] = []
  if (draft.assetHint && !assetId) {
    warnings.push(`未能自动匹配资产「${draft.assetHint}」,请在确认表单中手动选择`)
  }

  return { draft, assetId, warnings }
}

/** 将 NL 解析结果转为 TxForm 可用的 initial */
export function nlResultToTxInitial(
  result: NlTxParseResult,
  assets: Asset[],
  fixedAssetId?: string,
): Transaction {
  const active = assets.filter((a) => !a.archived)
  const { draft, assetId } = result
  return {
    id: '',
    assetId: fixedAssetId ?? assetId ?? active[0]?.id ?? '',
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
