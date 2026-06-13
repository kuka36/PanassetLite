import React, { Suspense, lazy, useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { AssetList } from './AssetList';
import { AddAssetModal } from './AddAssetModal';
import { AddTransactionModal } from './AddTransactionModal';
import { Plus, RefreshCw, Search, TrendingUp, Filter, Check } from 'lucide-react';
import { Asset } from '../types/domain';
import { StorageService } from '../services/StorageService';

const TrendModal = lazy(() =>
  import('./TrendModal').then(m => ({ default: m.TrendModal }))
);

export const AssetsView: React.FC = () => {
    const { t, refreshPrices, isRefreshing, assets, transactions, settings, exchangeRates } = usePortfolio();
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(() => StorageService.getSelectedTag());
    const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);

    // Save selected tag when it changes
    useEffect(() => {
        StorageService.saveSelectedTag(selectedTag);
    }, [selectedTag]);

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAssetIdForTx, setSelectedAssetIdForTx] = useState<string | undefined>(undefined);

    const handleSymbolClick = (symbol: string) => {
        if (searchQuery === symbol) {
            setSearchQuery('');
        } else {
            setSearchQuery(symbol);
        }
    };

    // Filter Assets
    const filteredAssets = assets.filter(asset => {
        const matchesSearch = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesTag = selectedTag ? asset.tags?.includes(selectedTag) : true;
        return matchesSearch && matchesTag;
    });

    // Unique Tags for Filter UI
    const allTags = Array.from(new Set(assets.flatMap(a => a.tags || []))).sort();

    // Asset CRUD Handlers
    const handleOpenAddAsset = () => {
        setEditingAsset(null);
        setIsAssetModalOpen(true);
    };

    const handleEditAsset = (asset: Asset) => {
        setEditingAsset(asset);
        setIsAssetModalOpen(true);
    };

    // Transaction Handler - Now only called from AssetList
    const handleRecordTransaction = (asset: Asset) => {
        setSelectedAssetIdForTx(asset.id);
        setIsTxModalOpen(true);
    };

    const closeAssetModal = () => {
        setIsAssetModalOpen(false);
        setEditingAsset(null);
    };

    const closeTxModal = () => {
        setIsTxModalOpen(false);
        setSelectedAssetIdForTx(undefined);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('assetsManagement')}</h1>
                    <p className="text-slate-500">{t('assetsSubtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative hidden md:block mr-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('searchAssets')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-72 shadow-sm"
                        />

                        {/* Tag Filter Button inside Input */}
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            <button
                                onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
                                className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${selectedTag ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                                title={selectedTag ? `Filtered by: ${selectedTag}` : "Filter by tag"}
                            >
                                <Filter size={16} className={selectedTag ? "fill-current" : ""} />
                            </button>
                        </div>

                        {/* Dropdown Menu */}
                        {isTagFilterOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsTagFilterOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                                    <div className="py-1 max-h-60 overflow-y-auto">
                                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-50 mb-1">
                                            {t('filterByTag') || 'Filter by Tag'}
                                        </div>

                                        <button
                                            onClick={() => { setSelectedTag(null); setIsTagFilterOpen(false); }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${!selectedTag ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                                        >
                                            <span>{t('allAssets') || 'All Assets'}</span>
                                            {!selectedTag && <Check size={14} />}
                                        </button>

                                        {allTags.map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => { setSelectedTag(tag); setIsTagFilterOpen(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedTag === tag ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                                            >
                                                <span className="truncate">{tag}</span>
                                                {selectedTag === tag && <Check size={14} />}
                                            </button>
                                        ))}

                                        {allTags.length === 0 && (
                                            <div className="px-4 py-3 text-xs text-slate-400 text-center italic">
                                                No tags found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => refreshPrices()}
                        disabled={isRefreshing}
                        className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl shadow-sm transition-all"
                        title={t('refreshPrices')}
                    >
                        <RefreshCw size={20} className={isRefreshing ? "animate-spin text-blue-600" : "text-slate-400"} />
                    </button>
                    <button
                        onClick={() => setIsTrendModalOpen(true)}
                        className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl shadow-sm transition-all"
                        title={t('showTrend')}
                    >
                        <TrendingUp size={20} className="text-slate-400" />
                    </button>
                    <button
                        onClick={handleOpenAddAsset}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} /> <span className="hidden sm:inline">{t('addNewAsset')}</span>
                        <span className="sm:hidden">{t('addNewAsset').split(' ')[0]}</span>
                    </button>
                </div>
            </div>

            {/* Mobile Search Bar (Visible only on small screens) */}
            <div className="relative md:hidden">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder={t('searchAssets')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                />

                {/* Tag Filter Button inside Input (Mobile) */}
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <button
                        onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
                        className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${selectedTag ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                        title={selectedTag ? `Filtered by: ${selectedTag}` : "Filter by tag"}
                    >
                        <Filter size={16} className={selectedTag ? "fill-current" : ""} />
                    </button>
                </div>

                {/* Dropdown Menu (Mobile) */}
                {isTagFilterOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsTagFilterOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                            <div className="py-1 max-h-60 overflow-y-auto">
                                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-50 mb-1">
                                    {t('filterByTag') || 'Filter by Tag'}
                                </div>

                                <button
                                    onClick={() => { setSelectedTag(null); setIsTagFilterOpen(false); }}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${!selectedTag ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                                >
                                    <span>{t('allAssets') || 'All Assets'}</span>
                                    {!selectedTag && <Check size={14} />}
                                </button>

                                {allTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => { setSelectedTag(tag); setIsTagFilterOpen(false); }}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedTag === tag ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                                    >
                                        <span className="truncate">{tag}</span>
                                        {selectedTag === tag && <Check size={14} />}
                                    </button>
                                ))}

                                {allTags.length === 0 && (
                                    <div className="px-4 py-3 text-xs text-slate-400 text-center italic">
                                        No tags found
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>


            <AssetList
                assets={filteredAssets}
                onEdit={handleEditAsset}
                onTransaction={handleRecordTransaction}
                onSymbolClick={handleSymbolClick}
            />

            {/* Modals */}
            <AddAssetModal
                isOpen={isAssetModalOpen}
                onClose={closeAssetModal}
                initialAsset={editingAsset}
            />
            <AddTransactionModal
                isOpen={isTxModalOpen}
                onClose={closeTxModal}
                preselectedAssetId={selectedAssetIdForTx}
            />
            {isTrendModalOpen && (
                <Suspense fallback={null}>
                    <TrendModal
                        isOpen={isTrendModalOpen}
                        onClose={() => setIsTrendModalOpen(false)}
                        assets={filteredAssets}
                        transactions={transactions}
                        baseCurrency={settings.baseCurrency}
                        exchangeRates={exchangeRates}
                        isPrivacyMode={settings.isPrivacyMode}
                        t={t}
                    />
                </Suspense>
            )}
        </div>
    );
};
