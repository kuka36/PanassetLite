import { useCallback, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import Modal, { btnGhost, btnPrimary, inputCls, labelCls } from '../components/Modal'
import { SortTh } from '../components/SortTh'
import TxForm from '../components/TxForm'
import StrategyTxForm from '../components/StrategyTxForm'
import FlowFilters from '../components/FlowFilters'
import { Card, CardBody } from '../components/ui/Card'
import { useTableSort } from '../hooks/useTableSort'
import type { Strategy, StrategyTransaction, Transaction } from '../types'
import { STRATEGY_TX_TYPE_LABEL, TX_TYPE_LABEL } from '../types'
import { fmtDateTime, fmtNum } from '../utils/format'
import { sortBy, type SortState } from '../utils/tableSort'

export interface FlowsInit {
  tab?: 'asset' | 'strategy'
  filterAssetId?: string
  filterStrategyId?: string
}

type FlowTab = 'asset' | 'strategy'

type TxSortKey = 'occurredAt' | 'asset' | 'type' | 'detail' | 'note'
type StrategyTxSortKey = 'occurredAt' | 'strategy' | 'asset' | 'type' | 'detail' | 'note'

const TX_TEXT_KEYS: readonly TxSortKey[] = ['asset', 'type', 'note']
const STRATEGY_TX_TEXT_KEYS: readonly StrategyTxSortKey[] = ['strategy', 'asset', 'type', 'note']
const DEFAULT_TX_SORT: SortState<TxSortKey> = { key: 'occurredAt', dir: 'desc' }
const DEFAULT_STRATEGY_TX_SORT: SortState<StrategyTxSortKey> = { key: 'occurredAt', dir: 'desc' }

function txDetailSortValue(t: Transaction): number | null {
  if (t.amount != null) return t.amount
  if (t.value != null) return t.value
  if (t.quantity != null && t.price != null) return t.quantity * t.price
  return null
}

function strategyTxDetailSortValue(t: StrategyTransaction): number | null {
  if (t.amount != null) return t.amount
  if (t.value != null) return t.value
  return null
}

type AssetModalState = { kind: 'add'; assetId?: string } | { kind: 'edit'; tx: Transaction } | null
type StrategyModalState =
  | { kind: 'add'; strategyId?: string }
  | { kind: 'edit'; tx: StrategyTransaction }
  | null

interface Props {
  initial?: FlowsInit
}

export default function Transactions({ initial }: Props) {
  const assets = useStore((s) => s.assets)
  const strategies = useStore((s) => s.strategies)
  const transactions = useStore((s) => s.transactions)
  const strategyTransactions = useStore((s) => s.strategyTransactions)
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const deleteTransaction = useStore((s) => s.deleteTransaction)
  const addStrategyTransaction = useStore((s) => s.addStrategyTransaction)
  const updateStrategyTransaction = useStore((s) => s.updateStrategyTransaction)
  const deleteStrategyTransaction = useStore((s) => s.deleteStrategyTransaction)

  const [tab, setTab] = useState<FlowTab>(() => initial?.tab ?? 'asset')
  const [filterAsset, setFilterAsset] = useState(() => initial?.filterAssetId ?? '')
  const [filterStrategy, setFilterStrategy] = useState(() => initial?.filterStrategyId ?? '')
  const [filterStrategyAsset, setFilterStrategyAsset] = useState('')
  const [assetModal, setAssetModal] = useState<AssetModalState>(null)
  const [strategyModal, setStrategyModal] = useState<StrategyModalState>(null)
  const [pickAssetId, setPickAssetId] = useState('')
  const [pickStrategyId, setPickStrategyId] = useState('')

  const { sort: assetSort, handleSort: handleAssetSort } = useTableSort(DEFAULT_TX_SORT, TX_TEXT_KEYS)
  const { sort: strategySort, handleSort: handleStrategySort } = useTableSort(
    DEFAULT_STRATEGY_TX_SORT,
    STRATEGY_TX_TEXT_KEYS,
  )

  const activeStrategies = useMemo(
    () => strategies.filter((s) => !s.archived),
    [strategies],
  )

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const strategyMap = useMemo(() => new Map(strategies.map((s) => [s.id, s])), [strategies])

  const strategyPickerOptions = useMemo(
    () =>
      activeStrategies.filter(
        (s) => !filterStrategyAsset || s.assetId === filterStrategyAsset,
      ),
    [activeStrategies, filterStrategyAsset],
  )

  const activeAssets = useMemo(() => assets.filter((a) => !a.archived), [assets])

  const resolveAddAssetId = useCallback((): string | undefined => {
    if (!filterAsset) return undefined
    const selected = assetMap.get(filterAsset)
    return selected && !selected.archived ? filterAsset : undefined
  }, [filterAsset, assetMap])

  const resolveAddStrategyId = useCallback((): string | undefined => {
    if (!filterStrategy) return undefined
    const selected = strategyMap.get(filterStrategy)
    if (selected && !selected.archived) return filterStrategy
    return undefined
  }, [filterStrategy, strategyMap])

  const openAddAssetTx = useCallback(() => {
    if (activeAssets.length === 0) return
    const id = resolveAddAssetId()
    setPickAssetId(id ?? '')
    setAssetModal({ kind: 'add', assetId: id })
  }, [activeAssets.length, resolveAddAssetId])

  const openAddStrategyTx = useCallback(() => {
    if (activeStrategies.length === 0) return
    const id = resolveAddStrategyId()
    setPickStrategyId(id ?? '')
    setStrategyModal({ kind: 'add', strategyId: id })
  }, [activeStrategies.length, resolveAddStrategyId])

  const txAccessors = useMemo(
    (): Record<TxSortKey, (t: Transaction) => string | number | null | undefined> => ({
      occurredAt: (t) => t.occurredAt,
      asset: (t) => assetMap.get(t.assetId)?.name ?? '',
      type: (t) => TX_TYPE_LABEL[t.type],
      detail: (t) => txDetailSortValue(t),
      note: (t) => t.note,
    }),
    [assetMap],
  )

  const strategyTxAccessors = useMemo(
    (): Record<
      StrategyTxSortKey,
      (t: StrategyTransaction) => string | number | null | undefined
    > => ({
      occurredAt: (t) => t.occurredAt,
      strategy: (t) => strategyMap.get(t.strategyId)?.name ?? '',
      asset: (t) => {
        const s = strategyMap.get(t.strategyId)
        return s ? (assetMap.get(s.assetId)?.name ?? '') : ''
      },
      type: (t) => STRATEGY_TX_TYPE_LABEL[t.type],
      detail: (t) => strategyTxDetailSortValue(t),
      note: (t) => t.note,
    }),
    [assetMap, strategyMap],
  )

  const assetRows = useMemo(() => {
    const filtered = transactions.filter((t) => !filterAsset || t.assetId === filterAsset)
    return sortBy(filtered, assetSort, txAccessors)
  }, [transactions, filterAsset, assetSort, txAccessors])

  const strategyRows = useMemo(() => {
    const filtered = strategyTransactions.filter((t) => {
      if (filterStrategy && t.strategyId !== filterStrategy) return false
      if (filterStrategyAsset) {
        const s = strategyMap.get(t.strategyId)
        if (!s || s.assetId !== filterStrategyAsset) return false
      }
      return true
    })
    return sortBy(filtered, strategySort, strategyTxAccessors)
  }, [
    strategyTransactions,
    filterStrategy,
    filterStrategyAsset,
    strategySort,
    strategyTxAccessors,
    strategyMap,
  ])

  const assetFlowOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of transactions) {
      counts.set(t.assetId, (counts.get(t.assetId) ?? 0) + 1)
    }
    return assets.map((a) => ({
      id: a.id,
      name: a.name,
      count: counts.get(a.id) ?? 0,
    }))
  }, [assets, transactions])

  const strategyFlowAssetOptions = useMemo(
    () => assets.map((a) => ({ id: a.id, name: a.name })),
    [assets],
  )

  const strategyFlowOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of strategyTransactions) {
      counts.set(t.strategyId, (counts.get(t.strategyId) ?? 0) + 1)
    }
    return strategies
      .filter((s) => !filterStrategyAsset || s.assetId === filterStrategyAsset)
      .map((s) => ({
        id: s.id,
        name: s.name,
        archived: s.archived,
        count: counts.get(s.id) ?? 0,
      }))
  }, [strategies, strategyTransactions, filterStrategyAsset])

  const handleStrategyAssetChange = useCallback(
    (id: string) => {
      setFilterStrategyAsset(id)
      if (filterStrategy) {
        const s = strategyMap.get(filterStrategy)
        if (id && s?.assetId !== id) setFilterStrategy('')
      }
    },
    [filterStrategy, strategyMap],
  )

  const handleClearFilters = useCallback(() => {
    if (tab === 'asset') {
      setFilterAsset('')
    } else {
      setFilterStrategyAsset('')
      setFilterStrategy('')
    }
  }, [tab])

  const modalOpen = assetModal !== null || strategyModal !== null

  useKeyboardShortcuts(
    useMemo(
      () => [
        {
          key: 'n',
          action: () => {
            if (tab === 'asset' && activeAssets.length > 0) openAddAssetTx()
            else if (tab === 'strategy' && activeStrategies.length > 0) openAddStrategyTx()
          },
        },
      ],
      [tab, activeAssets.length, activeStrategies.length, openAddAssetTx, openAddStrategyTx],
    ),
    !modalOpen,
  )

  const addAssetId =
    assetModal?.kind === 'add' ? assetModal.assetId ?? pickAssetId : undefined
  const addAsset = addAssetId ? assetMap.get(addAssetId) : undefined

  const addStrategyId =
    strategyModal?.kind === 'add'
      ? strategyModal.strategyId ?? pickStrategyId
      : undefined
  const addStrategy = addStrategyId ? strategyMap.get(addStrategyId) : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">流水</h1>
        <button
          className={`${btnPrimary} shrink-0 whitespace-nowrap`}
          onClick={() => {
            if (tab === 'asset') openAddAssetTx()
            else openAddStrategyTx()
          }}
          disabled={tab === 'asset' ? activeAssets.length === 0 : activeStrategies.length === 0}
        >
          + 记一笔
        </button>
      </div>

      <FlowFilters
        tab={tab}
        onTabChange={setTab}
        filterAsset={filterAsset}
        filterStrategyAsset={filterStrategyAsset}
        filterStrategy={filterStrategy}
        assetOptions={tab === 'asset' ? assetFlowOptions : strategyFlowAssetOptions}
        strategyOptions={strategyFlowOptions}
        onAssetChange={setFilterAsset}
        onStrategyAssetChange={handleStrategyAssetChange}
        onStrategyChange={setFilterStrategy}
        onClear={handleClearFilters}
      />

      {tab === 'asset' ? (
        <AssetFlowTable
          rows={assetRows}
          assetMap={assetMap}
          sort={assetSort}
          onSort={handleAssetSort}
          onEdit={(tx) => setAssetModal({ kind: 'edit', tx })}
          onDelete={(id) => deleteTransaction(id)}
        />
      ) : (
        <StrategyFlowTable
          rows={strategyRows}
          assetMap={assetMap}
          strategyMap={strategyMap}
          sort={strategySort}
          onSort={handleStrategySort}
          onEdit={(tx) => setStrategyModal({ kind: 'edit', tx })}
          onDelete={(id) => deleteStrategyTransaction(id)}
        />
      )}

      {assetModal?.kind === 'add' && (
        <Modal
          title={addAsset ? `${addAsset.name} · 记一笔` : '记一笔'}
          onClose={() => {
            setAssetModal(null)
            setPickAssetId('')
          }}
        >
          {!addAsset ? (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>选择资产 *</label>
                <select
                  className={inputCls}
                  value={pickAssetId}
                  onChange={(e) => setPickAssetId(e.target.value)}
                >
                  <option value="">请选择资产</option>
                  {activeAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.platform ? ` · ${a.platform}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    setAssetModal(null)
                    setPickAssetId('')
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={!pickAssetId}
                  onClick={() => setAssetModal({ kind: 'add', assetId: pickAssetId })}
                >
                  继续
                </button>
              </div>
            </div>
          ) : (
            <TxForm
              assets={assets}
              fixedAssetId={addAsset.id}
              onSubmit={(t) => {
                addTransaction(t)
                setAssetModal(null)
                setPickAssetId('')
              }}
              onCancel={() => {
                setAssetModal(null)
                setPickAssetId('')
              }}
            />
          )}
        </Modal>
      )}

      {assetModal?.kind === 'edit' && (
        <Modal title="编辑流水" onClose={() => setAssetModal(null)}>
          <TxForm
            assets={assets}
            initial={assetModal.tx}
            onSubmit={(t) => {
              updateTransaction(assetModal.tx.id, t)
              setAssetModal(null)
            }}
            onCancel={() => setAssetModal(null)}
          />
        </Modal>
      )}

      {strategyModal?.kind === 'add' && (
        <Modal
          title={addStrategy ? `${addStrategy.name} · 记一笔` : '记一笔'}
          onClose={() => {
            setStrategyModal(null)
            setPickStrategyId('')
          }}
        >
          {!addStrategy ? (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>选择策略 *</label>
                <select
                  className={inputCls}
                  value={pickStrategyId}
                  onChange={(e) => setPickStrategyId(e.target.value)}
                >
                  <option value="">请选择策略</option>
                  {strategyPickerOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {assetMap.get(s.assetId)?.name ?? '(已删除)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    setStrategyModal(null)
                    setPickStrategyId('')
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={!pickStrategyId}
                  onClick={() =>
                    setStrategyModal({ kind: 'add', strategyId: pickStrategyId })
                  }
                >
                  继续
                </button>
              </div>
            </div>
          ) : (
            <StrategyTxForm
              strategyId={addStrategy.id}
              currency={addStrategy.currency}
              onSubmit={(t) => {
                addStrategyTransaction(t)
                setStrategyModal(null)
                setPickStrategyId('')
              }}
              onCancel={() => {
                setStrategyModal(null)
                setPickStrategyId('')
              }}
            />
          )}
        </Modal>
      )}

      {strategyModal?.kind === 'edit' && (() => {
        const s = strategyMap.get(strategyModal.tx.strategyId)
        if (!s) return null
        return (
          <Modal title="编辑流水" onClose={() => setStrategyModal(null)}>
            <StrategyTxForm
              strategyId={s.id}
              currency={s.currency}
              initial={strategyModal.tx}
              onSubmit={(t) => {
                updateStrategyTransaction(strategyModal.tx.id, t)
                setStrategyModal(null)
              }}
              onCancel={() => setStrategyModal(null)}
            />
          </Modal>
        )
      })()}
    </div>
  )
}

function AssetFlowTable({
  rows,
  assetMap,
  sort,
  onSort,
  onEdit,
  onDelete,
}: {
  rows: Transaction[]
  assetMap: Map<string, { name: string; currency: string }>
  sort: SortState<TxSortKey>
  onSort: (key: TxSortKey) => void
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <SortTh
                  label="时间"
                  sortKey="occurredAt"
                  sort={sort}
                  onSort={onSort}
                  className="px-4 py-3 font-medium"
                />
                <SortTh
                  label="资产"
                  sortKey="asset"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                />
                <SortTh
                  label="类型"
                  sortKey="type"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                />
                <SortTh
                  label="明细"
                  sortKey="detail"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                  align="right"
                />
                <SortTh
                  label="备注"
                  sortKey="note"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                />
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const asset = assetMap.get(t.assetId)
                const cur = asset?.currency ?? ''
                return (
                  <tr
                    key={t.id}
                    className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">
                      {fmtDateTime(t.occurredAt)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{asset?.name ?? '(已删除)'}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                        {TX_TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {formatAssetDetail(t, cur)}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-xs text-slate-500">
                      {t.note}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <FlowActions onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    暂无流水。所有财务状态都由这里的事件流计算得出 —— 买入、卖出、存取、估值更新。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-3 md:hidden">
        {rows.map((t) => {
          const asset = assetMap.get(t.assetId)
          const cur = asset?.currency ?? ''
          return (
            <Card key={t.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{asset?.name ?? '(已删除)'}</p>
                    <p className="text-xs tabular-nums text-slate-500">{fmtDateTime(t.occurredAt)}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {TX_TYPE_LABEL[t.type]}
                  </span>
                </div>
                <p className="text-sm tabular-nums text-slate-700">{formatAssetDetail(t, cur)}</p>
                {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                <div className="flex justify-end pt-1">
                  <FlowActions onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
                </div>
              </CardBody>
            </Card>
          )
        })}
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            暂无流水。所有财务状态都由这里的事件流计算得出 —— 买入、卖出、存取、估值更新。
          </p>
        )}
      </div>
    </>
  )
}

function StrategyFlowTable({
  rows,
  assetMap,
  strategyMap,
  sort,
  onSort,
  onEdit,
  onDelete,
}: {
  rows: StrategyTransaction[]
  assetMap: Map<string, { name: string }>
  strategyMap: Map<string, Strategy>
  sort: SortState<StrategyTxSortKey>
  onSort: (key: StrategyTxSortKey) => void
  onEdit: (tx: StrategyTransaction) => void
  onDelete: (id: string) => void
}) {
  const emptyMsg =
    '暂无策略流水。策略流水与资产流水完全隔离，不影响净资产统计。'

  return (
    <>
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <SortTh
                  label="时间"
                  sortKey="occurredAt"
                  sort={sort}
                  onSort={onSort}
                  className="px-4 py-3 font-medium"
                />
                <SortTh
                  label="策略"
                  sortKey="strategy"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                />
                <SortTh
                  label="关联资产"
                  sortKey="asset"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                />
                <SortTh
                  label="类型"
                  sortKey="type"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                />
                <SortTh
                  label="发生额"
                  sortKey="detail"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                  align="right"
                />
                <SortTh
                  label="备注"
                  sortKey="note"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3 font-medium"
                />
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const strategy = strategyMap.get(t.strategyId)
                const asset = strategy ? assetMap.get(strategy.assetId) : undefined
                const cur = strategy?.currency ?? ''
                return (
                  <tr
                    key={t.id}
                    className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">
                      {fmtDateTime(t.occurredAt)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {strategy?.name ?? '(已删除)'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{asset?.name ?? '(已删除)'}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                        {STRATEGY_TX_TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {formatStrategyDetail(t, cur)}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-xs text-slate-500">
                      {t.note}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <FlowActions onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    {emptyMsg}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-3 md:hidden">
        {rows.map((t) => {
          const strategy = strategyMap.get(t.strategyId)
          const asset = strategy ? assetMap.get(strategy.assetId) : undefined
          const cur = strategy?.currency ?? ''
          return (
            <Card key={t.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{strategy?.name ?? '(已删除)'}</p>
                    <p className="text-xs text-slate-500">{asset?.name ?? '(已删除)'}</p>
                    <p className="text-xs tabular-nums text-slate-500">{fmtDateTime(t.occurredAt)}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                    {STRATEGY_TX_TYPE_LABEL[t.type]}
                  </span>
                </div>
                <p className="text-sm tabular-nums text-slate-700">{formatStrategyDetail(t, cur)}</p>
                {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                <div className="flex justify-end pt-1">
                  <FlowActions onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
                </div>
              </CardBody>
            </Card>
          )
        })}
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">{emptyMsg}</p>
        )}
      </div>
    </>
  )
}

function formatAssetDetail(t: Transaction, cur: string): string {
  if (t.quantity != null && t.price != null) return `${fmtNum(t.quantity)} × ${fmtNum(t.price)} ${cur}`
  if (t.amount != null) return `${fmtNum(t.amount, 2)} ${cur}`
  if (t.value != null) return `市值 ${fmtNum(t.value, 2)} ${cur}`
  return '—'
}

function formatStrategyDetail(t: StrategyTransaction, cur: string): string {
  if (t.amount != null) return `${fmtNum(t.amount, 2)} ${cur}`
  if (t.value != null) return `市值 ${fmtNum(t.value, 2)} ${cur}`
  return '—'
}

function FlowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <>
      <button
        className="mr-3 text-xs text-blue-600 transition-colors hover:text-blue-700"
        onClick={onEdit}
      >
        编辑
      </button>
      <button
        className="text-xs text-slate-500 transition-colors hover:text-red-600"
        onClick={() => {
          if (confirm('删除这条流水?')) onDelete()
        }}
      >
        删除
      </button>
    </>
  )
}
