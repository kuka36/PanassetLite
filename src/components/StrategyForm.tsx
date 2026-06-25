import { useState } from 'react'
import type { Asset, Strategy, StrategyKind } from '../types'
import { STRATEGY_KIND_LABEL } from '../types'
import { btnGhost, btnPrimary, inputCls, labelCls } from './Modal'

interface Props {
  assets: Asset[]
  /** 从资产详情打开时固定 assetId；从策略页打开时可选 */
  fixedAssetId?: string
  initial?: Strategy
  onSubmit: (s: Omit<Strategy, 'id' | 'createdAt'>) => void
  onCancel: () => void
  /** 编辑进行中策略时，底部永久删除入口 */
  onPermanentDelete?: () => void
}

export default function StrategyForm({
  assets,
  fixedAssetId,
  initial,
  onSubmit,
  onCancel,
  onPermanentDelete,
}: Props) {
  const active = assets.filter((a) => !a.archived)
  const [assetId, setAssetId] = useState(
    fixedAssetId ?? initial?.assetId ?? active[0]?.id ?? '',
  )
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<StrategyKind>(initial?.kind ?? 'dca')
  const [note, setNote] = useState(initial?.note ?? '')

  const selectedAsset = active.find((a) => a.id === assetId)
  const currency = selectedAsset?.currency ?? initial?.currency ?? 'CNY'

  const valid = !!assetId && name.trim().length > 0

  const submit = () => {
    if (!valid) return
    onSubmit({
      assetId,
      name: name.trim(),
      kind,
      currency,
      note: note.trim() || undefined,
      archived: initial?.archived,
    })
  }

  return (
    <div className="space-y-4">
      {!fixedAssetId && (
        <div>
          <label className={labelCls}>归属资产 *</label>
          <select
            className={inputCls}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="">请选择资产</option>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.platform ? `（${a.platform}）` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>策略名称 *</label>
        <input
          className={inputCls}
          placeholder="如：BTC 周定投、ETH 网格机器人"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>

      <div>
        <label className={labelCls}>策略类型</label>
        <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as StrategyKind)}>
          {(Object.entries(STRATEGY_KIND_LABEL) as [StrategyKind, string][]).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>备注</label>
        <input
          className={inputCls}
          placeholder="可选"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {selectedAsset && (
        <p className="text-xs text-slate-400">
          计价货币将继承资产：{currency}
        </p>
      )}

      {onPermanentDelete && (
        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-red-600"
            onClick={onPermanentDelete}
          >
            永久删除此策略
          </button>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button type="button" className={btnGhost} onClick={onCancel}>取消</button>
        <button type="button" className={btnPrimary} onClick={submit} disabled={!valid}>
          {initial ? '保存' : '添加策略'}
        </button>
      </div>
    </div>
  )
}
