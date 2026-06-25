import { useState } from 'react'
import type { StrategyTransaction, StrategyTxType } from '../types'
import { STRATEGY_TX_TYPE_LABEL } from '../types'
import { parseDatetimeLocal, toDatetimeLocalValue } from '../utils/time'
import { btnGhost, btnPrimary, inputCls, labelCls } from './Modal'

interface Props {
  strategyId: string
  currency: string
  initial?: StrategyTransaction
  onSubmit: (t: Omit<StrategyTransaction, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

const ALL_TYPES: StrategyTxType[] = ['DEPOSIT', 'WITHDRAW', 'INCOME', 'VALUATION']

export default function StrategyTxForm({ strategyId, currency, initial, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<StrategyTxType>(initial?.type ?? 'DEPOSIT')
  const [openedAt] = useState(() => Date.now())
  const [occurredAtInput, setOccurredAtInput] = useState(() =>
    toDatetimeLocalValue(initial?.occurredAt ?? Date.now()),
  )
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [value, setValue] = useState(initial?.value != null ? String(initial.value) : '')
  const [note, setNote] = useState(initial?.note ?? '')

  const needsValue = type === 'VALUATION'
  const needsAmount = !needsValue

  const occurredAt = parseDatetimeLocal(occurredAtInput)
  const valid =
    occurredAt != null &&
    occurredAt <= openedAt &&
    (needsValue ? Number(value) >= 0 && value !== '' : Number(amount) > 0)

  const submit = () => {
    if (!valid || occurredAt == null) return
    onSubmit({
      strategyId,
      type,
      occurredAt,
      amount: needsAmount ? Number(amount) : undefined,
      value: needsValue ? Number(value) : undefined,
      note: note.trim() || undefined,
    })
  }

  const maxDatetime = toDatetimeLocalValue(openedAt)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>类型 *</label>
          <select
            className={inputCls}
            value={type}
            onChange={(e) => setType(e.target.value as StrategyTxType)}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{STRATEGY_TX_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
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
      </div>

      {needsAmount && (
        <div>
          <label className={labelCls}>
            金额（{currency}）*
          </label>
          <input
            type="number"
            min="0"
            step="any"
            className={inputCls}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
      )}

      {needsValue && (
        <div>
          <label className={labelCls}>
            策略当前总市值（{currency}）*
          </label>
          <input
            type="number"
            min="0"
            step="any"
            className={inputCls}
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <p className="mt-1 text-xs text-slate-400">
            填写策略当前的总市值，用于计算盈亏与年化收益率
          </p>
        </div>
      )}

      <div>
        <label className={labelCls}>备注</label>
        <input
          className={inputCls}
          placeholder="可选"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button className={btnGhost} onClick={onCancel}>取消</button>
        <button className={btnPrimary} onClick={submit} disabled={!valid}>
          {initial ? '保存' : '记一笔'}
        </button>
      </div>
    </div>
  )
}
