import type { Asset } from '../types'
import type { PendingAction } from '../types/assistant'
import { useStore } from '../store'
import { useAssistantStore } from '../assistantStore'
import Modal, { btnPrimary } from './Modal'
import AssetForm from './AssetForm'
import TxForm from './TxForm'
import { color } from '../theme/colors'

function draftToAssetInitial(draft?: Partial<Omit<Asset, 'id' | 'createdAt'>>): Asset | undefined {
  if (!draft || Object.keys(draft).length === 0) return undefined
  return {
    id: '',
    name: draft.name ?? '',
    type: draft.type ?? 'cash',
    currency: draft.currency ?? 'CNY',
    priceSource: draft.priceSource ?? 'manual',
    platform: draft.platform,
    symbol: draft.symbol,
    note: draft.note,
    archived: draft.archived,
    createdAt: 0,
  }
}

function modalTitle(action: PendingAction, assets: Asset[]): string {
  switch (action.kind) {
    case 'addAsset':
      return '添加资产'
    case 'editAsset': {
      const a = assets.find((x) => x.id === action.assetId)
      return a ? `编辑资产 · ${a.name}` : '编辑资产'
    }
    case 'addTx': {
      const a = assets.find((x) => x.id === (action.fixedAssetId ?? action.initial.assetId))
      return a ? `${a.name} · 确认流水` : '确认 AI 解析结果'
    }
    case 'editTx':
      return '编辑交易'
    default:
      return '确认'
  }
}

interface Props {
  onSuccess?: (message: string) => void
}

export default function AssistantConfirmModals({ onSuccess }: Props) {
  const pendingAction = useAssistantStore((s) => s.pendingAction)
  const setPendingAction = useAssistantStore((s) => s.setPendingAction)

  const assets = useStore((s) => s.assets)
  const transactions = useStore((s) => s.transactions)
  const addAsset = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)

  if (!pendingAction) return null

  const close = () => setPendingAction(null)

  const notify = (msg: string) => {
    close()
    onSuccess?.(msg)
  }

  if (pendingAction.kind === 'addAsset') {
    return (
      <Modal title={modalTitle(pendingAction, assets)} onClose={close}>
        <AssetForm
          initial={draftToAssetInitial(pendingAction.initial)}
          onSubmit={(a) => {
            addAsset(a)
            notify(`已添加资产「${a.name}」`)
          }}
          onCancel={close}
        />
      </Modal>
    )
  }

  if (pendingAction.kind === 'editAsset') {
    const asset = assets.find((a) => a.id === pendingAction.assetId)
    if (!asset) return null
    return (
      <Modal title={modalTitle(pendingAction, assets)} onClose={close}>
        <AssetForm
          initial={asset}
          onSubmit={(a) => {
            updateAsset(asset.id, a)
            notify(`已更新资产「${a.name}」`)
          }}
          onCancel={close}
        />
      </Modal>
    )
  }

  if (pendingAction.kind === 'addTx') {
    return (
      <Modal title={modalTitle(pendingAction, assets)} onClose={close}>
        {pendingAction.rawInput && (
          <p className="mb-3 text-xs text-slate-500">原文:「{pendingAction.rawInput}」— 请核对字段后记录</p>
        )}
        {pendingAction.warnings?.map((w) => (
          <p key={w} className={`mb-2 text-sm ${color.alertWarn}`}>
            {w}
          </p>
        ))}
        <TxForm
          assets={assets}
          fixedAssetId={pendingAction.fixedAssetId}
          initial={{ ...pendingAction.initial, id: '', createdAt: 0 }}
          onSubmit={(t) => {
            addTransaction(t)
            const asset = assets.find((a) => a.id === t.assetId)
            notify(`已记录流水(${asset?.name ?? ''})`)
          }}
          onCancel={close}
        />
      </Modal>
    )
  }

  if (pendingAction.kind === 'editTx') {
    const tx = transactions.find((t) => t.id === pendingAction.txId)
    if (!tx) return null
    return (
      <Modal title={modalTitle(pendingAction, assets)} onClose={close}>
        <TxForm
          assets={assets}
          fixedAssetId={tx.assetId}
          initial={tx}
          onSubmit={(t) => {
            updateTransaction(tx.id, t)
            notify('已更新流水')
          }}
          onCancel={close}
        />
      </Modal>
    )
  }

  return null
}

/** 对话内删除确认卡片 */
export function DeleteConfirmCard({
  action,
  summary,
  onDone,
}: {
  action: PendingAction
  summary: string
  onDone: (message: string) => void
}) {
  const assets = useStore((s) => s.assets)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const deleteTransaction = useStore((s) => s.deleteTransaction)

  if (action.kind !== 'deleteAsset' && action.kind !== 'deleteTx') return null

  const handleConfirm = () => {
    if (action.kind === 'deleteAsset') {
      const asset = assets.find((a) => a.id === action.assetId)
      if (!asset) return
      if (!confirm(`确定删除「${asset.name}」及其全部交易记录?此操作不可恢复。`)) return
      deleteAsset(action.assetId)
      onDone(`已删除资产「${asset.name}」`)
    } else {
      if (!confirm('删除这条记录?')) return
      deleteTransaction(action.txId)
      onDone('已删除流水')
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm text-amber-900">{summary}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className={btnPrimary} onClick={handleConfirm}>
          确认删除
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          onClick={() => onDone('已取消删除')}
        >
          取消
        </button>
      </div>
    </div>
  )
}

/** 表单类 pending 卡片 */
export function PendingActionCard({
  summary,
  action,
  onOpen,
}: {
  summary: string
  action: PendingAction
  onOpen: () => void
}) {
  if (action.kind === 'deleteAsset' || action.kind === 'deleteTx') return null

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-sm text-indigo-900">{summary}</p>
      <button
        type="button"
        className="mt-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        onClick={onOpen}
      >
        打开确认表单
      </button>
    </div>
  )
}
