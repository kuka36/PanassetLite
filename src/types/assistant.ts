import type { Asset, Transaction } from '../types'

export type AppPageId = 'dashboard' | 'assets' | 'strategies' | 'transactions' | 'settings'

export type PendingAction =
  | { kind: 'addAsset'; initial?: Partial<Omit<Asset, 'id' | 'createdAt'>> }
  | { kind: 'editAsset'; assetId: string }
  | { kind: 'addTx'; initial: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>; fixedAssetId?: string; rawInput?: string; warnings?: string[] }
  | { kind: 'editTx'; txId: string }
  | { kind: 'deleteAsset'; assetId: string }
  | { kind: 'deleteTx'; txId: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** 需表单确认的写操作 */
  pendingAction?: PendingAction
  pendingSummary?: string
  timestamp: number
}

export interface ToolExecutionResult {
  /** 返回给 LLM 的 JSON 字符串内容 */
  content: string
  pendingAction?: PendingAction
  pendingSummary?: string
}

/** LLM 上下文隐私:仅汇总数字 vs 含持仓明细(资产名、盈亏等) */
export type LlmContextPrivacy = 'summary' | 'detailed'

export type AuditEventKind =
  | 'tool_call'
  | 'tool_validation_error'
  | 'action_queued'
  | 'action_confirmed'
  | 'action_cancelled'

export interface AuditLogEntry {
  id: string
  timestamp: number
  kind: AuditEventKind
  toolName?: string
  summary: string
  detail?: string
}

export type QueuedActionStatus = 'pending' | 'active' | 'done' | 'cancelled'

export interface QueuedAction {
  id: string
  action: PendingAction
  summary: string
  messageId?: string
  status: QueuedActionStatus
  createdAt: number
}
