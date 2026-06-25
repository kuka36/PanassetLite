import type { AssetType, TxType } from '../types'

const ASSET_TYPES = new Set<AssetType>([
  'cash',
  'wealth',
  'stock',
  'fund',
  'crypto',
  'property',
  'debt',
  'other',
])

const TX_TYPES = new Set<TxType>([
  'BUY',
  'SELL',
  'DEPOSIT',
  'WITHDRAW',
  'INCOME',
  'VALUATION',
  'BORROW',
  'REPAY',
])

const APP_PAGES = new Set(['dashboard', 'assets', 'strategies', 'flows', 'settings'])

export type SchemaValidationResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; errors: string[] }

function err(errors: string[]): SchemaValidationResult {
  return { ok: false, errors }
}

function ok(args: Record<string, unknown>): SchemaValidationResult {
  return { ok: true, args }
}

function rejectUnknownKeys(args: Record<string, unknown>, allowed: Set<string>): string[] {
  const errors: string[] = []
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) errors.push(`未知参数: ${key}`)
  }
  return errors
}

function requireString(
  args: Record<string, unknown>,
  key: string,
  label = key,
): { value?: string; errors: string[] } {
  const v = args[key]
  if (v === undefined || v === null) return { errors: [] }
  if (typeof v !== 'string') return { errors: [`${label} 须为字符串`] }
  const trimmed = v.trim()
  if (!trimmed) return { errors: [`${label} 不能为空`] }
  return { value: trimmed, errors: [] }
}

function optionalString(args: Record<string, unknown>, key: string, label = key): string[] {
  const v = args[key]
  if (v === undefined || v === null) return []
  if (typeof v !== 'string') return [`${label} 须为字符串`]
  return []
}

function optionalNumber(args: Record<string, unknown>, key: string, label = key): string[] {
  const v = args[key]
  if (v === undefined || v === null) return []
  if (typeof v !== 'number' || !Number.isFinite(v)) return [`${label} 须为有效数字`]
  return []
}

function optionalBoolean(args: Record<string, unknown>, key: string): string[] {
  const v = args[key]
  if (v === undefined || v === null) return []
  if (typeof v !== 'boolean') return [`${key} 须为布尔值`]
  return []
}

/** 运行时校验 LLM 工具参数,与 ASSISTANT_TOOL_DEFINITIONS 对齐 */
export function validateToolArgs(
  toolName: string,
  raw: Record<string, unknown>,
): SchemaValidationResult {
  switch (toolName) {
    case 'get_portfolio_summary':
    case 'analyze_portfolio':
    case 'refresh_prices':
    case 'open_settings':
      return rejectUnknownKeys(raw, new Set()).length
        ? err(rejectUnknownKeys(raw, new Set()))
        : ok({})

    case 'list_assets': {
      const keyErrors = rejectUnknownKeys(raw, new Set(['includeArchived']))
      const typeErrors = optionalBoolean(raw, 'includeArchived')
      const errors = [...keyErrors, ...typeErrors]
      if (errors.length) return err(errors)
      return ok({ includeArchived: raw.includeArchived === true })
    }

    case 'list_flows': {
      const keyErrors = rejectUnknownKeys(raw, new Set(['limit', 'assetId']))
      const errors = [...keyErrors, ...optionalString(raw, 'assetId', 'assetId')]
      if (raw.limit !== undefined && raw.limit !== null) {
        if (typeof raw.limit !== 'number' || !Number.isFinite(raw.limit) || raw.limit < 1) {
          errors.push('limit 须为大于 0 的数字')
        } else if (raw.limit > 100) {
          errors.push('limit 最大为 100')
        }
      }
      if (errors.length) return err(errors)
      const out: Record<string, unknown> = {}
      if (typeof raw.limit === 'number') out.limit = Math.floor(raw.limit)
      if (typeof raw.assetId === 'string' && raw.assetId.trim()) out.assetId = raw.assetId.trim()
      return ok(out)
    }

    case 'navigate': {
      const keyErrors = rejectUnknownKeys(raw, new Set(['page']))
      const page = requireString(raw, 'page', 'page')
      const errors = [...keyErrors, ...page.errors]
      if (!page.value) errors.push('缺少 page')
      else if (!APP_PAGES.has(page.value)) errors.push(`无效页面: ${page.value}`)
      if (errors.length) return err(errors)
      return ok({ page: page.value })
    }

    case 'propose_add_asset': {
      const allowed = new Set([
        'name',
        'type',
        'currency',
        'platform',
        'symbol',
        'note',
      ])
      const keyErrors = rejectUnknownKeys(raw, allowed)
      const name = requireString(raw, 'name', 'name')
      const errors = [
        ...keyErrors,
        ...name.errors,
        ...optionalString(raw, 'currency'),
        ...optionalString(raw, 'platform'),
        ...optionalString(raw, 'symbol'),
        ...optionalString(raw, 'note'),
      ]
      if (!name.value) errors.push('缺少 name')
      if (raw.type !== undefined && raw.type !== null) {
        if (typeof raw.type !== 'string' || !ASSET_TYPES.has(raw.type as AssetType)) {
          errors.push(`无效资产类别 type,可选: ${[...ASSET_TYPES].join(', ')}`)
        }
      }
      if (errors.length) return err(errors)
      const out: Record<string, unknown> = { name: name.value }
      if (typeof raw.type === 'string') out.type = raw.type
      for (const k of ['currency', 'platform', 'symbol', 'note'] as const) {
        if (typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k].trim()
      }
      return ok(out)
    }

    case 'propose_edit_asset': {
      const allowed = new Set(['assetId', 'name', 'type', 'platform', 'note'])
      const keyErrors = rejectUnknownKeys(raw, allowed)
      const assetId = requireString(raw, 'assetId', 'assetId')
      const errors = [
        ...keyErrors,
        ...assetId.errors,
        ...optionalString(raw, 'name'),
        ...optionalString(raw, 'platform'),
        ...optionalString(raw, 'note'),
      ]
      if (!assetId.value) errors.push('缺少 assetId')
      if (raw.type !== undefined && raw.type !== null) {
        if (typeof raw.type !== 'string' || !ASSET_TYPES.has(raw.type as AssetType)) {
          errors.push(`无效资产类别 type`)
        }
      }
      if (errors.length) return err(errors)
      return ok({ assetId: assetId.value })
    }

    case 'propose_add_flow': {
      const allowed = new Set([
        'naturalLanguage',
        'assetId',
        'type',
        'date',
        'amount',
        'quantity',
        'price',
        'value',
        'note',
      ])
      const keyErrors = rejectUnknownKeys(raw, allowed)
      const errors = [
        ...keyErrors,
        ...optionalString(raw, 'naturalLanguage'),
        ...optionalString(raw, 'assetId'),
        ...optionalString(raw, 'date'),
        ...optionalString(raw, 'note'),
        ...optionalNumber(raw, 'amount'),
        ...optionalNumber(raw, 'quantity'),
        ...optionalNumber(raw, 'price'),
        ...optionalNumber(raw, 'value'),
      ]
      if (raw.type !== undefined && raw.type !== null) {
        if (typeof raw.type !== 'string' || !TX_TYPES.has(raw.type as TxType)) {
          errors.push(`无效流水类型 type,可选: ${[...TX_TYPES].join(', ')}`)
        }
      }
      if (raw.date !== undefined && typeof raw.date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
        errors.push('date 格式须为 YYYY-MM-DD')
      }
      const hasNl = typeof raw.naturalLanguage === 'string' && raw.naturalLanguage.trim()
      const hasStructured = raw.type !== undefined
      if (!hasNl && !hasStructured) errors.push('请提供 naturalLanguage 或 type 等结构化字段')
      if (errors.length) return err(errors)
      const out: Record<string, unknown> = {}
      for (const k of allowed) {
        if (raw[k] !== undefined && raw[k] !== null) out[k] = raw[k]
      }
      return ok(out)
    }

    case 'propose_edit_flow': {
      const keyErrors = rejectUnknownKeys(raw, new Set(['txId']))
      const txId = requireString(raw, 'txId', 'txId')
      const errors = [...keyErrors, ...txId.errors]
      if (!txId.value) errors.push('缺少 txId')
      if (errors.length) return err(errors)
      return ok({ txId: txId.value })
    }

    case 'propose_delete_asset': {
      const keyErrors = rejectUnknownKeys(raw, new Set(['assetId']))
      const assetId = requireString(raw, 'assetId', 'assetId')
      const errors = [...keyErrors, ...assetId.errors]
      if (!assetId.value) errors.push('缺少 assetId')
      if (errors.length) return err(errors)
      return ok({ assetId: assetId.value })
    }

    case 'propose_delete_flow': {
      const keyErrors = rejectUnknownKeys(raw, new Set(['txId']))
      const txId = requireString(raw, 'txId', 'txId')
      const errors = [...keyErrors, ...txId.errors]
      if (!txId.value) errors.push('缺少 txId')
      if (errors.length) return err(errors)
      return ok({ txId: txId.value })
    }

    default:
      return err([`未知工具: ${toolName}`])
  }
}
