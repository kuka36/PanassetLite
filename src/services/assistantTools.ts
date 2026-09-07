import type {
  Asset,
  PeriodReturn,
  PortfolioSummary,
  Settings,
  Transaction,
  TxLedgerRow,
} from '../types'
import { ASSET_TYPE_LABEL, TX_TYPE_LABEL } from '../types'
import type { AppPageId, LlmContextPrivacy, PendingAction, ToolExecutionResult } from '../types/assistant'
import { analyzePortfolio } from './ai'
import { parseNaturalLanguageTx } from './nlTx'
import { nlResultToTxInitial } from '../services/nlTx'
import { fmtDateTime, isAssetUpdateReminderStale } from '../utils/format'
import { migrateDateToOccurredAt } from '../utils/time'
import { appendAuditEntry } from './assistantAudit'
import { validateToolArgs } from './assistantToolSchema'
import { refreshPrices } from './priceRefreshActions'

export interface AssistantToolContext {
  assets: Asset[]
  transactions: Transaction[]
  settings: Settings
  summary: PortfolioSummary
  navigate: (page: AppPageId) => void
  /** 按资产取流水账本行(新→旧);资产不存在时返回 null */
  getTxLedger: (assetId: string) => TxLedgerRow[] | null
  /** 组合或单资产区间收益 */
  getPeriodReturns: (assetId?: string) => PeriodReturn[] | null
}

export const ASSISTANT_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_portfolio_summary',
      description:
        '获取当前投资组合摘要:净资产、总资产、负债、盈亏、分类占比、区间收益、主要资产(含 XIRR/近期年化)',
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
      description:
        '列出所有资产:市值、净投入、盈亏、XIRR、近期年化、上次更新、是否估值过期',
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
      name: 'get_asset_detail',
      description:
        '获取单资产详情:市值、投入、盈亏、XIRR、近期年化、上次更新、是否过期及类别占比',
      parameters: {
        type: 'object',
        properties: {
          assetId: { type: 'string', description: '资产 id' },
        },
        required: ['assetId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_period_returns',
      description:
        '获取区间收益(本周/本月/近30天/今年以来/近一年)。可按 assetId 限定单资产,否则为组合整体',
      parameters: {
        type: 'object',
        properties: {
          assetId: { type: 'string', description: '可选,按单资产筛选' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_ledger',
      description:
        '列出某资产的流水账本行(余额/持仓、区间盈亏、区间年化),按时间新→旧',
      parameters: {
        type: 'object',
        properties: {
          assetId: { type: 'string', description: '资产 id' },
          limit: { type: 'number', description: '返回条数,默认 20,最大 50' },
        },
        required: ['assetId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_flows',
      description: '列出最近资产流水',
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
            enum: ['dashboard', 'assets', 'strategies', 'flows', 'settings'],
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
          currency: { type: 'string', description: '计价货币,如 CNY / USD / HKD / EUR / BTC' },
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
      name: 'propose_add_flow',
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
      name: 'propose_edit_flow',
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
      name: 'propose_delete_flow',
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
  'propose_add_flow',
  'propose_edit_flow',
  'propose_delete_asset',
  'propose_delete_flow',
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

function resolvePrivacy(settings: Settings): LlmContextPrivacy {
  return settings.llmContextPrivacy === 'summary' ? 'summary' : 'detailed'
}

function findSnapshot(ctx: AssistantToolContext, assetId: string) {
  return ctx.summary.snapshots.find((s) => s.asset.id === assetId)
}

function roundPct(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate)) return null
  return Math.round(rate * 10000) / 10000
}

function serializeAssetMetrics(
  ctx: AssistantToolContext,
  asset: Asset,
  privacy: LlmContextPrivacy,
) {
  const snap = findSnapshot(ctx, asset.id)
  const valueCNY = Math.round(snap?.valueCNY ?? 0)
  const shareOfAssets =
    ctx.summary.totalAssetsCNY > 0 && asset.type !== 'debt'
      ? valueCNY / ctx.summary.totalAssetsCNY
      : null
  const base = {
    id: asset.id,
    type: ASSET_TYPE_LABEL[asset.type],
    currency: asset.currency,
    valueCNY,
    netInvestedCNY: snap ? Math.round(snap.netInvestedCNY) : 0,
    totalPnlCNY: snap ? Math.round(snap.totalPnlCNY) : 0,
    xirr: roundPct(snap?.xirr),
    recentAnnualized: roundPct(snap?.recentAnnualized),
    lastUpdated: snap?.lastUpdated ?? null,
    stale: snap ? isAssetUpdateReminderStale(snap) : false,
    archived: !!asset.archived,
    shareOfAssets: roundPct(shareOfAssets),
  }
  if (privacy === 'detailed') {
    return {
      ...base,
      name: asset.name,
      platform: asset.platform,
    }
  }
  return base
}

function serializePeriodReturns(returns: PeriodReturn[]) {
  return returns.map((p) => ({
    key: p.key,
    label: p.label,
    pnlCNY: Math.round(p.pnlCNY),
    ratio: roundPct(p.ratio),
    netWorthChangeCNY:
      p.netWorthChangeCNY != null ? Math.round(p.netWorthChangeCNY) : undefined,
    netWorthChangeRatio: roundPct(p.netWorthChangeRatio ?? null),
  }))
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
      const privacy = resolvePrivacy(ctx.settings)
      const top = summary.snapshots
        .filter((s) => s.valueCNY > 0)
        .slice(0, 8)
        .map((s) => {
          const row: Record<string, unknown> = {
            id: s.asset.id,
            type: ASSET_TYPE_LABEL[s.asset.type],
            valueCNY: Math.round(s.valueCNY),
            xirr: roundPct(s.xirr),
            recentAnnualized: roundPct(s.recentAnnualized),
            totalPnlCNY: Math.round(s.totalPnlCNY),
          }
          if (privacy === 'detailed') row.name = s.asset.name
          return row
        })
      return {
        content: JSON.stringify({
          netWorthCNY: Math.round(summary.netWorthCNY),
          totalAssetsCNY: Math.round(summary.totalAssetsCNY),
          totalDebtCNY: Math.round(summary.totalDebtCNY),
          totalPnlCNY: Math.round(summary.totalPnlCNY),
          totalPnlRatio: roundPct(summary.totalPnlRatio),
          byType: summary.byType.map((t) => ({
            type: ASSET_TYPE_LABEL[t.type],
            valueCNY: Math.round(t.valueCNY),
          })),
          periodReturns: serializePeriodReturns(summary.periodReturns),
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
      const privacy = resolvePrivacy(ctx.settings)
      const list = ctx.assets
        .filter((a) => includeArchived || !a.archived)
        .map((a) => serializeAssetMetrics(ctx, a, privacy))
      return { content: JSON.stringify({ assets: list }) }
    }

    case 'get_asset_detail': {
      const assetId = String(safeArgs.assetId ?? '')
      const asset = findAsset(ctx, assetId)
      if (!asset) return { content: JSON.stringify({ error: '未找到资产' }) }
      const privacy = resolvePrivacy(ctx.settings)
      return {
        content: JSON.stringify(serializeAssetMetrics(ctx, asset, privacy)),
      }
    }

    case 'get_period_returns': {
      const assetId = typeof safeArgs.assetId === 'string' ? safeArgs.assetId : undefined
      if (assetId) {
        const asset = findAsset(ctx, assetId)
        if (!asset) return { content: JSON.stringify({ error: '未找到资产' }) }
        const returns = ctx.getPeriodReturns(assetId)
        if (!returns) return { content: JSON.stringify({ error: '无法计算该资产区间收益' }) }
        const privacy = resolvePrivacy(ctx.settings)
        return {
          content: JSON.stringify({
            scope: 'asset',
            asset: serializeAssetMetrics(ctx, asset, privacy),
            periodReturns: serializePeriodReturns(returns),
          }),
        }
      }
      return {
        content: JSON.stringify({
          scope: 'portfolio',
          periodReturns: serializePeriodReturns(ctx.summary.periodReturns),
        }),
      }
    }

    case 'list_ledger': {
      const assetId = String(safeArgs.assetId ?? '')
      const asset = findAsset(ctx, assetId)
      if (!asset) return { content: JSON.stringify({ error: '未找到资产' }) }
      const ledger = ctx.getTxLedger(assetId)
      if (!ledger) return { content: JSON.stringify({ error: '未找到账本' }) }
      const limit = typeof safeArgs.limit === 'number' ? safeArgs.limit : 20
      const privacy = resolvePrivacy(ctx.settings)
      const rows = ledger.slice(0, limit).map((row) => {
        const base: Record<string, unknown> = {
          txId: row.tx.id,
          occurredAt: row.tx.occurredAt,
          type: TX_TYPE_LABEL[row.tx.type],
          amountNative: row.amountNative,
          balanceAfter: row.balanceAfter,
          balanceLabel: row.balanceLabel,
          intervalGainNative: row.intervalGainNative ?? null,
          intervalAnnualized: roundPct(row.intervalAnnualized),
        }
        if (privacy === 'detailed' && row.tx.note) base.note = row.tx.note
        return base
      })
      return {
        content: JSON.stringify({
          assetId,
          ...(privacy === 'detailed' ? { assetName: asset.name } : {}),
          currency: asset.currency,
          rows,
        }),
      }
    }

    case 'list_flows': {
      const limit = typeof safeArgs.limit === 'number' ? safeArgs.limit : 20
      const assetId = typeof safeArgs.assetId === 'string' ? safeArgs.assetId : undefined
      const privacy = resolvePrivacy(ctx.settings)
      let txs = [...ctx.transactions].sort((a, b) => b.occurredAt - a.occurredAt)
      if (assetId) txs = txs.filter((t) => t.assetId === assetId)
      const list = txs.slice(0, limit).map((t) => {
        const asset = findAsset(ctx, t.assetId)
        const row: Record<string, unknown> = {
          id: t.id,
          occurredAt: t.occurredAt,
          type: TX_TYPE_LABEL[t.type],
          assetId: t.assetId,
          amount: t.amount,
          quantity: t.quantity,
          price: t.price,
          value: t.value,
        }
        if (privacy === 'detailed') {
          row.assetName = asset?.name
          row.note = t.note
        }
        return row
      })
      return { content: JSON.stringify({ flows: list }) }
    }

    case 'navigate': {
      const page = safeArgs.page as AppPageId
      if (!['dashboard', 'assets', 'strategies', 'flows', 'settings'].includes(page)) {
        return { content: JSON.stringify({ error: '无效页面' }) }
      }
      ctx.navigate(page)
      return { content: JSON.stringify({ ok: true, page }) }
    }

    case 'refresh_prices': {
      const result = await refreshPrices()
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
        priceSource: assetType === 'crypto' ? 'coingecko' : 'manual',
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

    case 'propose_add_flow': {
      if (typeof safeArgs.naturalLanguage === 'string' && safeArgs.naturalLanguage.trim()) {
        try {
          const result = await parseNaturalLanguageTx(
            safeArgs.naturalLanguage.trim(),
            ctx.assets,
            ctx.settings,
            {
              fixedAssetId: typeof safeArgs.assetId === 'string' ? safeArgs.assetId : undefined,
              signal,
            },
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

    case 'propose_edit_flow': {
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

    case 'propose_delete_flow': {
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
