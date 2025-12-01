import React, { useState } from 'react';
import { Asset, AssetType, Currency, TransactionType, PerformanceMetrics } from '../types/domain';
import { usePortfolio } from '../context/PortfolioContext';
import { convertValue } from '../services/marketData';
import { AssetDetailModal } from './AssetDetailModal';
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, History, ArrowRightLeft, Wifi, PenTool, WifiOff } from 'lucide-react';
import { isManualValuation } from '../utils/assetUtils';

interface AssetRowProps {
    asset: Asset;
    settings: any;
    exchangeRates: any;
    onEdit?: (asset: Asset) => void;
    onTransaction?: (asset: Asset) => void;
    onDelete?: (id: string, symbol: string) => void;
    performance?: PerformanceMetrics;
    onSymbolClick?: (symbol: string) => void;
    t: (key: string) => string;
}

export const AssetRow: React.FC<AssetRowProps> = ({ asset, settings, exchangeRates, onEdit, onTransaction, onDelete, performance, onSymbolClick, t }) => {
    const { updateAssetPrice, addTransaction } = usePortfolio();
    const [editingField, setEditingField] = useState<'price' | 'quantity' | null>(null);
    const [editValue, setEditValue] = useState('');

    const [showDetail, setShowDetail] = useState(false);

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

    const handleUpdateClick = (asset: Asset, field: 'price' | 'quantity') => {
        setEditingField(field);
        setEditValue(field === 'price' ? asset.currentPrice.toString() : asset.quantity.toString());
    };

    const handleSave = (asset: Asset) => {
        if (!editValue) {
            setEditingField(null);
            return;
        }

        const numVal = parseFloat(editValue);
        if (isNaN(numVal)) {
            setEditingField(null);
            return;
        }

        if (editingField === 'price') {
            updateAssetPrice(asset.id, numVal);
        } else if (editingField === 'quantity') {
            const delta = numVal - asset.quantity;
            if (delta !== 0) {
                addTransaction({
                    assetId: asset.id,
                    type: TransactionType.BALANCE_ADJUSTMENT,
                    date: new Date().toISOString(),
                    quantityChange: delta,
                    pricePerUnit: asset.currentPrice,
                    fee: 0,
                    total: 0, // Zero total cost impact as requested
                    note: 'Manual Balance Correction (Inline)'
                });
            }
        }
        setEditingField(null);
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
    const isLive = isLiveMarketData(asset.type);
    const isStale = isAssetStale(asset);

    // Mobile Card Layout
    const MobileCard = () => (
        <div
            className="md:hidden p-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
            onClick={() => onSymbolClick?.(asset.symbol)}
        >
            {/* Header: Asset Info */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDetail(true);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getTypeColor(asset.type)} cursor-pointer hover:shadow-md transition-shadow`}
                    >
                        {asset.symbol.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-800 text-base">{asset.symbol}</div>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{asset.currency}</span>
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[180px]">{asset.name}</div>
                    </div>
                </div>
                {/* Live/Manual Indicator */}
                <div className="flex items-center gap-1 shrink-0">
                    {isLive ? (
                        isStale ? (
                            <span className="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                <WifiOff size={10} />
                            </span>
                        ) : (
                            <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                <Wifi size={10} />
                            </span>
                        )
                    ) : (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            <PenTool size={10} />
                        </span>
                    )}
                </div>
            </div>

            {/* Metrics Grid: 2 columns */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Current Price */}
                <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-1">{t('currentPrice')}</div>
                    <div className="font-semibold text-slate-700">
                        {symbol}{asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </div>
                </div>

                {/* Average Cost */}
                <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-1">{t('avgCost')}</div>
                    <div className="font-semibold text-slate-700">
                        {settings.isPrivacyMode
                            ? '••••••'
                            : `${symbol}${asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                        }
                    </div>
                </div>

                {/* Holdings */}
                <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-1">{t('holdings')}</div>
                    <div className="font-semibold text-slate-700">
                        {settings.isPrivacyMode
                            ? '••••••'
                            : asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })
                        }
                    </div>
                </div>

                {/* Current Value */}
                <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-1">{t('value')}</div>
                    <div className={`font-bold ${isLiability ? 'text-red-700' : 'text-slate-800'}`}>
                        {settings.isPrivacyMode
                            ? '••••••'
                            : `${isLiability ? '-' : ''}${baseCurrencySymbol}${baseValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`
                        }
                    </div>
                </div>

                {/* Performance & P&L Combined */}
                <div className="col-span-2">
                    <div className="text-[10px] text-slate-400 uppercase mb-1">{t('recentReturn')}</div>

                    {/* 1. Total P&L */}
                    <div className="mb-2">
                        {isManual && !pnl ? (
                            <div className="text-xs font-medium text-slate-500">
                                {formatLastUpdated(asset.lastUpdated)}
                            </div>
                        ) : (
                            settings.isPrivacyMode ? (
                                <span className="text-slate-400 font-bold tracking-widest">••••••</span>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className={`font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {pnl >= 0 ? '+' : ''}{symbol}{Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                    <div className={`text-xs font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-500'} bg-opacity-10 px-1.5 py-0.5 rounded ${pnl >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                                        {pnl >= 0 ? '+' : '-'}{Math.abs(pnlPercent).toFixed(2)}%
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* 2. Metrics (Single Line) */}
                    {performance ? (
                        <div className="flex items-center gap-x-3 gap-y-1 text-[10px] flex-wrap text-slate-400">
                            {/* CAGR */}
                            <div className="flex items-center gap-1">
                                <span className="uppercase">CAGR:</span>
                                <span className={`font-semibold ${performance.cumulative && performance.cumulative > 0 ? 'text-green-600' : performance.cumulative && performance.cumulative < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                    {performance.cumulative != null ? (performance.cumulative * 100).toFixed(2) + '%' : '-'}
                                </span>
                            </div>

                            {/* Sync */}
                            {performance.sinceLastSync != null && (
                                <span className="flex gap-1">
                                    <span>{t('sinceLastSync')}:</span>
                                    <span className={`${performance.sinceLastSync > 0 ? 'text-green-600' : performance.sinceLastSync < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                        {performance.sinceLastSync > 0 ? '+' : ''}{(performance.sinceLastSync * 100).toFixed(2)}%
                                    </span>
                                </span>
                            )}

                            {/* Period */}
                            {performance.lastPeriod != null && (
                                <span className="flex gap-1">
                                    <span>{t('lastPeriodPerf')}:</span>
                                    <span className={`${performance.lastPeriod > 0 ? 'text-green-600' : performance.lastPeriod < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                        {performance.lastPeriod > 0 ? '+' : ''}{(performance.lastPeriod * 100).toFixed(2)}%
                                    </span>
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-300 font-medium">-</span>
                    )}
                </div>

            </div>

            {/* Value Row (Full Width in Grid) */}
            <div className="mb-3">
                <div className="text-[10px] text-slate-400 uppercase mb-1">{t('value')}</div>
                <div className={`font-bold ${isLiability ? 'text-red-700' : 'text-slate-800'}`}>
                    {settings.isPrivacyMode
                        ? '••••••'
                        : `${isLiability ? '-' : ''}${baseCurrencySymbol}${baseValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`
                    }
                </div>
            </div>

            {/* Actions */}
            {(onEdit || onTransaction) && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {onTransaction && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTransaction(asset);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                            <ArrowRightLeft size={16} />
                            <span>{t('recordTransaction')}</span>
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(asset);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <Pencil size={16} />
                            <span>{t('editDetails')}</span>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(asset.id, asset.symbol);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('delete')}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    // Desktop Table Row Layout
    const DesktopRow = () => (
        <tr
            className="hidden md:table-row border-b border-slate-50 hover:bg-slate-50/50 transition-colors group cursor-pointer"
            onClick={() => onSymbolClick?.(asset.symbol)}
        >
            {/* 1. Asset Info */}
            <td className="py-4 pl-2">
                <div className="flex items-center gap-3">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDetail(true);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getTypeColor(asset.type)} cursor-pointer hover:shadow-md transition-shadow`}
                    >
                        {asset.symbol.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1">
                            <div className="font-semibold text-slate-800">{asset.symbol}</div>
                            <span className="text-[10px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded">{asset.currency}</span>
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[120px]">{asset.name}</div>
                    </div>
                </div>
            </td>

            {/* Desktop: Price */}
            <td className="py-4">
                {editingField === 'price' ? (
                    <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">{symbol}</span>
                        <input
                            type="number"
                            autoFocus
                            className="w-20 p-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editValue}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave(asset);
                                if (e.key === 'Escape') setEditingField(null);
                            }}
                            onBlur={() => handleSave(asset)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="font-medium text-slate-700 flex items-center gap-2 group/price cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateClick(asset, 'price');
                            }}
                        >
                            {symbol}{asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            <Pencil size={12} className="opacity-0 group-hover/price:opacity-100 text-slate-300" />
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
            <td className="py-4">
                <div className="font-medium text-slate-700">
                    {settings.isPrivacyMode
                        ? '••••••'
                        : `${symbol}${asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                    }
                </div>
            </td>

            {/* Desktop: Quantity */}
            <td className="py-4">
                {editingField === 'quantity' ? (
                    <input
                        type="number"
                        autoFocus
                        className="w-24 p-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(asset);
                            if (e.key === 'Escape') setEditingField(null);
                        }}
                        onBlur={() => handleSave(asset)}
                    />
                ) : (
                    <div className="font-medium text-slate-700 flex items-center gap-2 group/qty cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateClick(asset, 'quantity');
                        }}
                    >
                        {settings.isPrivacyMode
                            ? '••••••'
                            : asset.quantity.toLocaleString()
                        }
                        {!settings.isPrivacyMode && (
                            <Pencil size={12} className="opacity-0 group-hover/qty:opacity-100 text-slate-300" />
                        )}
                    </div>
                )}
            </td>

            {/* Desktop: Performance (Integrated P&L + CAGR + Sync) */}
            <td className="py-4 text-right pr-4 align-top">
                <div className="flex flex-col items-end gap-1">
                    {/* 1. Total P&L */}
                    {isManual && !pnl ? (
                        <div className="text-xs text-slate-400 italic mb-1">
                            {formatLastUpdated(asset.lastUpdated)}
                        </div>
                    ) : (
                        settings.isPrivacyMode ? (
                            <span className="text-slate-400 font-bold tracking-widest mb-1">••••••</span>
                        ) : (
                            <div className={`font-bold text-sm mb-0.5 ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {pnl >= 0 ? '+' : '-'}{symbol}{Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                <span className="ml-1 opacity-80 text-xs">
                                    ({pnl >= 0 ? '+' : '-'}{Math.abs(pnlPercent).toFixed(2)}%)
                                </span>
                            </div>
                        )
                    )}

                    {/* 2. CAGR & Sync Metrics (Single Line) */}
                    {performance ? (
                        <div className="flex items-center gap-x-3 text-[10px] text-slate-400 whitespace-nowrap">
                            {/* CAGR */}
                            <div className="flex items-center gap-1">
                                <span className="uppercase">CAGR:</span>
                                <span className={`${performance.cumulative && performance.cumulative > 0 ? 'text-green-600' : performance.cumulative && performance.cumulative < 0 ? 'text-red-500' : 'text-slate-500'} font-medium`}>
                                    {performance.cumulative != null ? (performance.cumulative * 100).toFixed(2) + '%' : '-'}
                                </span>
                            </div>

                            {/* Sync */}
                            {performance.sinceLastSync != null && (
                                <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                                    <span>{t('sinceLastSync')}:</span>
                                    <span className={`${performance.sinceLastSync > 0 ? 'text-green-600' : performance.sinceLastSync < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                        {performance.sinceLastSync > 0 ? '+' : ''}{(performance.sinceLastSync * 100).toFixed(2)}%
                                    </span>
                                </div>
                            )}

                            {/* Period */}
                            {performance.lastPeriod != null && (
                                <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                                    <span>{t('lastPeriodPerf')}:</span>
                                    <span className={`${performance.lastPeriod > 0 ? 'text-green-600' : performance.lastPeriod < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                        {performance.lastPeriod > 0 ? '+' : ''}{(performance.lastPeriod * 100).toFixed(2)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-300">-</span>
                    )}
                </div>
            </td>

            {/* Desktop: Value */}
            <td className={`py-4 text-right pr-2 font-bold ${isLiability ? 'text-red-700' : 'text-slate-800'}`}>
                {settings.isPrivacyMode
                    ? '••••••'
                    : `${isLiability ? '-' : ''}${baseCurrencySymbol}${baseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
            </td>

            {/* Desktop: P&L Removed (Merged into Performance) */}

            {/* Actions */}
            {(onEdit || onTransaction) && (
                <td className="py-4 text-right pr-2">
                    <div className="flex items-center justify-end gap-2">
                        {onTransaction && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTransaction(asset);
                                }}
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title={t('recordTransaction')}
                            >
                                <ArrowRightLeft size={16} />
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(asset);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t('editDetails')}
                            >
                                <Pencil size={16} />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(asset.id, asset.symbol);
                                }}
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

    // Render mobile card or desktop row based on screen size
    return (
        <>
            <MobileCard />
            <DesktopRow />

            {showDetail && (
                <AssetDetailModal
                    isOpen={showDetail}
                    onClose={() => setShowDetail(false)}
                    asset={asset}
                    onEdit={onEdit}
                />
            )}
        </>
    );
};
