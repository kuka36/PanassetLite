import type { Asset, Transaction } from '../types'

export type AppPageId = 'dashboard' | 'assets' | 'transactions' | 'settings'

export type PendingAction =
  | { kind: 'addAsset'; initial?: Partial<Omit<Asset, 'id' | 'createdAt'>> }
  | { kind: 'editAsset'; assetId: string }
  | { kind: 'addTx'; initial: Omit<Transaction, 'id' | 'createdAt'>; fixedAssetId?: string; rawInput?: string; warnings?: string[] }
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
