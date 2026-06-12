import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { usePortfolioEngine, useSummary } from '../hooks/useSummary'
import Modal, { btnGhost, btnPrimary } from '../components/Modal'
import AssetForm from '../components/AssetForm'
import NlTxInput, { nlResultToTxInitial } from '../components/NlTxInput'
import TxForm from '../components/TxForm'
import type { NlTxParseResult } from '../services/nlTx'
import type { Asset, AssetSnapshot, AssetType, Transaction, TxLedgerRow, TxType } from '../types'
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, TX_TYPE_LABEL, isQuantityBased } from '../types'
import { color } from '../theme/colors'
import { fmtMoney, fmtNum, fmtPct, isUpdateStale, pnlColor, staleUpdateCls } from '../utils/format'

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; asset: Asset }
  | { kind: 'nlTx'; asset?: Asset; returnAssetId?: string }
  | { kind: 'tx'; asset?: Asset; defaultType?: TxType; returnAssetId?: string }
  | { kind: 'nlConfirm'; asset?: Asset; result: NlTxParseResult; rawInput: string; returnAssetId?: string }
  | { kind: 'editTx'; tx: Transaction; returnAssetId?: string }
  | { kind: 'detail'; assetId: string }
  | null

function closeEditTx(
  editModal: Extract<ModalState, { kind: 'editTx' }>,
  setModal: (m: ModalState) => void,
) {
  setModal(editModal.returnAssetId ? { kind: 'detail', assetId: editModal.returnAssetId } : null)
}

function closeTx(
  txModal: Extract<ModalState, { kind: 'tx' | 'nlTx' | 'nlConfirm' }>,
  setModal: (m: ModalState) => void,
) {
  setModal(txModal.returnAssetId ? { kind: 'detail', assetId: txModal.returnAssetId } : null)
}

export default function Assets() {
  const summary = useSummary()
  const assets = useStore((s) => s.assets)
  const addAsset = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const settings = useStore((s) => s.settings)
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const [modal, setModal] = useState<ModalState>(null)

  const groups = useMemo(() => {
    const map = new Map<AssetType, AssetSnapshot[]>()
    for (const s of summary.snapshots) {
      const list = map.get(s.asset.type) ?? []
      list.push(s)
      map.set(s.asset.type, list)
    }
    return [...map.entries()]
  }, [summary.snapshots])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-100">资产</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            className={btnGhost}
            disabled={assets.length === 0}
            onClick={() => setModal({ kind: 'nlTx' })}
          >
            记一笔流水
          </button>
          <button className={btnPrimary} onClick={() => setModal({ kind: 'add' })}>
            + 添加资产
          </button>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="py-20 text-center text-sm text-slate-500">
          还没有任何资产,点击右上角「添加资产」开始。
        </p>
      )}

      {groups.map(([type, snaps]) => (
        <div key={type} className="rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ASSET_TYPE_COLOR[type] }} />
            <h3 className="text-sm font-medium text-slate-300">{ASSET_TYPE_LABEL[type]}</h3>
            <span className="ml-auto text-sm tabular-nums text-slate-400">
              {fmtMoney(snaps.reduce((s, x) => s + x.valueCNY, 0))}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-normal">名称</th>
                <th className="px-2 py-2 font-normal text-right">持有</th>
                <th className="px-2 py-2 font-normal text-right">市值</th>
                <th className="px-2 py-2 font-normal text-right">累计盈亏</th>
                <th className="px-2 py-2 font-normal text-right">年化(XIRR)</th>
                <th className="px-2 py-2 font-normal text-right">近期年化</th>
                <th className="px-2 py-2 font-normal text-right">更新于</th>
                <th className="px-4 py-2 font-normal text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => (
                <tr
                  key={s.asset.id}
                  className="cursor-pointer border-t border-slate-800/60 hover:bg-slate-800/40"
                  onClick={() => setModal({ kind: 'detail', assetId: s.asset.id })}
                >
                  <td className="px-4 py-2.5">
                    <div className="text-slate-200">{s.asset.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.asset.platform}
                      {s.asset.currency !== 'CNY' && ` · ${s.asset.currency}`}
                      {s.asset.priceSource !== 'manual' && ' · 自动行情'}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                    {s.quantity > 0 ? fmtNum(s.quantity) : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-200">
                    {fmtMoney(s.valueCNY)}
                  </td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${pnlColor(s.totalPnlCNY)}`}>
                    {type === 'debt' ? '—' : `${s.totalPnlCNY > 0 ? '+' : ''}${fmtMoney(s.totalPnlCNY)}`}
                  </td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${s.xirr != null ? pnlColor(s.xirr) : 'text-slate-500'}`}>
                    {s.xirr != null ? fmtPct(s.xirr) : '—'}
                  </td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${s.recentAnnualized != null ? pnlColor(s.recentAnnualized) : 'text-slate-500'}`}>
                    {s.recentAnnualized != null ? fmtPct(s.recentAnnualized) : '—'}
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right text-xs tabular-nums ${staleUpdateCls(s.lastUpdated)}`}
                    title={
                      isUpdateStale(s.lastUpdated) ? '已超过一个月未更新,建议更新估值' : undefined
                    }
                  >
                    {s.lastUpdated ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="rounded-md px-2 py-1 text-xs text-sky-400 hover:bg-slate-800"
                      onClick={() => setModal({ kind: 'nlTx', asset: s.asset })}
                    >
                      记一笔
                    </button>
                    <button
                      className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                      onClick={() => setModal({ kind: 'tx', asset: s.asset, defaultType: 'VALUATION' })}
                    >
                      更新估值
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {modal?.kind === 'add' && (
        <Modal title="添加资产" onClose={() => setModal(null)}>
          <AssetForm
            onSubmit={(a) => {
              addAsset(a)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.kind === 'edit' && (
        <Modal title="编辑资产" onClose={() => setModal(null)}>
          <AssetForm
            initial={modal.asset}
            onSubmit={(a) => {
              updateAsset(modal.asset.id, a)
              setModal(null)
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.kind === 'nlTx' && (
        <Modal
          title={modal.asset ? `${modal.asset.name} · 记一笔` : '记一笔流水'}
          onClose={() => closeTx(modal, setModal)}
        >
          <NlTxInput
            embedded
            assets={assets}
            settings={settings}
            fixedAssetId={modal.asset?.id}
            onParsed={(result, rawInput) =>
              setModal({
                kind: 'nlConfirm',
                asset: modal.asset,
                result,
                rawInput,
                returnAssetId: modal.returnAssetId,
              })
            }
            onManual={() =>
              setModal({
                kind: 'tx',
                asset: modal.asset,
                returnAssetId: modal.returnAssetId,
              })
            }
          />
        </Modal>
      )}

      {modal?.kind === 'nlConfirm' && (
        <Modal
          title={modal.asset ? `${modal.asset.name} · 确认解析结果` : '确认 AI 解析结果'}
          onClose={() => closeTx(modal, setModal)}
        >
          <p className="mb-3 text-xs text-slate-500">
            原文:「{modal.rawInput}」{!modal.asset && ' — 请核对字段后记录'}
          </p>
          {modal.result.warnings.map((w) => (
            <p
              key={w}
              className={`mb-2 ${color.alertWarn}`}
            >
              {w}
            </p>
          ))}
          <TxForm
            assets={assets}
            fixedAssetId={modal.asset?.id}
            initial={nlResultToTxInitial(modal.result, assets, modal.asset?.id)}
            onSubmit={(t) => {
              addTransaction(t)
              closeTx(modal, setModal)
            }}
            onCancel={() => closeTx(modal, setModal)}
          />
        </Modal>
      )}

      {modal?.kind === 'tx' && (
        <Modal
          title={modal.asset ? `${modal.asset.name} · 手动填写` : '记一笔'}
          onClose={() => closeTx(modal, setModal)}
        >
          <TxForm
            assets={assets}
            fixedAssetId={modal.asset?.id}
            defaultType={modal.defaultType}
            onSubmit={(t) => {
              addTransaction(t)
              closeTx(modal, setModal)
            }}
            onCancel={() => closeTx(modal, setModal)}
          />
        </Modal>
      )}

      {modal?.kind === 'editTx' && (
        <Modal title="编辑交易" onClose={() => closeEditTx(modal, setModal)}>
          <TxForm
            assets={assets}
            fixedAssetId={modal.tx.assetId}
            initial={modal.tx}
            onSubmit={(t) => {
              updateTransaction(modal.tx.id, t)
              closeEditTx(modal, setModal)
            }}
            onCancel={() => closeEditTx(modal, setModal)}
          />
        </Modal>
      )}

      {modal?.kind === 'detail' && (
        <AssetDetail
          assetId={modal.assetId}
          onClose={() => setModal(null)}
          onEdit={(asset) => setModal({ kind: 'edit', asset })}
          onAddTx={(asset) => setModal({ kind: 'nlTx', asset, returnAssetId: modal.assetId })}
          onEditTx={(tx) => setModal({ kind: 'editTx', tx, returnAssetId: modal.assetId })}
          onDelete={(asset) => {
            if (confirm(`确定删除「${asset.name}」及其全部交易记录?此操作不可恢复。`)) {
              deleteAsset(asset.id)
              setModal(null)
            }
          }}
        />
      )}
    </div>
  )
}

function AssetDetail({
  assetId,
  onClose,
  onEdit,
  onAddTx,
  onEditTx,
  onDelete,
}: {
  assetId: string
  onClose: () => void
  onEdit: (a: Asset) => void
  onAddTx: (a: Asset) => void
  onEditTx: (t: Transaction) => void
  onDelete: (a: Asset) => void
}) {
  const summary = useSummary()
  const engine = usePortfolioEngine()
  const settings = useStore((s) => s.settings)
  const deleteTransaction = useStore((s) => s.deleteTransaction)
  const snap = summary.snapshots.find((s) => s.asset.id === assetId)
  const asset = snap?.asset
  const ledger = useMemo(
    () => (asset ? engine.txLedger(asset) : []),
    [engine, asset],
  )
  if (!snap || !asset) return null

  const qtyBased = isQuantityBased(asset.type)
  const showFx = asset.currency !== 'CNY'
  const fx = asset.currency === settings.baseCurrency ? 1 : (settings.fxRates[asset.currency] ?? 1)
  const colSpan = (qtyBased ? 8 : 6) + (showFx ? 1 : 0)

  return (
    <Modal title={asset.name} onClose={onClose} size="xl">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="当前市值" value={fmtMoney(snap.valueCNY)} />
        <Mini
          label="累计盈亏"
          value={asset.type === 'debt' ? '—' : fmtMoney(snap.totalPnlCNY)}
          cls={pnlColor(snap.totalPnlCNY)}
        />
        <Mini label="年化 XIRR" value={snap.xirr != null ? fmtPct(snap.xirr) : '—'} cls={snap.xirr != null ? pnlColor(snap.xirr) : ''} />
        <Mini
          label={snap.quantity > 0 ? '持有数量' : '净投入'}
          value={snap.quantity > 0 ? fmtNum(snap.quantity) : fmtMoney(snap.netInvestedCNY)}
        />
      </div>

      <div className="mb-4 max-h-[min(50vh,28rem)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-normal">日期</th>
              <th className="px-3 py-2 font-normal">类型</th>
              {qtyBased && (
                <>
                  <th className="px-3 py-2 font-normal text-right">数量</th>
                  <th className="px-3 py-2 font-normal text-right">单价</th>
                </>
              )}
              <th className="px-3 py-2 font-normal text-right">发生额</th>
              {showFx && <th className="px-3 py-2 font-normal text-right">折合 CNY</th>}
              <th className="px-3 py-2 font-normal text-right">交易后余额</th>
              <th className="px-3 py-2 font-normal">备注</th>
              <th className="px-3 py-2 font-normal text-right"></th>
            </tr>
          </thead>
          <tbody>
            {ledger.map(({ tx, amountNative, balanceAfter, balanceLabel }) => (
              <tr key={tx.id} className="border-t border-slate-800/60">
                <td className="px-3 py-2 tabular-nums text-slate-400">{tx.date}</td>
                <td className="px-3 py-2 text-slate-300">{TX_TYPE_LABEL[tx.type]}</td>
                {qtyBased && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {tx.quantity != null ? fmtNum(tx.quantity) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {tx.price != null ? `${fmtNum(tx.price)} ${asset.currency}` : '—'}
                    </td>
                  </>
                )}
                <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                  {formatTxAmount(amountNative, asset.currency)}
                </td>
                {showFx && (
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                    {amountNative != null ? fmtMoney(amountNative * fx) : '—'}
                  </td>
                )}
                <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                  {formatTxBalance(balanceAfter, balanceLabel, asset.currency)}
                </td>
                <td className="max-w-32 truncate px-3 py-2 text-xs text-slate-500">{tx.note}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="mr-3 text-xs text-sky-400 hover:underline"
                    onClick={() => onEditTx(tx)}
                  >
                    编辑
                  </button>
                  <button
                    className="text-xs text-slate-500 hover:text-red-400"
                    onClick={() => {
                      if (confirm('删除这条记录?')) deleteTransaction(tx.id)
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-6 text-center text-slate-500">
                  暂无交易记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
        <button
          type="button"
          className="text-sm text-red-400/80 transition-colors hover:text-red-400"
          onClick={() => onDelete(asset)}
        >
          删除资产
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => onEdit(asset)}>
            编辑资产信息
          </button>
          <button type="button" className={btnPrimary} onClick={() => onAddTx(asset)}>
            + 记一笔
          </button>
        </div>
      </div>
    </Modal>
  )
}

function formatTxAmount(amount: number | null, currency: string): string {
  if (amount == null) return '—'
  return `${fmtNum(amount, 2)} ${currency}`
}

function formatTxBalance(
  balance: number,
  label: TxLedgerRow['balanceLabel'],
  currency: string,
): string {
  if (label === 'quantity') return `${fmtNum(balance)} 份`
  return `${fmtNum(balance, 2)} ${currency}`
}

function Mini({ label, value, cls = 'text-slate-200' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}
