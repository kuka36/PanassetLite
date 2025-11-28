import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { AssetList } from './AssetList';
import { AddAssetModal } from './AddAssetModal';
import { AddTransactionModal } from './AddTransactionModal';
import { Plus, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { Asset } from '../types';
import { TrendModal } from './TrendModal';

export const AssetsView: React.FC = () => {
    const { t, refreshPrices, isRefreshing, assets, transactions, settings, exchangeRates } = usePortfolio();
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAssetIdForTx, setSelectedAssetIdForTx] = useState<string | undefined>(undefined);

    // Filter Assets
    const filteredAssets = assets.filter(asset =>
        asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                            className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-64 shadow-sm"
                        />
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
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                />
            </div>

            <AssetList
                assets={filteredAssets}
                onEdit={handleEditAsset}
                onTransaction={handleRecordTransaction}
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
        </div>
    );
};
