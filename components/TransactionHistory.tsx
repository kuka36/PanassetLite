


import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/ConfirmModal';
import { TransactionType, Currency } from '../types';
import { Filter, Download, ArrowDownLeft, ArrowUpRight, DollarSign, Trash2, ArrowRightLeft, CreditCard, RefreshCw } from 'lucide-react';

export const TransactionHistory: React.FC = () => {
  const { transactions, assets, deleteTransaction, t } = usePortfolio();
  const [selectedAssetId, setSelectedAssetId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Helper to find asset info (handle deleted assets gracefully)
  const getAssetInfo = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? { symbol: asset.symbol, name: asset.name, currency: asset.currency } : { symbol: 'UNKNOWN', name: 'Deleted Asset', currency: Currency.USD };
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (selectedAssetId !== 'all' && t.assetId !== selectedAssetId) return false;
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        return true;
      })
      // Sort by Date Time Descending (Newest first)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedAssetId, filterType, startDate, endDate]);

  const getTypeStyle = (type: TransactionType) => {
    switch (type) {
      case TransactionType.BUY: return 'bg-blue-100 text-blue-700';
      case TransactionType.DEPOSIT: return 'bg-blue-50 text-blue-600';
      case TransactionType.SELL: return 'bg-purple-100 text-purple-700';
      case TransactionType.WITHDRAWAL: return 'bg-purple-50 text-purple-600';
      case TransactionType.DIVIDEND: return 'bg-green-100 text-green-700';
      case TransactionType.BORROW: return 'bg-amber-100 text-amber-700';
      case TransactionType.REPAY: return 'bg-indigo-100 text-indigo-700';
      case TransactionType.BALANCE_ADJUSTMENT: return 'bg-slate-100 text-slate-700 border border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeIcon = (type: TransactionType) => {
     switch (type) {
      case TransactionType.BUY: 
      case TransactionType.DEPOSIT:
          return <ArrowDownLeft size={16} />;
      case TransactionType.SELL: 
      case TransactionType.WITHDRAWAL:
          return <ArrowUpRight size={16} />;
      case TransactionType.DIVIDEND: return <DollarSign size={16} />;
      case TransactionType.BORROW: return <CreditCard size={16} />;
      case TransactionType.REPAY: return <ArrowRightLeft size={16} />;
      case TransactionType.BALANCE_ADJUSTMENT: return <RefreshCw size={14} />;
      default: return null;
    }
  };

  const getCurrencySymbol = (curr: Currency) => {
      switch(curr) {
          case Currency.USD: return '$';
          case Currency.CNY: return '¥';
          case Currency.HKD: return 'HK$';
          default: return '$';
      }
  };

  const formatDateTime = (dateStr: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString(undefined, {
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
  };

  const handleExportCSV = () => {
     const headers = [t('date'), t('type'), t('asset'), t('quantity'), t('pricePerUnit'), t('fees'), t('total')];
     const rows = filteredTransactions.map(t => {
         const info = getAssetInfo(t.assetId);
         return [
             t.date,
             t.type,
             info.symbol,
             t.quantityChange,
             t.pricePerUnit,
             t.fee,
             t.total
         ].join(",");
     });
     
     const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", "transactions.csv");
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  // Get unique assets that are actually in transactions or currently in portfolio
  const availableAssets = useMemo(() => {
      const assetMap = new Map();
      assets.forEach(a => assetMap.set(a.id, a));
      return Array.from(assetMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [assets]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('transactionHistory')}</h1>
            <p className="text-slate-500">{t('historySubtitle')}</p>
        </div>
        <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-xl shadow-sm flex items-center gap-2 transition-colors"
        >
            <Download size={18}/> <span className="hidden sm:inline">{t('exportCSV')}</span>
        </button>
      </div>

      <Card>
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-100">
            <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('asset')}</label>
                <div className="relative">
                    <select
                        value={selectedAssetId}
                        onChange={(e) => setSelectedAssetId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                        <option value="all">{t('allAssets')}</option>
                        {availableAssets.map(a => (
                            <option key={a.id} value={a.id}>{a.symbol} - {a.name}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
                </div>
            </div>
            
             <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('type')}</label>
                <div className="relative">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                        <option value="all">{t('allTypes')}</option>
                        <option value={TransactionType.BUY}>{t('tx_BUY')}</option>
                        <option value={TransactionType.SELL}>{t('tx_SELL')}</option>
                        <option value={TransactionType.DIVIDEND}>{t('tx_DIVIDEND')}</option>
                        <option value={TransactionType.BALANCE_ADJUSTMENT}>Adjustment</option>
                    </select>
                    <Filter className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('fromDate')}</label>
                <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('toDate')}</label>
                <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                    <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                        <th className="pb-3 pl-2 font-medium">{t('date')}</th>
                        <th className="pb-3 font-medium">{t('asset')}</th>
                        <th className="pb-3 font-medium">{t('type')}</th>
                        <th className="pb-3 font-medium text-right">{t('quantity')}</th>
                        <th className="pb-3 font-medium text-right">{t('pricePerUnit')}</th>
                        <th className="pb-3 font-medium text-right">{t('fees')}</th>
                        <th className="pb-3 font-medium text-right pr-2">{t('total')}</th>
                        <th className="pb-3 font-medium text-right pr-2">{t('actions')}</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {filteredTransactions.map(tx => {
                        const assetInfo = getAssetInfo(tx.assetId);
                        const currencySymbol = getCurrencySymbol(assetInfo.currency);
                        
                        // Quantity Logic
                        const isAdjustment = tx.type === TransactionType.BALANCE_ADJUSTMENT;
                        const qtyChange = tx.quantityChange || 0;
                        const displayQty = isAdjustment 
                            ? (qtyChange > 0 ? `+${qtyChange.toLocaleString()}` : qtyChange.toLocaleString())
                            : Math.abs(qtyChange).toLocaleString();
                        
                        // Color logic for Adjustment
                        const qtyColorClass = isAdjustment 
                            ? (qtyChange >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold') 
                            : 'text-slate-700';

                        return (
                            <tr key={tx.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                <td className="py-4 pl-2 text-slate-600 font-mono text-xs whitespace-nowrap">
                                    {formatDateTime(tx.date)}
                                </td>
                                <td className="py-4">
                                    <div className="font-semibold text-slate-800">{assetInfo.symbol}</div>
                                    <div className="text-xs text-slate-400 hidden sm:block">{assetInfo.name}</div>
                                </td>
                                <td className="py-4">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${getTypeStyle(tx.type)}`}>
                                        {getTypeIcon(tx.type)}
                                        {t(`tx_${tx.type}`) || tx.type}
                                    </span>
                                </td>
                                <td className={`py-4 text-right font-medium ${qtyColorClass}`}>
                                    {displayQty !== '0' ? displayQty : '-'}
                                </td>
                                <td className="py-4 text-right text-slate-600 whitespace-nowrap">
                                    {currencySymbol}{tx.pricePerUnit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </td>
                                <td className="py-4 text-right text-slate-500 whitespace-nowrap">
                                    {tx.fee > 0 ? `${currencySymbol}${tx.fee.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-4 text-right pr-2 font-bold text-slate-800 whitespace-nowrap">
                                    {currencySymbol}{tx.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </td>
                                <td className="py-4 text-right pr-2">
                                    <button 
                                        onClick={() => setDeleteId(tx.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title={t('deleteTransaction')}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredTransactions.length === 0 && (
                        <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                                {t('noTransactions')}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </Card>
      
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteTransaction(deleteId)}
        title={t('deleteTransaction')}
        message={t('confirmDeleteTransaction')}
        confirmText={t('delete')}
        isDanger
      />
    </div>
  );
};