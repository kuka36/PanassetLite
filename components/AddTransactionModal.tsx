
import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { TransactionType, VoiceParseResult, AssetType } from '../types';
import { VoiceInput } from './ui/VoiceInput';
import { X, Save, Calendar, DollarSign, Hash, ArrowRightLeft } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedAssetId?: string;
}

export const AddTransactionModal: React.FC<Props> = ({ isOpen, onClose, preselectedAssetId }) => {
  const { assets, addTransaction, t } = usePortfolio();
  
  const [assetId, setAssetId] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.BUY);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');

  // Helper to determine available actions based on asset type
  const getAvailableActions = (assetType?: AssetType) => {
      const common = [TransactionType.BUY, TransactionType.SELL];
      if (!assetType) return common;
      
      switch(assetType) {
          case AssetType.STOCK:
          case AssetType.FUND:
              return [...common, TransactionType.DIVIDEND];
          case AssetType.LIABILITY:
              return [TransactionType.BORROW, TransactionType.REPAY];
          case AssetType.CASH:
              return [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL];
          default:
              return [...common, TransactionType.DIVIDEND];
      }
  };

  useEffect(() => {
    if (isOpen) {
        setAssetId(preselectedAssetId || '');
        const asset = assets.find(a => a.id === preselectedAssetId);
        // Set default type based on asset
        if (asset?.type === AssetType.LIABILITY) setType(TransactionType.BORROW);
        else if (asset?.type === AssetType.CASH) setType(TransactionType.DEPOSIT);
        else setType(TransactionType.BUY);
        
        setDate(new Date().toISOString().split('T')[0]);
        setQuantity('');
        setPrice('');
        setFee('0');
    }
  }, [isOpen, preselectedAssetId, assets]);

  if (!isOpen) return null;

  const availableAssets = assets.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const selectedAsset = assets.find(a => a.id === assetId);
  const actions = getAvailableActions(selectedAsset?.type);

  const handleVoiceData = (data: VoiceParseResult) => {
      if (data.symbol) {
          const match = availableAssets.find(a => a.symbol === data.symbol);
          if (match) setAssetId(match.id);
      }
      if (data.txType) setType(data.txType);
      if (data.quantity) setQuantity(data.quantity.toString());
      if (data.price) setPrice(data.price.toString());
      if (data.date) setDate(data.date);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qtyNum = parseFloat(quantity);
    const priceNum = parseFloat(price);
    const feeNum = parseFloat(fee) || 0;

    if (!assetId || isNaN(qtyNum) || isNaN(priceNum)) return;

    // Sign Logic for QuantityChange based on Type
    let qtyChange = qtyNum;
    if (type === TransactionType.SELL || type === TransactionType.WITHDRAWAL || type === TransactionType.REPAY) {
        qtyChange = -qtyNum;
    }

    addTransaction({
      assetId,
      type,
      date,
      quantityChange: qtyChange,
      pricePerUnit: priceNum,
      fee: feeNum,
      total: (qtyNum * priceNum) + feeNum // Cash flow estimate
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
        
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><ArrowRightLeft size={18}/></div>
             <h2 className="text-lg font-bold text-slate-800">{t('recordTransaction')}</h2>
          </div>
          <div className="flex items-center gap-2">
             {!preselectedAssetId && <VoiceInput mode="TRANSACTION" onResult={handleVoiceData} />}
             <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Asset Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('asset')}</label>
            <select 
                value={assetId} 
                onChange={(e) => setAssetId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                required
                disabled={!!preselectedAssetId}
            >
                <option value="" disabled>{t('selectAssetPlaceholder')}</option>
                {availableAssets.map(asset => (
                    <option key={asset.id} value={asset.id}>
                        {asset.symbol} - {asset.name}
                    </option>
                ))}
            </select>
          </div>

          {/* Transaction Type */}
          <div>
             <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('action')}</label>
             <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
                {actions.map((tKey) => (
                    <button
                        key={tKey}
                        type="button"
                        onClick={() => setType(tKey)}
                        className={`flex-1 min-w-[60px] py-2 text-[10px] sm:text-xs font-bold rounded-md transition-all ${type === tKey ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tKey}
                    </button>
                ))}
             </div>
          </div>

          {/* Date */}
          <div>
             <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('date')}</label>
             <div className="relative">
                 <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                 <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                 />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Quantity */}
             <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('quantity')}</label>
                <div className="relative">
                    <Hash className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                    <input 
                        type="number" step="any" placeholder="0.00"
                        value={quantity} onChange={e => setQuantity(e.target.value)}
                        className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                    />
                </div>
             </div>
             
             {/* Price */}
             <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('pricePerUnit')}</label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                    <input 
                        type="number" step="any" placeholder="0.00"
                        value={price} onChange={e => setPrice(e.target.value)}
                        className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                    />
                </div>
             </div>
          </div>

          {/* Fees */}
          <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('fees')}</label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                    <input 
                        type="number" step="any" placeholder="0.00"
                        value={fee} onChange={e => setFee(e.target.value)}
                        className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
          </div>

          {/* Summary */}
          <div className="p-3 bg-slate-100 rounded-lg flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">{t('totalEstimate')}</span>
              <span className="font-bold text-slate-800">
                  ${((parseFloat(quantity) || 0) * (parseFloat(price) || 0) + (parseFloat(fee) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
              </span>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18}/>
            {t('recordTransaction')}
          </button>

        </form>
      </div>
    </div>
  );
};
