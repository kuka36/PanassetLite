import { useState } from 'react'
import type { Asset, AssetType, PriceSource } from '../types'
import { ASSET_TYPE_LABEL } from '../types'
import { btnGhost, btnPrimary, formGroupCls, inputCls, labelCls } from './Modal'

interface Props {
  initial?: Asset
  onSubmit: (a: Omit<Asset, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'BTC'] as const
const CURRENCY_LABEL: Record<(typeof CURRENCIES)[number], string> = {
  CNY: 'CNY 人民币',
  USD: 'USD 美元',
  HKD: 'HKD 港币',
  EUR: 'EUR 欧元',
  BTC: 'BTC 比特币',
}

export default function AssetForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<AssetType>(initial?.type ?? 'cash')
  const [currency, setCurrency] = useState(initial?.currency ?? 'CNY')
  const [platform, setPlatform] = useState(initial?.platform ?? '')
  const [symbol, setSymbol] = useState(initial?.symbol ?? '')
  const [priceSource, setPriceSource] = useState<PriceSource>(initial?.priceSource ?? 'manual')
  const [note, setNote] = useState(initial?.note ?? '')
  const [suppressUpdateReminder, setSuppressUpdateReminder] = useState(
    initial?.suppressUpdateReminder ?? false,
  )

  const canAutoPrice = type === 'crypto' || type === 'stock' || type === 'fund'

  const submit = () => {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      type,
      currency,
      platform: platform.trim() || undefined,
      symbol: symbol.trim() || undefined,
      priceSource: canAutoPrice ? priceSource : 'manual',
      note: note.trim() || undefined,
      archived: initial?.archived,
      suppressUpdateReminder: suppressUpdateReminder || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>名称 *</label>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如:招商银行储蓄卡 / 贵州茅台 / 比特币"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>类别 *</label>
          <select
            className={inputCls}
            value={type}
            onChange={(e) => {
              const next = e.target.value as AssetType
              setType(next)
              if (next === 'crypto') {
                setPriceSource('coingecko')
              } else if (priceSource === 'coingecko' || priceSource === 'finnhub') {
                setPriceSource('manual')
              }
            }}
          >
            {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>计价货币</label>
          <select
            className={inputCls}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>平台 / 渠道</label>
        <input
          className={inputCls}
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="如:支付宝、招商银行、币安"
        />
      </div>

      {canAutoPrice && (
        <div className={`${formGroupCls} space-y-3`}>
          <div>
            <label className={labelCls}>行情来源</label>
            <select
              className={inputCls}
              value={priceSource}
              onChange={(e) => setPriceSource(e.target.value as PriceSource)}
            >
              <option value="manual">手动更新估值</option>
              {type === 'crypto' && (
                <option value="coingecko">自动行情 Gate.io / CoinGecko 备用(免 key)</option>
              )}
              {type !== 'crypto' && <option value="finnhub">Finnhub 自动(美股,需 key)</option>}
            </select>
            {type === 'crypto' && priceSource === 'coingecko' && (
              <p className="mt-1 text-xs text-slate-500">
                记买入/卖出时单价必填；有行情代码时会按业务日行情预填，可再修改。
              </p>
            )}
          </div>
          {priceSource !== 'manual' && (
            <div>
              <label className={labelCls}>
                行情代码 *{' '}
                {priceSource === 'coingecko'
                  ? '(CoinGecko id,如 bitcoin / tether / ethereum)'
                  : '(ticker,如 AAPL / MSFT)'}
              </label>
              <input
                className={inputCls}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={priceSource === 'coingecko' ? 'bitcoin' : 'AAPL'}
              />
            </div>
          )}
        </div>
      )}

      <div>
        <label className={labelCls}>备注</label>
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 accent-sky-600"
          checked={suppressUpdateReminder}
          onChange={(e) => setSuppressUpdateReminder(e.target.checked)}
        />
        <span>
          关闭更新提醒
          <span className="mt-0.5 block text-xs text-slate-500">
            长期不动的资产可不提醒（侧栏角标与列表着色）
          </span>
        </span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button className={btnGhost} onClick={onCancel}>
          取消
        </button>
        <button className={btnPrimary} onClick={submit} disabled={!name.trim()}>
          {initial ? '保存修改' : '添加资产'}
        </button>
      </div>
    </div>
  )
}
