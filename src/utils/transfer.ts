import type { Asset, Transaction } from '../types'

export interface TransferSubmit {
  fromAssetId: string
  toAssetId: string
  amount: number
  occurredAt: number
  note?: string
}

/** 将转账表单拆成取出 + 存入两条流水（备注留空时自动标注对方资产） */
export function transferToTransactions(
  t: TransferSubmit,
  assets: Asset[],
): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] {
  const from = assets.find((a) => a.id === t.fromAssetId)
  const to = assets.find((a) => a.id === t.toAssetId)
  const fromName = from?.name ?? '未知资产'
  const toName = to?.name ?? '未知资产'
  const userNote = t.note?.trim()
  return [
    {
      assetId: t.fromAssetId,
      type: 'WITHDRAW',
      amount: t.amount,
      occurredAt: t.occurredAt,
      note: userNote || `转至「${toName}」`,
    },
    {
      assetId: t.toAssetId,
      type: 'DEPOSIT',
      amount: t.amount,
      occurredAt: t.occurredAt,
      note: userNote || `来自「${fromName}」`,
    },
  ]
}
