
import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/ConfirmModal';
import { TransactionType, Currency } from '../types';
import { Filter, ArrowDownLeft, ArrowUpRight, DollarSign, Trash2, ArrowRightLeft, CreditCard, RefreshCw, ChevronDown, ChevronUp, Calendar, Hash, Edit3 } from 'lucide-react';
import { EditTransactionModal } from './EditTransactionModal';
import { Combobox } from './ui/Combobox';

export const TransactionHistory: React.FC = () => {
    const { transactions, assets, deleteTransaction, settings, t } = usePortfolio();
    const [selectedAssetId, setSelectedAssetId] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Mobile Filter Toggle State
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

    // Helper to find asset info (handle deleted assets gracefully)
    const getAssetInfo = (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        return asset ? { symbol: asset.symbol, name: asset.name, currency: asset.currency } : { symbol: 'UNKNOWN', name: 'Deleted Asset', currency: Currency.USD };
    };

    const filteredTransactions = useMemo(() => {
        return transactions
            .filter(t => {
                if (!t) return false;
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
        switch (curr) {
            case Currency.USD: return '$';
            case Currency.CNY: return '¥';
            case Currency.HKD: return 'HK$';
            default: return '$';
        }
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString(undefined, {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
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
            </div>

            <Card>
                {/* Mobile Filter Toggle */}
                <div className="md:hidden flex justify-end mb-2">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        <Filter size={16} />
                        Filter
                        {isFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                {/* Filters Grid */}
                <div className={`${isFilterOpen ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-100 animate-fade-in`}>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('asset')}</label>
                        <Combobox
                            options={[
                                { value: 'all', label: t('allAssets') },
                                ...availableAssets.map(a => ({ value: a.id, label: `${a.symbol} - ${a.name}` }))
                            ]}
                            value={selectedAssetId}
                            onChange={setSelectedAssetId}
                            placeholder={t('selectAssetPlaceholder')}
                        />
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
                                <option value={TransactionType.BALANCE_ADJUSTMENT}>{t('tx_BALANCE_ADJUSTMENT')}</option>
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

                {/* --- Mobile List View --- */}
                <div className="md:hidden space-y-3">
                    {filteredTransactions.map(tx => {
                        if (!tx) return null;
                        const assetInfo = getAssetInfo(tx.assetId);
                        const currencySymbol = getCurrencySymbol(assetInfo.currency);

                        // Safe Parsing
                        const safePrice = Number(tx.pricePerUnit || 0);
                        const safeTotal = Number(tx.total || 0);
                        const qtyChange = Number(tx.quantityChange || 0);

                        const isAdjustment = tx.type === TransactionType.BALANCE_ADJUSTMENT;

                        const displayQty = isAdjustment
                            ? (qtyChange > 0 ? `+${qtyChange.toLocaleString()}` : qtyChange.toLocaleString())
                            : Math.abs(qtyChange).toLocaleString();

                        const qtyColorClass = isAdjustment
                            ? (qtyChange >= 0 ? 'text-green-600' : 'text-red-600')
                            : 'text-slate-700';

                        return (
                            <div key={tx.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative group">
                                {/* Delete Action (Top Right) */}
                                <button
                                    onClick={() => setDeleteId(tx.id)}
                                    className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>

                                {/* Edit Action (Top Right - Left of Delete) */}
                                <button
                                    onClick={() => setEditingTransaction(tx)}
                                    className="absolute top-3 right-10 p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit3 size={16} />
                                </button>

                                <div className="flex justify-between items-start mb-2 pr-8">
                                    <div>
                                        <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                            {assetInfo.symbol}
                                            <span className="text-xs font-normal text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                                {assetInfo.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                            <Calendar size={12} />
                                            {formatDateTime(tx.date)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-3">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${getTypeStyle(tx.type)}`}>
                                        {getTypeIcon(tx.type)}
                                        {t(`tx_${tx.type}`) || tx.type}
                                    </span>
                                    <div className="text-right">
                                        <div className={`font-bold text-lg text-slate-800`}>
                                            {settings.isPrivacyMode
                                                ? '••••••'
                                                : `${currencySymbol}${safeTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            }
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-400 uppercase mb-0.5">{t('quantity')}</span>
                                        <span className={`font-mono font-medium ${qtyColorClass}`}>
                                            {settings.isPrivacyMode ? '••••••' : displayQty}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-xs text-slate-400 uppercase mb-0.5">{t('pricePerUnit')}</span>
                                        <span className="font-mono text-slate-600">
                                            {currencySymbol}{safePrice.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* --- Desktop Table View --- */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                                <th className="pb-3 pl-2 font-medium">
                                    {filterType === TransactionType.BALANCE_ADJUSTMENT ? t('dateRefreshed') : t('date')}
                                </th>
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
                                if (!tx) return null;
                                const assetInfo = getAssetInfo(tx.assetId);
                                const currencySymbol = getCurrencySymbol(assetInfo.currency);

                                // Safe Parsing
                                const safePrice = Number(tx.pricePerUnit || 0);
                                const safeFee = Number(tx.fee || 0);
                                const safeTotal = Number(tx.total || 0);
                                const qtyChange = Number(tx.quantityChange || 0);

                                const isAdjustment = tx.type === TransactionType.BALANCE_ADJUSTMENT;
                                const displayQty = isAdjustment
                                    ? (qtyChange > 0 ? `+${qtyChange.toLocaleString()}` : qtyChange.toLocaleString())
                                    : Math.abs(qtyChange).toLocaleString();

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
                                            {settings.isPrivacyMode ? '••••••' : (displayQty !== '0' ? displayQty : '-')}
                                        </td>
                                        <td className="py-4 text-right text-slate-600 whitespace-nowrap">
                                            {currencySymbol}{safePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-4 text-right text-slate-500 whitespace-nowrap">
                                            {safeFee > 0 ? `${currencySymbol}${safeFee.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="py-4 text-right pr-2 font-bold text-slate-800 whitespace-nowrap">
                                            {settings.isPrivacyMode
                                                ? '••••••'
                                                : `${currencySymbol}${safeTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            }
                                        </td>
                                        <td className="py-4 text-right pr-2">
                                            <button
                                                onClick={() => setEditingTransaction(tx)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-1"
                                                title={t('editTransaction')}
                                            >
                                                <Edit3 size={16} />
                                            </button>
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
                        </tbody>
                    </table>
                </div>

                {filteredTransactions.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic">
                        {t('noTransactions')}
                    </div>
                )}

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

            <EditTransactionModal
                isOpen={!!editingTransaction}
                onClose={() => setEditingTransaction(null)}
                transaction={editingTransaction}
            />
        </div>
    );
};
