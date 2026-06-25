import type { Asset, PortfolioSummary, Settings, Transaction } from '../types'
import { ASSET_TYPE_LABEL, TX_TYPE_LABEL } from '../types'
import type { AppPageId, PendingAction, ToolExecutionResult } from '../types/assistant'
import { analyzePortfolio } from './ai'
import { parseNaturalLanguageTx } from './nlTx'
import { nlResultToTxInitial } from '../services/nlTx'
import { fmtDateTime } from '../utils/format'
import { migrateDateToOccurredAt } from '../utils/time'
import { appendAuditEntry } from './assistantAudit'
import { validateToolArgs } from './assistantToolSchema'

export interface AssistantToolContext {
  assets: Asset[]
  transactions: Transaction[]
  settings: Settings
  summary: PortfolioSummary
  navigate: (page: AppPageId) => void
  refreshPrices: () => Promise<string>
}

export const ASSISTANT_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_portfolio_summary',
      description: '获取当前投资组合摘要:净资产、总资产、负债、分类占比、主要持仓',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_portfolio',
      description: '本地规则引擎分析投资组合健康评分与风险洞察,无需 LLM',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_assets',
      description: '列出所有资产(id、名称、类别、平台、市值)',
      parameters: {
        type: 'object',
        properties: {
          includeArchived: { type: 'boolean', description: '是否包含已归档资产' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_transactions',
      description: '列出最近交易记录',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '返回条数,默认 20' },
          assetId: { type: 'string', description: '按资产 id 筛选' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'navigate',
      description: '切换到应用页面',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: ['dashboard', 'assets', 'strategies', 'transactions', 'settings'],
          },
        },
        required: ['page'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'refresh_prices',
      description: '刷新汇率、加密货币和股票行情',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'open_settings',
      description: '打开设置页,用于导入导出、LLM 配置等需手动操作的场景',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_add_asset',
      description: '提议添加新资产,将打开确认表单供用户审核后写入',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['cash', 'wealth', 'stock', 'fund', 'crypto', 'property', 'debt', 'other'],
          },
          currency: { type: 'string' },
          platform: { type: 'string' },
          symbol: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_edit_asset',
      description: '提议编辑已有资产,将打开确认表单',
      parameters: {
        type: 'object',
        properties: {
          assetId: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          platform: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['assetId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_add_transaction',
      description:
        '提议添加一笔流水。可用 naturalLanguage 自然语言描述,或结构化字段。将打开 TxForm 确认表单',
      parameters: {
        type: 'object',
        properties: {
          naturalLanguage: { type: 'string', description: '自然语言描述,如「昨天支付宝理财存入5000」' },
          assetId: { type: 'string' },
          type: {
            type: 'string',
            enum: ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAW', 'INCOME', 'VALUATION', 'BORROW', 'REPAY'],
          },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          amount: { type: 'number' },
          quantity: { type: 'number' },
          price: { type: 'number' },
          value: { type: 'number' },
          note: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_edit_transaction',
      description: '提议编辑已有流水,将打开 TxForm 确认表单',
      parameters: {
        type: 'object',
        properties: { txId: { type: 'string' } },
        required: ['txId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_delete_asset',
      description: '提议删除资产及其全部流水,需在对话中二次确认',
      parameters: {
        type: 'object',
        properties: { assetId: { type: 'string' } },
        required: ['assetId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_delete_transaction',
      description: '提议删除一条流水,需在对话中二次确认',
      parameters: {
        type: 'object',
        properties: { txId: { type: 'string' } },
        required: ['txId'],
        additionalProperties: false,
      },
    },
  },
]

const WRITE_TOOLS = new Set([
  'propose_add_asset',
  'propose_edit_asset',
  'propose_add_transaction',
  'propose_edit_transaction',
  'propose_delete_asset',
  'propose_delete_transaction',
])

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name)
}

function findAsset(ctx: AssistantToolContext, id: string): Asset | undefined {
  return ctx.assets.find((a) => a.id === id)
}

function findTx(ctx: AssistantToolContext, id: string): Transaction | undefined {
  return ctx.transactions.find((t) => t.id === id)
}

function snapshotValue(ctx: AssistantToolContext, assetId: string): number {
  return ctx.summary.snapshots.find((s) => s.asset.id === assetId)?.valueCNY ?? 0
}

export async function executeAssistantTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  const validated = validateToolArgs(name, args)
  if (!validated.ok) {
    appendAuditEntry({
      kind: 'tool_validation_error',
      toolName: name,
      summary: `参数校验失败: ${name}`,
      detail: validated.errors.join('; '),
    })
    return {
      content: JSON.stringify({ error: '参数校验失败', details: validated.errors }),
    }
  }
  const safeArgs = validated.args

  appendAuditEntry({
    kind: 'tool_call',
    toolName: name,
    summary: `调用工具 ${name}`,
    detail: JSON.stringify(safeArgs).slice(0, 500),
  })

  switch (name) {
    case 'get_portfolio_summary': {
      const { summary } = ctx
      const top = summary.snapshots
        .filter((s) => s.valueCNY > 0)
        .slice(0, 8)
        .map((s) => ({
          id: s.asset.id,
          name: s.asset.name,
          type: ASSET_TYPE_LABEL[s.asset.type],
          valueCNY: Math.round(s.valueCNY),
        }))
      return {
        content: JSON.stringify({
          netWorthCNY: Math.round(summary.netWorthCNY),
          totalAssetsCNY: Math.round(summary.totalAssetsCNY),
          totalDebtCNY: Math.round(summary.totalDebtCNY),
          totalPnlCNY: Math.round(summary.totalPnlCNY),
          byType: summary.byType.map((t) => ({
            type: ASSET_TYPE_LABEL[t.type],
            valueCNY: Math.round(t.valueCNY),
          })),
          topHoldings: top,
        }),
      }
    }

    case 'analyze_portfolio': {
      const report = analyzePortfolio(ctx.summary)
      return {
        content: JSON.stringify({
          score: report.score,
          grade: report.grade,
          insights: report.insights.map((i) => ({
            level: i.level,
            title: i.title,
            detail: i.detail,
          })),
        }),
      }
    }

    case 'list_assets': {
      const includeArchived = safeArgs.includeArchived === true
      const list = ctx.assets
        .filter((a) => includeArchived || !a.archived)
        .map((a) => ({
          id: a.id,
          name: a.name,
          type: ASSET_TYPE_LABEL[a.type],
          platform: a.platform,
          currency: a.currency,
          valueCNY: Math.round(snapshotValue(ctx, a.id)),
          archived: !!a.archived,
        }))
      return { content: JSON.stringify({ assets: list }) }
    }

    case 'list_transactions': {
      const limit = typeof safeArgs.limit === 'number' ? safeArgs.limit : 20
      const assetId = typeof safeArgs.assetId === 'string' ? safeArgs.assetId : undefined
      let txs = [...ctx.transactions].sort((a, b) => b.occurredAt - a.occurredAt)
      if (assetId) txs = txs.filter((t) => t.assetId === assetId)
      const list = txs.slice(0, limit).map((t) => {
        const asset = findAsset(ctx, t.assetId)
        return {
          id: t.id,
          occurredAt: t.occurredAt,
          type: TX_TYPE_LABEL[t.type],
          assetName: asset?.name,
          assetId: t.assetId,
          amount: t.amount,
          quantity: t.quantity,
          price: t.price,
          value: t.value,
          note: t.note,
        }
      })
      return { content: JSON.stringify({ transactions: list }) }
    }

    case 'navigate': {
      const page = safeArgs.page as AppPageId
      if (!['dashboard', 'assets', 'strategies', 'transactions', 'settings'].includes(page)) {
        return { content: JSON.stringify({ error: '无效页面' }) }
      }
      ctx.navigate(page)
      return { content: JSON.stringify({ ok: true, page }) }
    }

    case 'refresh_prices': {
      const result = await ctx.refreshPrices()
      return { content: JSON.stringify({ ok: true, message: result }) }
    }

    case 'open_settings': {
      ctx.navigate('settings')
      return {
        content: JSON.stringify({
          ok: true,
          message: '已打开设置页。导入/导出、LLM 配置等请在此手动操作。',
        }),
      }
    }

    case 'propose_add_asset': {
      const nameArg = String(safeArgs.name ?? '').trim()
      if (!nameArg) return { content: JSON.stringify({ error: '缺少资产名称' }) }
      const assetType = (safeArgs.type as Asset['type']) ?? 'cash'
      const initial: Partial<Omit<Asset, 'id' | 'createdAt'>> = {
        name: nameArg,
        type: assetType,
        currency: (safeArgs.currency as string) ?? 'CNY',
        platform: typeof safeArgs.platform === 'string' ? safeArgs.platform : undefined,
        symbol: typeof safeArgs.symbol === 'string' ? safeArgs.symbol : undefined,
        note: typeof safeArgs.note === 'string' ? safeArgs.note : undefined,
        priceSource: 'manual',
      }
      const action: PendingAction = { kind: 'addAsset', initial }
      return {
        content: JSON.stringify({ status: 'pending_confirmation', kind: 'addAsset', name: nameArg }),
        pendingAction: action,
        pendingSummary: `添加资产「${nameArg}」`,
      }
    }

    case 'propose_edit_asset': {
      const assetId = String(safeArgs.assetId ?? '')
      const asset = findAsset(ctx, assetId)
      if (!asset) return { content: JSON.stringify({ error: '未找到资产' }) }
      const action: PendingAction = { kind: 'editAsset', assetId }
      return {
        content: JSON.stringify({ status: 'pending_confirmation', kind: 'editAsset', name: asset.name }),
        pendingAction: action,
        pendingSummary: `编辑资产「${asset.name}」`,
      }
    }

    case 'propose_add_transaction': {
      if (typeof safeArgs.naturalLanguage === 'string' && safeArgs.naturalLanguage.trim()) {
        try {
          const result = await parseNaturalLanguageTx(
            safeArgs.naturalLanguage.trim(),
            ctx.assets,
            ctx.settings,
            signal,
          )
          const fixedAssetId =
            typeof safeArgs.assetId === 'string' ? safeArgs.assetId : result.assetId
          const initial = nlResultToTxInitial(result, ctx.assets, fixedAssetId)
          const action: PendingAction = {
            kind: 'addTx',
            initial,
            fixedAssetId,
            rawInput: safeArgs.naturalLanguage.trim(),
            warnings: result.warnings,
          }
          return {
            content: JSON.stringify({
              status: 'pending_confirmation',
              kind: 'addTx',
              type: result.draft.type,
              date: result.draft.date,
            }),
            pendingAction: action,
            pendingSummary: `记一笔流水(${TX_TYPE_LABEL[result.draft.type]}, ${result.draft.date})`,
          }
        } catch (e) {
          return { content: JSON.stringify({ error: (e as Error).message }) }
        }
      }

      const assetId =
        typeof safeArgs.assetId === 'string'
          ? safeArgs.assetId
          : ctx.assets.find((a) => !a.archived)?.id
      if (!assetId) return { content: JSON.stringify({ error: '没有可用资产,请先添加资产' }) }
      const txType = safeArgs.type as Transaction['type']
      if (!txType) return { content: JSON.stringify({ error: '请提供 type 或 naturalLanguage' }) }

      const initial: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
        assetId,
        type: txType,
        occurredAt:
          typeof safeArgs.date === 'string'
            ? migrateDateToOccurredAt(safeArgs.date)
            : Date.now(),
        amount: typeof safeArgs.amount === 'number' ? safeArgs.amount : undefined,
        quantity: typeof safeArgs.quantity === 'number' ? safeArgs.quantity : undefined,
        price: typeof safeArgs.price === 'number' ? safeArgs.price : undefined,
        value: typeof safeArgs.value === 'number' ? safeArgs.value : undefined,
        note: typeof safeArgs.note === 'string' ? safeArgs.note : undefined,
      }
      const action: PendingAction = {
        kind: 'addTx',
        initial,
        fixedAssetId: assetId,
      }
      return {
        content: JSON.stringify({ status: 'pending_confirmation', kind: 'addTx', type: txType }),
        pendingAction: action,
        pendingSummary: `记一笔流水(${TX_TYPE_LABEL[txType]})`,
      }
    }

    case 'propose_edit_transaction': {
      const txId = String(safeArgs.txId ?? '')
      const tx = findTx(ctx, txId)
      if (!tx) return { content: JSON.stringify({ error: '未找到流水' }) }
      const action: PendingAction = { kind: 'editTx', txId }
      return {
        content: JSON.stringify({ status: 'pending_confirmation', kind: 'editTx', id: txId }),
        pendingAction: action,
        pendingSummary: `编辑流水(${fmtDateTime(tx.occurredAt)}, ${TX_TYPE_LABEL[tx.type]})`,
      }
    }

    case 'propose_delete_asset': {
      const assetId = String(safeArgs.assetId ?? '')
      const asset = findAsset(ctx, assetId)
      if (!asset) return { content: JSON.stringify({ error: '未找到资产' }) }
      const action: PendingAction = { kind: 'deleteAsset', assetId }
      return {
        content: JSON.stringify({
          status: 'pending_delete_confirmation',
          assetId,
          name: asset.name,
        }),
        pendingAction: action,
        pendingSummary: `删除资产「${asset.name}」及其全部流水`,
      }
    }

    case 'propose_delete_transaction': {
      const txId = String(safeArgs.txId ?? '')
      const tx = findTx(ctx, txId)
      if (!tx) return { content: JSON.stringify({ error: '未找到流水' }) }
      const asset = findAsset(ctx, tx.assetId)
      const action: PendingAction = { kind: 'deleteTx', txId }
      return {
        content: JSON.stringify({ status: 'pending_delete_confirmation', txId }),
        pendingAction: action,
        pendingSummary: `删除流水(${fmtDateTime(tx.occurredAt)}, ${asset?.name ?? ''}, ${TX_TYPE_LABEL[tx.type]})`,
      }
    }

    default:
      return { content: JSON.stringify({ error: `未知工具: ${name}` }) }
  }
}
