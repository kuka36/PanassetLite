import { useCallback, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import Modal, { btnPrimary } from '../components/Modal'
import TxForm from '../components/TxForm'
import { transferToTransactions } from '../utils/transfer'
import StrategyTxForm from '../components/StrategyTxForm'
import FlowFilters from '../components/FlowFilters'
import FlowTable, { FlowTypeBadge } from '../components/FlowTable'
import FlowEntityPicker from '../components/FlowEntityPicker'
import { useTableSort } from '../hooks/useTableSort'
import type { StrategyTransaction, Transaction } from '../types'
import { STRATEGY_TX_TYPE_LABEL, TX_TYPE_LABEL } from '../types'
import { fmtDateTime } from '../utils/format'
import {
  assetFlowDetailSortValue,
  formatAssetFlowDetail,
  formatStrategyFlowDetail,
  strategyFlowDetailSortValue,
} from '../utils/flowFormat'
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

const ASSET_FLOW_EMPTY =
  '暂无流水。所有财务状态都由这里的事件流计算得出 —— 买入、卖出、存取、估值更新。'
const STRATEGY_FLOW_EMPTY =
  '暂无策略流水。策略流水与资产流水完全隔离，不影响净资产统计。'

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
  const addTransactions = useStore((s) => s.addTransactions)
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
      detail: (t) => assetFlowDetailSortValue(t),
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
      detail: (t) => strategyFlowDetailSortValue(t),
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

  const assetPickerOptions = useMemo(
    () =>
      activeAssets.map((a) => ({
        id: a.id,
        label: `${a.name}${a.platform ? ` · ${a.platform}` : ''}`,
      })),
    [activeAssets],
  )

  const strategyPickerSelectOptions = useMemo(
    () =>
      strategyPickerOptions.map((s) => ({
        id: s.id,
        label: `${s.name} · ${assetMap.get(s.assetId)?.name ?? '(已删除)'}`,
      })),
    [strategyPickerOptions, assetMap],
  )

  const assetColumns = useMemo(
    () =>
      [
        {
          key: 'occurredAt' as const,
          label: '时间',
          headerClassName: 'px-4 py-3 font-medium',
          cellClassName: 'px-4 py-2.5 text-xs tabular-nums text-slate-500',
          render: (t: Transaction) => fmtDateTime(t.occurredAt),
        },
        {
          key: 'asset' as const,
          label: '资产',
          cellClassName: 'px-3 py-2.5 text-slate-700',
          render: (t: Transaction) => assetMap.get(t.assetId)?.name ?? '(已删除)',
        },
        {
          key: 'type' as const,
          label: '类型',
          cellClassName: 'px-3 py-2.5',
          render: (t: Transaction) => <FlowTypeBadge label={TX_TYPE_LABEL[t.type]} />,
        },
        {
          key: 'detail' as const,
          label: '明细',
          align: 'right' as const,
          cellClassName: 'px-3 py-2.5 text-right tabular-nums text-slate-700',
          render: (t: Transaction) =>
            formatAssetFlowDetail(t, assetMap.get(t.assetId)?.currency ?? ''),
        },
        {
          key: 'note' as const,
          label: '备注',
          cellClassName: 'max-w-40 truncate px-3 py-2.5 text-xs text-slate-500',
          render: (t: Transaction) => t.note,
        },
      ],
    [assetMap],
  )

  const strategyColumns = useMemo(
    () =>
      [
        {
          key: 'occurredAt' as const,
          label: '时间',
          headerClassName: 'px-4 py-3 font-medium',
          cellClassName: 'px-4 py-2.5 text-xs tabular-nums text-slate-500',
          render: (t: StrategyTransaction) => fmtDateTime(t.occurredAt),
        },
        {
          key: 'strategy' as const,
          label: '策略',
          cellClassName: 'px-3 py-2.5 text-slate-700',
          render: (t: StrategyTransaction) => strategyMap.get(t.strategyId)?.name ?? '(已删除)',
        },
        {
          key: 'asset' as const,
          label: '关联资产',
          cellClassName: 'px-3 py-2.5 text-slate-600',
          render: (t: StrategyTransaction) => {
            const strategy = strategyMap.get(t.strategyId)
            return strategy ? (assetMap.get(strategy.assetId)?.name ?? '(已删除)') : '(已删除)'
          },
        },
        {
          key: 'type' as const,
          label: '类型',
          cellClassName: 'px-3 py-2.5',
          render: (t: StrategyTransaction) => (
            <FlowTypeBadge label={STRATEGY_TX_TYPE_LABEL[t.type]} variant="strategy" />
          ),
        },
        {
          key: 'detail' as const,
          label: '发生额',
          align: 'right' as const,
          cellClassName: 'px-3 py-2.5 text-right tabular-nums text-slate-700',
          render: (t: StrategyTransaction) =>
            formatStrategyFlowDetail(t, strategyMap.get(t.strategyId)?.currency ?? ''),
        },
        {
          key: 'note' as const,
          label: '备注',
          cellClassName: 'max-w-40 truncate px-3 py-2.5 text-xs text-slate-500',
          render: (t: StrategyTransaction) => t.note,
        },
      ],
    [assetMap, strategyMap],
  )

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
        <FlowTable
          rows={assetRows}
          columns={assetColumns}
          sort={assetSort}
          onSort={handleAssetSort}
          rowKey={(t) => t.id}
          getId={(t) => t.id}
          emptyMessage={ASSET_FLOW_EMPTY}
          onEdit={(tx) => setAssetModal({ kind: 'edit', tx })}
          onDelete={deleteTransaction}
          renderMobileCard={(t, actions) => {
            const asset = assetMap.get(t.assetId)
            const cur = asset?.currency ?? ''
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{asset?.name ?? '(已删除)'}</p>
                    <p className="text-xs tabular-nums text-slate-500">{fmtDateTime(t.occurredAt)}</p>
                  </div>
                  <FlowTypeBadge label={TX_TYPE_LABEL[t.type]} />
                </div>
                <p className="text-sm tabular-nums text-slate-700">{formatAssetFlowDetail(t, cur)}</p>
                {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                {actions}
              </>
            )
          }}
        />
      ) : (
        <FlowTable
          rows={strategyRows}
          columns={strategyColumns}
          sort={strategySort}
          onSort={handleStrategySort}
          rowKey={(t) => t.id}
          getId={(t) => t.id}
          emptyMessage={STRATEGY_FLOW_EMPTY}
          onEdit={(tx) => setStrategyModal({ kind: 'edit', tx })}
          onDelete={deleteStrategyTransaction}
          renderMobileCard={(t, actions) => {
            const strategy = strategyMap.get(t.strategyId)
            const asset = strategy ? assetMap.get(strategy.assetId) : undefined
            const cur = strategy?.currency ?? ''
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{strategy?.name ?? '(已删除)'}</p>
                    <p className="text-xs text-slate-500">{asset?.name ?? '(已删除)'}</p>
                    <p className="text-xs tabular-nums text-slate-500">{fmtDateTime(t.occurredAt)}</p>
                  </div>
                  <FlowTypeBadge label={STRATEGY_TX_TYPE_LABEL[t.type]} variant="strategy" />
                </div>
                <p className="text-sm tabular-nums text-slate-700">{formatStrategyFlowDetail(t, cur)}</p>
                {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                {actions}
              </>
            )
          }}
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
            <FlowEntityPicker
              label="选择资产 *"
              placeholder="请选择资产"
              options={assetPickerOptions}
              value={pickAssetId}
              onChange={setPickAssetId}
              onCancel={() => {
                setAssetModal(null)
                setPickAssetId('')
              }}
              onContinue={() => setAssetModal({ kind: 'add', assetId: pickAssetId })}
            />
          ) : (
            <TxForm
              assets={assets}
              fixedAssetId={addAsset.id}
              onSubmit={(t) => {
                addTransaction(t)
                setAssetModal(null)
                setPickAssetId('')
              }}
              onTransferSubmit={(t) => {
                addTransactions(transferToTransactions(t, assets))
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
            <FlowEntityPicker
              label="选择策略 *"
              placeholder="请选择策略"
              options={strategyPickerSelectOptions}
              value={pickStrategyId}
              onChange={setPickStrategyId}
              onCancel={() => {
                setStrategyModal(null)
                setPickStrategyId('')
              }}
              onContinue={() => setStrategyModal({ kind: 'add', strategyId: pickStrategyId })}
            />
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
