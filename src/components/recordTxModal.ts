import type { NlTxParseResult } from '../services/nlTx'
import type { Asset, TxType } from '../types'

type RecordTxContext = {
  asset?: Asset
  /** 打开弹窗时预设的事件类型，模式切换间保持 */
  defaultType?: TxType
  returnAssetId?: string
}

export type RecordTxModalState =
  | ({ kind: 'tx' } & RecordTxContext)
  | ({ kind: 'nlTx' } & RecordTxContext)
  | ({ kind: 'nlConfirm'; result: NlTxParseResult; rawInput: string } & RecordTxContext)

const RECORD_TX_KINDS = new Set(['tx', 'nlTx', 'nlConfirm'])

export function isRecordTxModal(modal: unknown): modal is RecordTxModalState {
  return (
    typeof modal === 'object' &&
    modal !== null &&
    'kind' in modal &&
    RECORD_TX_KINDS.has(String((modal as { kind: string }).kind))
  )
}

/** 打开记一笔弹窗（默认手动填写） */
export function openRecordTx(opts?: {
  asset?: Asset
  defaultType?: TxType
  returnAssetId?: string
}): Extract<RecordTxModalState, { kind: 'tx' }> {
  return { kind: 'tx', ...opts }
}
