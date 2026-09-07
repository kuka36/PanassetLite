import { useState } from 'react'
import type { Asset, Strategy, StrategyKind } from '../types'
import { STRATEGY_KIND_LABEL } from '../types'
import { formatDateKey, parseDatetimeLocal, startOfDay, toDatetimeLocalValue } from '../utils/time'
import { btnGhost, btnPrimary, inputCls, labelCls } from './Modal'

/** YYYY-MM-DD → 本地日 00:00 ms；非法返回 null */
function parseDateInput(value: string): number | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return startOfDay(new Date(y, m - 1, d).getTime())
}

export type StrategyInitialDeposit = { amount: number; occurredAt: number }

interface Props {
  assets: Asset[]
  /** 从资产详情打开时固定 assetId；从策略页打开时可选 */
  fixedAssetId?: string
  initial?: Strategy
  onSubmit: (
    s: Omit<Strategy, 'id' | 'createdAt'>,
    initialDeposit?: StrategyInitialDeposit,
  ) => void
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
  const isCreate = !initial
  const active = assets.filter((a) => !a.archived)
  const [assetId, setAssetId] = useState(
    fixedAssetId ?? initial?.assetId ?? active[0]?.id ?? '',
  )
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<StrategyKind>(initial?.kind ?? 'manual')
  const [note, setNote] = useState(initial?.note ?? '')
  const [expiresAtInput, setExpiresAtInput] = useState(
    () => (initial?.expiresAt != null ? formatDateKey(initial.expiresAt) : ''),
  )
  const [openedAt] = useState(() => Date.now())
  const [amount, setAmount] = useState('')
  const [occurredAtInput, setOccurredAtInput] = useState(() =>
    toDatetimeLocalValue(Date.now()),
  )

  const selectedAsset = active.find((a) => a.id === assetId)
  const currency = selectedAsset?.currency ?? initial?.currency ?? 'CNY'

  const hasDepositInput = amount.trim() !== ''
  const occurredAt = parseDatetimeLocal(occurredAtInput)
  const depositValid =
    !hasDepositInput ||
    (Number(amount) > 0 && occurredAt != null && occurredAt <= openedAt)

  const valid = !!assetId && name.trim().length > 0 && (!isCreate || depositValid)

  const submit = () => {
    if (!valid) return
    const expiresAt = parseDateInput(expiresAtInput) ?? undefined
    const strategy = {
      assetId,
      name: name.trim(),
      kind,
      currency,
      note: note.trim() || undefined,
      expiresAt,
      archived: initial?.archived,
    }
    if (isCreate && hasDepositInput && occurredAt != null) {
      onSubmit(strategy, { amount: Number(amount), occurredAt })
    } else {
      onSubmit(strategy)
    }
  }

  const maxDatetime = toDatetimeLocalValue(openedAt)

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

      <div>
        <label className={labelCls}>到期日</label>
        <input
          type="date"
          className={inputCls}
          value={expiresAtInput}
          onChange={(e) => setExpiresAtInput(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          可选。到期当天起在侧栏与列表提醒；清空则不再提醒
        </p>
      </div>

      {selectedAsset && (
        <p className="text-xs text-slate-400">
          计价货币将继承资产：{currency}
        </p>
      )}

      {isCreate && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">初始存入（可选）</p>
          <div>
            <label className={labelCls}>金额（{currency}）</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputCls}
              placeholder="留空则只创建策略"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {hasDepositInput && (
            <div>
              <label className={labelCls}>发生时间 *</label>
              <input
                type="datetime-local"
                step={1}
                className={inputCls}
                value={occurredAtInput}
                max={maxDatetime}
                onChange={(e) => setOccurredAtInput(e.target.value)}
              />
            </div>
          )}
        </div>
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
