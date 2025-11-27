import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { AssetList } from './AssetList';
import { AddAssetModal } from './AddAssetModal';
import { AddTransactionModal } from './AddTransactionModal';
import { Plus, RefreshCw } from 'lucide-react';
import { Asset } from '../types';

export const AssetsView: React.FC = () => {
    const { t, refreshPrices, isRefreshing } = usePortfolio();
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);

    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAssetIdForTx, setSelectedAssetIdForTx] = useState<string | undefined>(undefined);

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
                    <button
                        onClick={() => refreshPrices()}
                        disabled={isRefreshing}
                        className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl shadow-sm transition-all"
                        title={t('refreshPrices')}
                    >
                        <RefreshCw size={20} className={isRefreshing ? "animate-spin text-blue-600" : "text-slate-400"} />
                    </button>
                    <button
                        onClick={handleOpenAddAsset}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} /> {t('addNewAsset')}
                    </button>
                </div>
            </div>

            <AssetList
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
        </div>
    );
};
