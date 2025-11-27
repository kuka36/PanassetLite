import React, { useState } from 'react';
import { Asset, AssetType, Currency } from '../types';
import { usePortfolio } from '../context/PortfolioContext';
import { convertValue } from '../services/marketData';
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, History, ArrowUp, ArrowDown, ArrowRightLeft, Wifi, PenTool, WifiOff } from 'lucide-react';

interface AssetRowProps {
    asset: Asset;
    settings: any;
    exchangeRates: any;
    onEdit?: (asset: Asset) => void;
    onTransaction?: (asset: Asset) => void;
    onDelete?: (id: string, symbol: string) => void;
    t: (key: string) => string;
}

export const AssetRow: React.FC<AssetRowProps> = ({ asset, settings, exchangeRates, onEdit, onTransaction, onDelete, t }) => {
    const { updateAssetPrice } = usePortfolio();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [newValuation, setNewValuation] = useState('');

    const getTypeColor = (type: AssetType) => {
        switch (type) {
            case AssetType.STOCK: return 'bg-blue-100 text-blue-700';
            case AssetType.CRYPTO: return 'bg-purple-100 text-purple-700';
            case AssetType.FUND: return 'bg-orange-100 text-orange-700';
            case AssetType.CASH: return 'bg-green-100 text-green-700';
            case AssetType.REAL_ESTATE: return 'bg-amber-100 text-amber-800';
            case AssetType.LIABILITY: return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const isManualValuation = (type: AssetType) =>
        type === AssetType.REAL_ESTATE || type === AssetType.LIABILITY || type === AssetType.OTHER || type === AssetType.CASH;

    const isLiveMarketData = (type: AssetType) =>
        type === AssetType.STOCK || type === AssetType.CRYPTO || type === AssetType.FUND;

    const getCurrencySymbol = (curr: Currency) => {
        switch (curr) {
            case Currency.USD: return '$';
            case Currency.CNY: return '¥';
            case Currency.HKD: return 'HK$';
            default: return '$';
        }
    };

    const handleUpdateClick = (asset: Asset) => {
        setUpdatingId(asset.id);
        setNewValuation(asset.currentPrice.toString());
    };

    const handleSaveValuation = (id: string) => {
        const price = parseFloat(newValuation);
        if (!isNaN(price)) {
            updateAssetPrice(id, price);
            setUpdatingId(null);
        }
    };

    const formatLastUpdated = (timestamp?: number) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const isAssetStale = (asset: Asset) => {
        if (!isLiveMarketData(asset.type)) return false;
        const threshold = 30 * 60 * 1000; // 30 minutes
        return (Date.now() - (asset.lastUpdated || 0)) > threshold;
    };

    const symbol = getCurrencySymbol(asset.currency);
    const baseCurrencySymbol = getCurrencySymbol(settings.baseCurrency);

    const currentValue = asset.quantity * asset.currentPrice;
    const baseValue = convertValue(currentValue, asset.currency, settings.baseCurrency, exchangeRates);

    const costBasis = asset.quantity * asset.avgCost;
    const pnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    const isLiability = asset.type === AssetType.LIABILITY;
    const isManual = isManualValuation(asset.type);
    const isUpdating = updatingId === asset.id;
    const isLive = isLiveMarketData(asset.type);
    const isStale = isAssetStale(asset);

    return (
        <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">

            {/* 1. Asset Info */}
            <td className="py-4 pl-2">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getTypeColor(asset.type)}`}>
                        {asset.symbol.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1">
                            <div className="font-semibold text-slate-800 truncate max-w-[80px] md:max-w-none">{asset.symbol}</div>
                            <span className="hidden md:inline-block text-[10px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded">{asset.currency}</span>
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[90px] md:max-w-[120px]">{asset.name}</div>
                    </div>
                </div>
            </td>

            {/* 2. Mobile: Holdings & Value */}
            <td className="md:hidden py-4 text-right pr-2">
                <div className={`font-bold text-sm ${isLiability ? 'text-red-700' : 'text-slate-800'}`}>
                    {settings.isPrivacyMode
                        ? '••••••'
                        : `${isLiability ? '-' : ''}${baseCurrencySymbol}${baseValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`
                    }
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                    {settings.isPrivacyMode
                        ? '••••••'
                        : asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })
                    }
                </div>
            </td>

            {/* 3. Mobile: Price & Cost */}
            <td className="md:hidden py-4 text-right pr-2">
                <div className="font-medium text-sm text-slate-700">
                    {symbol}{asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                    {settings.isPrivacyMode ? '••••••' : `${symbol}${asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
            </td>

            {/* Desktop: Price */}
            <td className="hidden md:table-cell py-4">
                {isUpdating ? (
                    <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">{symbol}</span>
                        <input
                            type="number"
                            autoFocus
                            className="w-20 p-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={newValuation}
                            onChange={(e) => setNewValuation(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveValuation(asset.id);
                                if (e.key === 'Escape') setUpdatingId(null);
                            }}
                            onBlur={() => handleSaveValuation(asset.id)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="font-medium text-slate-700 flex items-center gap-2">
                            {symbol}{asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            {onEdit && (
                                <button
                                    onClick={() => handleUpdateClick(asset)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-blue-600"
                                    title={t('updatePrice')}
                                >
                                    <History size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            {isLive ? (
                                isStale ? (
                                    <span className="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title={t('dataStale')}>
                                        <WifiOff size={10} /> {t('offline')}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded border border-green-100" title={t('liveData')}>
                                        <Wifi size={10} /> {t('live')}
                                    </span>
                                )
                            ) : (
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title={t('manualValuation')}>
                                    <PenTool size={10} /> {t('manual')}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </td>

            {/* Desktop: Cost */}
            <td className="hidden md:table-cell py-4">
                <div className="font-medium text-slate-700">
                    {settings.isPrivacyMode
                        ? '••••••'
                        : `${symbol}${asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                    }
                </div>
            </td>

            {/* Desktop: Quantity */}
            <td className="hidden md:table-cell py-4">
                <div className="font-medium text-slate-700">
                    {settings.isPrivacyMode
                        ? '••••••'
                        : asset.quantity.toLocaleString()
                    }
                </div>
            </td>

            {/* Desktop: Value */}
            <td className={`hidden md:table-cell py-4 text-right pr-2 font-bold ${isLiability ? 'text-red-700' : 'text-slate-800'}`}>
                {settings.isPrivacyMode
                    ? '••••••'
                    : `${isLiability ? '-' : ''}${baseCurrencySymbol}${baseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
            </td>

            {/* P&L - Always Visible */}
            <td className="py-4 text-right pr-2">
                {isManual && !pnl ? (
                    <div className="text-right">
                        <div className="text-xs font-medium text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded-md">
                            {t('lastUpdated')}<span className="hidden md:inline">: {formatLastUpdated(asset.lastUpdated)}</span>
                        </div>
                    </div>
                ) : (
                    settings.isPrivacyMode ? (
                        <div className="text-right">
                            <span className="text-slate-400 font-bold tracking-widest">••••••</span>
                        </div>
                    ) : (
                        <>
                            <div className={`flex items-center justify-end gap-1 font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {pnl >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {Math.abs(pnlPercent).toFixed(2)}%
                            </div>
                            <div className={`text-xs ${pnl >= 0 ? 'text-green-600/70' : 'text-red-500/70'}`}>
                                {pnl >= 0 ? '+' : '-'}{symbol}{Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                        </>
                    )
                )}
            </td>

            {/* Actions - Always Visible but potentially tight on mobile */}
            {(onEdit || onTransaction) && (
                <td className="py-4 text-right pr-2">
                    <div className="flex items-center justify-end gap-1 md:gap-2">
                        {onTransaction && (
                            <button
                                onClick={() => onTransaction(asset)}
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title={t('recordTransaction')}
                            >
                                <ArrowRightLeft size={16} />
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={() => onEdit(asset)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t('editDetails')}
                            >
                                <Pencil size={16} />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(asset.id, asset.symbol)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={t('delete')}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </td>
            )}
        </tr>
    );
};
