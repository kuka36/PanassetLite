import { useState } from 'react'
import type { Asset, Transaction, TxType } from '../types'
import { TX_TYPE_LABEL, isQuantityBased } from '../types'
import { today } from '../services/storage'
import { btnGhost, btnPrimary, inputCls, labelCls } from './Modal'

interface Props {
  assets: Asset[]
  /** 固定资产时传入,否则可下拉选择 */
  fixedAssetId?: string
  defaultType?: TxType
  onSubmit: (t: Omit<Transaction, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

function allowedTypes(asset: Asset | undefined): TxType[] {
  if (!asset) return []
  if (asset.type === 'debt') return ['BORROW', 'REPAY', 'VALUATION']
  if (isQuantityBased(asset.type)) return ['BUY', 'SELL', 'VALUATION']
  return ['DEPOSIT', 'WITHDRAW', 'INCOME', 'VALUATION']
}

export default function TxForm({ assets, fixedAssetId, defaultType, onSubmit, onCancel }: Props) {
  const active = assets.filter((a) => !a.archived)
  const [assetId, setAssetId] = useState(fixedAssetId ?? active[0]?.id ?? '')
  const asset = active.find((a) => a.id === assetId)
  const types = allowedTypes(asset)
  const [type, setType] = useState<TxType>(
    defaultType && types.includes(defaultType) ? defaultType : types[0] ?? 'DEPOSIT',
  )
  const [date, setDate] = useState(today())
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')

  const effType = types.includes(type) ? type : types[0]
  const needsQty = effType === 'BUY' || effType === 'SELL'
  const needsAmount =
    effType === 'DEPOSIT' || effType === 'WITHDRAW' || effType === 'INCOME' ||
    effType === 'BORROW' || effType === 'REPAY'
  const needsValue = effType === 'VALUATION'

  const valid =
    !!asset &&
    !!date &&
    (!needsQty || (Number(quantity) > 0 && Number(price) > 0)) &&
    (!needsAmount || Number(amount) > 0) &&
    (!needsValue || Number(value) >= 0)

  const submit = () => {
    if (!valid || !asset) return
    onSubmit({
      assetId: asset.id,
      type: effType,
      date,
      quantity: needsQty ? Number(quantity) : undefined,
      price: needsQty ? Number(price) : undefined,
      amount: needsAmount ? Number(amount) : undefined,
      value: needsValue ? Number(value) : undefined,
      note: note.trim() || undefined,
    })
  }

  const cur = asset?.currency ?? 'CNY'

  return (
    <div className="space-y-4">
      {!fixedAssetId && (
        <div>
          <label className={labelCls}>资产 *</label>
          <select className={inputCls} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.platform ? `(${a.platform})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>事件类型 *</label>
          <select
            className={inputCls}
            value={effType}
            onChange={(e) => setType(e.target.value as TxType)}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {TX_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>日期 *</label>
          <input
            type="date"
            className={inputCls}
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {needsQty && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>数量 / 份额 *</label>
            <input
              type="number"
              className={inputCls}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
              min="0"
              step="any"
            />
          </div>
          <div>
            <label className={labelCls}>单价({cur})*</label>
            <input
              type="number"
              className={inputCls}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
            />
          </div>
        </div>
      )}
      {needsQty && Number(quantity) > 0 && Number(price) > 0 && (
        <p className="text-xs text-slate-500">
          成交金额:{(Number(quantity) * Number(price)).toLocaleString('zh-CN')} {cur}
        </p>
      )}

      {needsAmount && (
        <div>
          <label className={labelCls}>金额({cur})*</label>
          <input
            type="number"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
          />
        </div>
      )}

      {needsValue && (
        <div>
          <label className={labelCls}>当日总市值({cur})*</label>
          <input
            type="number"
            className={inputCls}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="当前在该平台看到的总金额"
            min="0"
            step="any"
          />
          <p className="mt-1 text-xs text-slate-500">
            手动估值:填入此刻该资产的总值,系统会自动计算区间收益率。
          </p>
        </div>
      )}

      <div>
        <label className={labelCls}>备注</label>
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button className={btnGhost} onClick={onCancel}>
          取消
        </button>
        <button className={btnPrimary} onClick={submit} disabled={!valid}>
          记录
        </button>
      </div>
    </div>
  )
}
