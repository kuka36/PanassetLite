import React, { useState } from 'react';
import { Asset, Currency, AssetType } from '../types/domain';
import { usePortfolio } from '../context/PortfolioContext';
import { X, Tag as TagIcon, Plus, Edit2, TrendingUp, Wallet, Calendar, Hash } from 'lucide-react';
import { TagManagementModal } from './TagManagementModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset;
    onEdit?: (asset: Asset) => void;
}

export const AssetDetailModal: React.FC<Props> = ({ isOpen, onClose, asset, onEdit }) => {
    const { t, editAsset } = usePortfolio();
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);

    if (!isOpen) return null;

    const handleToggleTag = (tag: string) => {
        const currentTags = asset.tags || [];
        let newTags: string[];

        if (currentTags.includes(tag)) {
            newTags = currentTags.filter(t => t !== tag);
        } else {
            newTags = [...currentTags, tag];
        }

        // Update asset
        editAsset({
            ...asset,
            tags: newTags
        });
    };

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

    const formatCurrency = (val: number, curr: Currency) => {
        return val.toLocaleString(undefined, {
            style: 'currency',
            currency: curr,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative animate-fade-in-up">

                    {/* Header with Asset Icon */}
                    <div className="relative h-24 bg-gradient-to-br from-slate-50 to-slate-100 flex justify-center items-center">
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 p-2 bg-white/50 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors backdrop-blur-sm"
                        >
                            <X size={20} />
                        </button>

                        <div className={`w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-bold translate-y-8 ${getTypeColor(asset.type)}`}>
                            {asset.symbol.substring(0, 1)}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="pt-10 pb-6 px-6 flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-slate-800 mb-1">{asset.symbol}</h2>
                        <p className="text-slate-500 font-medium text-sm mb-6">{asset.name}</p>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 w-full mb-6">
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">{t('currentPrice') || 'PRICE'}</span>
                                <span className="font-semibold text-slate-700">
                                    {formatCurrency(asset.currentPrice, asset.currency)}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">{t('totalValue') || 'VALUE'}</span>
                                <span className="font-bold text-slate-800">
                                    {formatCurrency(asset.quantity * asset.currentPrice, asset.currency)}
                                </span>
                            </div>
                        </div>

                        {/* Detail List */}
                        <div className="w-full space-y-3 mb-8">
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Hash size={16} /> <span>{t('quantity')}</span>
                                </div>
                                <span className="font-medium text-slate-700">{asset.quantity.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Wallet size={16} /> <span>{t('costBasis') || 'Avg Cost'}</span>
                                </div>
                                <span className="font-medium text-slate-700">{formatCurrency(asset.avgCost, asset.currency)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Calendar size={16} /> <span>{t('dateAcquired') || 'Acquired'}</span>
                                </div>
                                <span className="font-medium text-slate-700 text-xs">
                                    {asset.dateAcquired ? new Date(asset.dateAcquired).toLocaleDateString() : '-'}
                                </span>
                            </div>
                        </div>

                        {/* Tags Section */}
                        <div className="w-full">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <TagIcon size={12} /> {t('tags') || 'Tags'}
                                </h4>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {asset.tags && asset.tags.length > 0 ? (
                                    asset.tags.map(tag => (
                                        <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium border border-blue-100">
                                            {tag}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-sm text-slate-400 italic">No tags added</span>
                                )}

                                <button
                                    onClick={() => setIsTagModalOpen(true)}
                                    className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-1 group"
                                >
                                    <Plus size={14} className="group-hover:scale-110 transition-transform" />
                                    {t('manage') || 'Manage'}
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Footer Actions */}
                    {onEdit && (
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                            <button
                                onClick={() => { onClose(); onEdit(asset); }}
                                className="text-blue-600 text-sm font-semibold hover:text-blue-700 flex items-center gap-2 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                <Edit2 size={16} />
                                {t('editFullDetails') || 'Edit Full Details'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <TagManagementModal
                isOpen={isTagModalOpen}
                onClose={() => setIsTagModalOpen(false)}
                selectedTags={asset.tags || []}
                onToggleTag={handleToggleTag}
            />
        </>
    );
};
