import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/ConfirmModal';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Asset, AssetType, TransactionType, PerformanceMetrics } from '../types/domain';
import { convertValue } from '../services/marketData';
import { AssetRow } from './AssetRow';
import { AssetTransactionTable } from './AssetTransactionTable';

interface AssetListProps {
  assets?: Asset[];
  onEdit?: (asset: Asset) => void;
  onTransaction?: (asset: Asset) => void;
  onSymbolClick?: (symbol: string) => void;
}

type SortKey = 'symbol' | 'price' | 'cost' | 'quantity' | 'value' | 'pnl' | 'recentReturn';
type SortDirection = 'asc' | 'desc';

export const AssetList: React.FC<AssetListProps> = ({ assets: propAssets, onEdit, onTransaction, onSymbolClick }) => {
  const { assets: contextAssets, transactions, deleteAsset, settings, exchangeRates, t } = usePortfolio();
  const assets = propAssets || contextAssets;

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'value', // Default sort by value
    direction: 'desc'
  });

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; symbol: string } | null>(null);

  // Helper to calculate performance metrics
  const getRecentReturn = (assetId: string): PerformanceMetrics | null => {
    const assetTxs = transactions
      .filter(t => t.assetId === assetId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (assetTxs.length === 0) return null;

    // Find the current asset to get current holdings and PnL
    const currentAsset = assets.find(a => a.id === assetId);
    if (!currentAsset || currentAsset.quantity === 0) return null;

    // --- 1. Cumulative Performance (CAGR) ---
    let cumulative: number | null = null;
    const totalProfit = currentAsset.pnl + (currentAsset.realizedPnL || 0);
    const costBasis = currentAsset.totalCost;

    if (costBasis > 0) {
      const totalReturnRate = totalProfit / costBasis;
      const firstTx = assetTxs[0];
      const startTime = new Date(firstTx.date).getTime();
      const now = Date.now();
      const daysDiff = (now - startTime) / (1000 * 60 * 60 * 24);

      if (daysDiff < 1) {
        cumulative = totalReturnRate;
      } else {
        const safeReturnRate = Math.max(totalReturnRate, -0.999);
        cumulative = Math.pow(1 + safeReturnRate, 365 / daysDiff) - 1;
      }
    }

    // --- 2. Interval Performance (Since Last Sync & Period Perf) ---
    // We strictly use Value-based calculation: (EndValue - NetFlows) / StartValue - 1
    // This supports both "Price Growth" and "Quantity Growth (Zero Cost)" scenarios.

    let sinceLastSync: number | null = null;
    let lastPeriod: number | null = null;

    // A. Reconstruct Historical Quantities for Adjustments
    // We walk backwards from current state to find what the quantity was at the time of each adjustment.
    interface AnnotatedAdjustment {
      tx: typeof assetTxs[0];
      snapshotQty: number; // Qty AFTER this adjustment
      snapshotValue: number;
    }

    const adjustments: AnnotatedAdjustment[] = [];

    // Transactions sorted Ascending (Old -> New) for proper replay
    // We calculate "Post-Tx Quantity" for every transaction to know the state at that point in time.
    let accQty = 0;
    const txWithSnapshots = assetTxs.map(tx => {
      accQty += tx.quantityChange;
      return { ...tx, postTxQty: accQty };
    });

    // Now filter for adjustments (Descending order of time)
    const rawAdjustments = txWithSnapshots
      .filter(t => t.type === TransactionType.BALANCE_ADJUSTMENT && t.pricePerUnit > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Helper: Calculate Net External Flows (Buys/Sells) between two dates
    // Start Date (Exclusive), End Date (Inclusive)
    const calculateFlows = (startIso: string, endIso: string) => {
      const start = new Date(startIso).getTime();
      const end = new Date(endIso).getTime();

      let flow = 0;
      assetTxs.forEach(t => {
        const time = new Date(t.date).getTime();
        if (time > start && time <= end) {
          if (t.type === TransactionType.BUY || t.type === TransactionType.DEPOSIT) {
            flow += t.total;
          } else if (t.type === TransactionType.SELL || t.type === TransactionType.WITHDRAWAL) {
            flow -= t.total; // Proceeds reduce the basis
          }
        }
      });
      return flow;
    };

    // B. Calculate Metrics using Value Ratio

    // Formula: (EndValue - StartValue - Flows) / (StartValue + CapitalInjections)
    // We only add Flows to denominator if they are positive (Capital Injections). Withdrawals (Negative Flows) do not reduce the historical basis for ROI.
    // Enhanced: Supports Annualization
    const calculateReturn = (startVal: number, endVal: number, flow: number, days: number) => {
      const profit = endVal - startVal - flow;
      const basis = startVal + Math.max(flow, 0);
      if (basis <= 0) return 0;

      const totalReturn = profit / basis;

      // Annualize if held for more than 1 day
      if (days < 1) return totalReturn;

      const safeReturn = Math.max(totalReturn, -0.999);
      return Math.pow(1 + safeReturn, 365 / days) - 1;
    };

    // 1. Since Last Sync
    if (rawAdjustments.length > 0) {
      const latestInfo = rawAdjustments[0];
      const startValue = latestInfo.postTxQty * latestInfo.pricePerUnit;
      const endValue = currentAsset.quantity * currentAsset.currentPrice;
      const flows = calculateFlows(latestInfo.date, new Date().toISOString());

      const daysDiff = (Date.now() - new Date(latestInfo.date).getTime()) / (1000 * 60 * 60 * 24);
      sinceLastSync = calculateReturn(startValue, endValue, flows, daysDiff);
    }

    // 2. Last Period (Between 2nd Last and Last)
    if (rawAdjustments.length >= 2) {
      const latest = rawAdjustments[0];
      const prev = rawAdjustments[1]; // Older

      const startValue = prev.postTxQty * prev.pricePerUnit;
      const endValue = latest.postTxQty * latest.pricePerUnit; // Value AT the time of Latest Adjustment

      // Flows between Prev (Exclusive) and Latest (Inclusive)
      const flows = calculateFlows(prev.date, latest.date);

      const daysDiff = (new Date(latest.date).getTime() - new Date(prev.date).getTime()) / (1000 * 60 * 60 * 24);
      lastPeriod = calculateReturn(startValue, endValue, flows, daysDiff);
    }

    return { cumulative, sinceLastSync, lastPeriod };
  };

  // Sort Logic
  const sortedAssets = useMemo(() => {
    const sorted = [...assets];
    sorted.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      const getPnl = (asset: Asset) => (asset.quantity * asset.currentPrice) - (asset.quantity * asset.avgCost);

      switch (sortConfig.key) {
        case 'symbol':
          aValue = a.symbol.toLowerCase();
          bValue = b.symbol.toLowerCase();
          break;
        case 'price':
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case 'cost':
          aValue = a.avgCost;
          bValue = b.avgCost;
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'value':
          // Sort by Converted Value. 
          // CRITICAL: Treat Liabilities as negative values so they appear at bottom in Descending sort (Positive -> Zero -> Negative)
          const valA = convertValue(a.quantity * a.currentPrice, a.currency, settings.baseCurrency, exchangeRates);
          const valB = convertValue(b.quantity * b.currentPrice, b.currency, settings.baseCurrency, exchangeRates);
          aValue = a.type === AssetType.LIABILITY ? -valA : valA;
          bValue = b.type === AssetType.LIABILITY ? -valB : valB;
          break;
        case 'pnl':
          aValue = getPnl(a);
          bValue = getPnl(b);
          break;
        case 'recentReturn':
          // Sort by cumulative
          const perfA = getRecentReturn(a.id);
          const perfB = getRecentReturn(b.id);
          aValue = perfA?.cumulative ?? -Infinity;
          bValue = perfB?.cumulative ?? -Infinity;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [assets, transactions, sortConfig, settings.baseCurrency, exchangeRates]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const renderSortIcon = (columnKey: SortKey) => {
    if (sortConfig.key !== columnKey) return <div className="w-3 h-3" />; // Placeholder
    return sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  // Table Header Helper
  const SortableHeader = ({ label, sortKey, alignRight = false, className = "" }: { label: string, sortKey: SortKey, alignRight?: boolean, className?: string }) => (
    <th
      className={`pb-3 font-medium cursor-pointer group select-none ${alignRight ? 'text-right' : 'text-left'} ${alignRight ? 'pr-2' : 'pl-2'} ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${alignRight ? 'justify-end' : 'justify-start'} text-slate-500 group-hover:text-blue-600 transition-colors`}>
        {label}
        <span className="text-slate-400 group-hover:text-blue-500">
          {renderSortIcon(sortKey)}
        </span>
      </div>
    </th>
  );

  return (
    <>
      <Card title={t('portfolioHoldings')} className="animate-slide-up">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                <SortableHeader label={t('asset')} sortKey="symbol" />
                <SortableHeader label={t('currentPrice')} sortKey="price" />
                <SortableHeader label={t('avgCost')} sortKey="cost" />
                <SortableHeader label={t('holdings')} sortKey="quantity" />
                <SortableHeader label={t('recentReturn')} sortKey="recentReturn" alignRight />
                <SortableHeader label={t('value')} sortKey="value" alignRight />
                {(onEdit || onTransaction) && <th className="pb-3 font-medium text-right pr-2">{t('actions')}</th>}
              </tr>
            </thead>
            <tbody className="text-sm">
              {sortedAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  settings={settings}
                  exchangeRates={exchangeRates}
                  onEdit={onEdit}
                  onTransaction={onTransaction}
                  onDelete={(id, symbol) => setDeleteTarget({ id, symbol })}
                  performance={getRecentReturn(asset.id)}
                  onSymbolClick={onSymbolClick}
                  t={t}
                />
              ))}
              {sortedAssets.length === 0 && (
                <tr>
                  <td colSpan={onEdit ? 7 : 6} className="text-center py-8 text-slate-400 italic">
                    {t('noAssets')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          {sortedAssets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              settings={settings}
              exchangeRates={exchangeRates}
              onEdit={onEdit}
              onTransaction={onTransaction}
              onDelete={(id, symbol) => setDeleteTarget({ id, symbol })}
              performance={getRecentReturn(asset.id)}
              onSymbolClick={onSymbolClick}
              t={t}
            />
          ))}
          {sortedAssets.length === 0 && (
            <div className="text-center py-8 text-slate-400 italic">
              {t('noAssets')}
            </div>
          )}
        </div>
      </Card>

      {/* Transaction History Table */}
      <AssetTransactionTable
        assetIds={sortedAssets.map(asset => asset.id)}
        title={t('relatedTransactions')}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteAsset(deleteTarget.id)}
        title={t('delete')}
        message={deleteTarget ? t('confirmDelete').replace('{symbol}', deleteTarget.symbol) : ''}
        confirmText={t('delete')}
        isDanger
      />
    </>
  );
};
