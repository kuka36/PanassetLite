import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/ConfirmModal';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Asset, AssetType } from '../types';
import { convertValue } from '../services/marketData';
import { AssetRow } from './AssetRow';

interface AssetListProps {
  assets?: Asset[];
  onEdit?: (asset: Asset) => void;
  onTransaction?: (asset: Asset) => void;
}

type SortKey = 'symbol' | 'price' | 'cost' | 'quantity' | 'value' | 'pnl';
type SortDirection = 'asc' | 'desc';

export const AssetList: React.FC<AssetListProps> = ({ assets: propAssets, onEdit, onTransaction }) => {
  const { assets: contextAssets, deleteAsset, settings, exchangeRates, t } = usePortfolio();
  const assets = propAssets || contextAssets;

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'value', // Default sort by value
    direction: 'desc'
  });

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; symbol: string } | null>(null);

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
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [assets, sortConfig, settings.baseCurrency, exchangeRates]);

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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                {/* 1. Asset (Always Visible) */}
                <SortableHeader label={t('asset')} sortKey="symbol" />

                {/* 2. Mobile: Holdings & Value (Combined) - Hidden on Desktop */}
                <th
                  className="md:hidden pb-3 text-right pr-2 font-medium cursor-pointer"
                  onClick={() => handleSort('value')}
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="flex items-center gap-1 text-slate-500">{t('value')} {sortConfig.key === 'value' && renderSortIcon('value')}</span>
                    {/* Removed Avg Cost label for cleaner look */}
                  </div>
                </th>

                {/* 3. Mobile: Price & Cost (Combined) - Hidden on Desktop */}
                <th
                  className="md:hidden pb-3 text-right pr-2 font-medium cursor-pointer"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="flex items-center gap-1 text-slate-500">{t('currentPrice')} {sortConfig.key === 'price' && renderSortIcon('price')}</span>
                  </div>
                </th>

                {/* Desktop Columns (Hidden on Mobile) */}
                <SortableHeader label={t('currentPrice')} sortKey="price" className="hidden md:table-cell" />
                <SortableHeader label={t('avgCost')} sortKey="cost" className="hidden md:table-cell" />
                <SortableHeader label={t('holdings')} sortKey="quantity" className="hidden md:table-cell" />
                <SortableHeader label={t('value')} sortKey="value" alignRight className="hidden md:table-cell" />

                {/* P&L (Always Visible) */}
                <SortableHeader label={t('statusPnL')} sortKey="pnl" alignRight />

                {/* Actions */}
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
      </Card>

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
