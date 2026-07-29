import { Sparkles, PenLine } from 'lucide-react'
import Modal from './Modal'
import TxForm from './TxForm'
import NlTxInput from './NlTxInput'
import SegmentedTabs from './ui/SegmentedTabs'
import { nlResultToTxInitial } from '../services/nlTx'
import type { Asset, Settings, Transaction } from '../types'
import { color } from '../theme/colors'
import type { RecordTxModalState } from './recordTxModal'
import type { TransferSubmit } from './TxForm'

function recordTxTitle(modal: RecordTxModalState): string {
  if (modal.kind === 'nlConfirm') {
    return modal.asset ? `${modal.asset.name} · 确认解析结果` : '确认 AI 解析结果'
  }
  return modal.asset ? `${modal.asset.name} · 记一笔` : '记一笔'
}

interface Props {
  modal: RecordTxModalState
  assets: Asset[]
  settings: Settings
  onClose: () => void
  onChange: (modal: RecordTxModalState) => void
  onSubmit: (t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  onTransferSubmit?: (t: TransferSubmit) => void
}

export function RecordTxModals({
  modal,
  assets,
  settings,
  onClose,
  onChange,
  onSubmit,
  onTransferSubmit,
}: Props) {
  const { asset, defaultType, returnAssetId } = modal

  const switchRecordMode = (
    next: 'manual' | 'ai',
    current: Extract<RecordTxModalState, { kind: 'tx' | 'nlTx' }>,
  ) => {
    const ctx = { asset, defaultType, returnAssetId }
    if (next === 'manual') {
      if (current.kind === 'tx') return
      onChange({ kind: 'tx', ...ctx })
    } else {
      if (current.kind === 'nlTx') return
      onChange({ kind: 'nlTx', ...ctx })
    }
  }

  if (modal.kind === 'tx' || modal.kind === 'nlTx') {
    const mode = modal.kind === 'tx' ? 'manual' : 'ai'
    return (
      <Modal title={recordTxTitle(modal)} onClose={onClose}>
        <SegmentedTabs
          className="mb-4"
          stretch
          value={mode}
          onChange={(next) => switchRecordMode(next, modal)}
          ariaLabel="记一笔方式"
          tabs={[
            {
              id: 'manual',
              label: (
                <>
                  <PenLine className="h-4 w-4" aria-hidden />
                  手动填写
                </>
              ),
            },
            {
              id: 'ai',
              label: (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  AI 解析
                </>
              ),
            },
          ]}
        />
        {mode === 'manual' ? (
          <TxForm
            assets={assets}
            fixedAssetId={asset?.id}
            defaultType={defaultType}
            onSubmit={(t) => {
              onSubmit(t)
              onClose()
            }}
            onTransferSubmit={
              onTransferSubmit
                ? (t) => {
                    onTransferSubmit(t)
                    onClose()
                  }
                : undefined
            }
            onCancel={onClose}
          />
        ) : (
          <NlTxInput
            embedded
            hideManualAction
            assets={assets}
            settings={settings}
            fixedAssetId={asset?.id}
            onParsed={(result, rawInput) =>
              onChange({
                kind: 'nlConfirm',
                asset,
                defaultType,
                result,
                rawInput,
                returnAssetId,
              })
            }
            onManual={() => onChange({ kind: 'tx', asset, defaultType, returnAssetId })}
          />
        )}
      </Modal>
    )
  }

  if (modal.kind === 'nlConfirm') {
    return (
      <Modal title={recordTxTitle(modal)} onClose={onClose}>
        <p className="mb-3 text-xs text-slate-500">
          原文:「{modal.rawInput}」{!asset && ' — 请核对字段后确认'}
        </p>
        {modal.result.warnings.map((w) => (
          <p key={w} className={`mb-2 ${color.alertWarn}`}>
            {w}
          </p>
        ))}
        <TxForm
          assets={assets}
          fixedAssetId={asset?.id}
          initial={nlResultToTxInitial(modal.result, assets, asset?.id)}
          onSubmit={(t) => {
            onSubmit(t)
            onClose()
          }}
          onCancel={onClose}
        />
      </Modal>
    )
  }

  return null
}
