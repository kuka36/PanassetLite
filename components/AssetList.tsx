import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/ConfirmModal';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Asset, AssetType } from '../types';
import { convertValue } from '../services/marketData';
import { AssetRow } from './AssetRow';
import { AssetTransactionTable } from './AssetTransactionTable';

interface AssetListProps {
  assets?: Asset[];
  onEdit?: (asset: Asset) => void;
  onTransaction?: (asset: Asset) => void;
}

type SortKey = 'symbol' | 'price' | 'cost' | 'quantity' | 'value' | 'pnl' | 'recentReturn';
type SortDirection = 'asc' | 'desc';

export const AssetList: React.FC<AssetListProps> = ({ assets: propAssets, onEdit, onTransaction }) => {
  const { assets: contextAssets, transactions, deleteAsset, settings, exchangeRates, t } = usePortfolio();
  const assets = propAssets || contextAssets;

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'value', // Default sort by value
    direction: 'desc'
  });

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; symbol: string } | null>(null);

  // Helper to calculate recent annualized return based on last 2 transactions' quantity
  const getRecentReturn = (assetId: string) => {
    const assetTxs = transactions
      .filter(t => t.assetId === assetId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (assetTxs.length < 2) return null;

    const t1 = assetTxs[0]; // Latest transaction
    const t2 = assetTxs[1]; // Second latest transaction

    // Find the current asset to get current holdings
    const currentAsset = assets.find(a => a.id === assetId);
    if (!currentAsset || currentAsset.quantity === 0) return null;

    // Calculate quantity difference between the two transactions
    const quantityDiff = t1.quantityChange;

    // Calculate time difference in days
    const timeDiff = Math.abs(new Date(t1.date).getTime() - new Date(t2.date).getTime());
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) return 0;

    // Calculate annualized return: (quantity_diff / current_holdings) / days_diff * 365
    const annualizedReturn = (quantityDiff / currentAsset.quantity) / daysDiff * 365;

    return annualizedReturn;
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
          aValue = getRecentReturn(a.id) || -Infinity; // Push nulls to bottom
          bValue = getRecentReturn(b.id) || -Infinity;
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
                <SortableHeader label={t('statusPnL')} sortKey="pnl" alignRight />
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
                  recentReturn={getRecentReturn(asset.id)}
                  t={t}
                />
              ))}
              {sortedAssets.length === 0 && (
                <tr>
                  <td colSpan={onEdit ? 8 : 7} className="text-center py-8 text-slate-400 italic">
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
              recentReturn={getRecentReturn(asset.id)}
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
