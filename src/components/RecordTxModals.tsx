import { Sparkles, PenLine } from 'lucide-react'
import Modal from './Modal'
import TxForm from './TxForm'
import NlTxInput from './NlTxInput'
import { nlResultToTxInitial } from '../services/nlTx'
import type { Asset, Settings, Transaction } from '../types'
import { color } from '../theme/colors'
import type { RecordTxModalState } from './recordTxModal'

function recordTxTitle(modal: RecordTxModalState): string {
  if (modal.kind === 'nlConfirm') {
    return modal.asset ? `${modal.asset.name} · 确认解析结果` : '确认 AI 解析结果'
  }
  return modal.asset ? `${modal.asset.name} · 记一笔` : '记一笔'
}

function RecordTxModeTabs({
  mode,
  onModeChange,
}: {
  mode: 'manual' | 'ai'
  onModeChange: (mode: 'manual' | 'ai') => void
}) {
  const tabCls = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`

  return (
    <div
      className="mb-4 flex rounded-xl border border-slate-200 bg-slate-50 p-1"
      role="tablist"
      aria-label="记一笔方式"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'manual'}
        className={tabCls(mode === 'manual')}
        onClick={() => onModeChange('manual')}
      >
        <PenLine className="h-4 w-4" aria-hidden />
        手动填写
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'ai'}
        className={tabCls(mode === 'ai')}
        onClick={() => onModeChange('ai')}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        AI 解析
      </button>
    </div>
  )
}

interface Props {
  modal: RecordTxModalState
  assets: Asset[]
  settings: Settings
  onClose: () => void
  onChange: (modal: RecordTxModalState) => void
  onSubmit: (t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
}

export function RecordTxModals({ modal, assets, settings, onClose, onChange, onSubmit }: Props) {
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
        <RecordTxModeTabs mode={mode} onModeChange={(next) => switchRecordMode(next, modal)} />
        {mode === 'manual' ? (
          <TxForm
            assets={assets}
            fixedAssetId={asset?.id}
            defaultType={defaultType}
            onSubmit={(t) => {
              onSubmit(t)
              onClose()
            }}
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
