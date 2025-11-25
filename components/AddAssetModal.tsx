
import React, { useState, useEffect } from 'react';
import { Asset, AssetType, Currency, VoiceParseResult, TransactionType, AssetMetadata } from '../types';
import { usePortfolio } from '../context/PortfolioContext';
import { VoiceInput } from './ui/VoiceInput';
import { X, Save, TrendingUp, Bitcoin, PieChart, Building, Banknote, CreditCard, Box, Calendar, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialAsset?: Asset | null;
}

export const AddAssetModal: React.FC<Props> = ({ isOpen, onClose, initialAsset }) => {
  const { addAsset, editAsset, addTransaction, t } = usePortfolio();
  
  // Form State
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<AssetType>(AssetType.STOCK);
  
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState(''); // Avg Cost / Initial Price
  const [currentVal, setCurrentVal] = useState(''); // For manual assets
  const [currency, setCurrency] = useState<Currency>(Currency.USD);
  const [dateAcquired, setDateAcquired] = useState(new Date().toISOString().split('T')[0]);

  // Balance Correction State
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [actualQuantity, setActualQuantity] = useState('');

  const ASSET_TYPES = [
    { id: AssetType.STOCK, label: t('type_stock'), icon: TrendingUp, desc: 'US, HK, CN Stocks', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: AssetType.CRYPTO, label: t('type_crypto'), icon: Bitcoin, desc: 'Coins & Tokens', color: 'bg-purple-50 text-purple-600 border-purple-200' },
    { id: AssetType.FUND, label: t('type_fund'), icon: PieChart, desc: 'Mutual Funds', color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { id: AssetType.REAL_ESTATE, label: t('type_real_estate'), icon: Building, desc: 'Property', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { id: AssetType.CASH, label: t('type_cash'), icon: Banknote, desc: 'Fiat Reserves', color: 'bg-green-50 text-green-600 border-green-200' },
    { id: AssetType.LIABILITY, label: t('type_liability'), icon: CreditCard, desc: 'Loans & Debt', color: 'bg-red-50 text-red-600 border-red-200' },
    { id: AssetType.OTHER, label: t('type_other'), icon: Box, desc: 'Art, Watches...', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  ];

  useEffect(() => {
    if (isOpen) {
      if (initialAsset) {
        // Editing Mode
        setType(initialAsset.type);
        setSymbol(initialAsset.symbol);
        setName(initialAsset.name);
        setQuantity(initialAsset.quantity.toString());
        setCost(initialAsset.avgCost.toString());
        setCurrentVal(initialAsset.currentPrice.toString());
        setCurrency(initialAsset.currency);
        setDateAcquired(initialAsset.dateAcquired || new Date().toISOString().split('T')[0]);
        setStep(2); 
        setShowAdjustment(false);
      } else {
        // Add Mode - Reset
        setStep(1);
        setType(AssetType.STOCK);
        setSymbol(''); 
        setName(''); 
        setQuantity(''); 
        setCost('');
        setCurrentVal('');
        setCurrency(Currency.USD);
        setDateAcquired(new Date().toISOString().split('T')[0]);
        setShowAdjustment(false);
      }
    }
  }, [isOpen, initialAsset]);

  const handleVoiceData = (data: VoiceParseResult) => {
      if (data.symbol) setSymbol(data.symbol);
      if (data.name) setName(data.name);
      if (data.type) {
          setType(data.type);
          setStep(2); 
      }
      if (data.quantity) setQuantity(data.quantity.toString());
      if (data.price) {
          const valStr = data.price.toString();
          setCost(valStr); 
          setCurrentVal(valStr); 
      }
      if (data.date) setDateAcquired(data.date);
      if (data.currency) setCurrency(data.currency);
  };

  if (!isOpen) return null;

  const isStrictManualAsset = (t: AssetType) => 
    t === AssetType.REAL_ESTATE || t === AssetType.LIABILITY || t === AssetType.OTHER;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- MODE 1: BALANCE ADJUSTMENT ---
    if (showAdjustment && initialAsset) {
        const newQty = parseFloat(actualQuantity);
        if (isNaN(newQty)) return;

        const delta = newQty - initialAsset.quantity;
        if (delta === 0) {
            setShowAdjustment(false);
            return;
        }

        // Create a correction transaction
        addTransaction({
            assetId: initialAsset.id,
            type: TransactionType.BALANCE_ADJUSTMENT,
            date: new Date().toISOString().split('T')[0],
            quantityChange: delta,
            pricePerUnit: initialAsset.avgCost, // keep cost basis same
            fee: 0,
            total: delta * initialAsset.avgCost,
            note: 'Manual Balance Correction'
        });
        
        // Also allow saving metadata changes below if any
    }

    // --- MODE 2: CREATE / EDIT METADATA ---
    const qtyNum = parseFloat(quantity);
    let costNum = parseFloat(cost);
    let currentPriceNum = parseFloat(currentVal);

    // Logic for Manual/Market prices
    if (isStrictManualAsset(type)) {
        if (isNaN(costNum) && !isNaN(currentPriceNum)) costNum = currentPriceNum; 
        if (isNaN(currentPriceNum) && !isNaN(costNum)) currentPriceNum = costNum;
    } else {
        if (isNaN(currentPriceNum)) currentPriceNum = costNum || 0;
    }

    if (!symbol) return;

    // Construct Metadata
    const assetMeta: AssetMetadata = {
      id: initialAsset ? initialAsset.id : crypto.randomUUID(),
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      type,
      currentPrice: currentPriceNum || 0,
      currency: isStrictManualAsset(type) ? currency : Currency.USD,
      lastUpdated: Date.now(),
      dateAcquired
    };

    if (initialAsset) {
      // Edit: Update Metadata Only
      if (!isStrictManualAsset(type)) {
          assetMeta.currentPrice = initialAsset.currentPrice;
          assetMeta.currency = initialAsset.currency;
      }
      editAsset(assetMeta);
    } else {
      // Create: Metadata + Initial Transaction
      if (isNaN(qtyNum)) return;
      addAsset(assetMeta, qtyNum, costNum || 0, dateAcquired);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {initialAsset ? t('editHolding') : (step === 1 ? t('selectAssetType') : t('assetDetails'))}
            </h2>
            <p className="text-xs text-slate-500">
                {initialAsset ? "Edit metadata or adjust balance" : (step === 1 ? t('whatKind') : `${t('enterDetails')} ${ASSET_TYPES.find(a => a.id === type)?.label}`)}
            </p>
          </div>
          <div className="flex items-center gap-2">
              {!initialAsset && <VoiceInput mode="ASSET" onResult={handleVoiceData} />}
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="overflow-y-auto p-6">
            
            {/* Step 1: Type Selection */}
            {step === 1 && !initialAsset && (
                <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ASSET_TYPES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { setType(t.id); setStep(2); }}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all hover:scale-[1.02] ${t.id === type ? 'ring-2 ring-blue-500 bg-blue-50/50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'}`}
                        >
                            <div className={`p-3 rounded-full mb-3 ${t.color}`}>
                                <t.icon size={24} />
                            </div>
                            <span className="font-semibold text-slate-700 text-sm">{t.label}</span>
                            <span className="text-[10px] text-slate-400 mt-1">{t.desc}</span>
                        </button>
                    ))}
                </div>
                </>
            )}

            {/* Step 2: Details Form */}
            {(step === 2 || initialAsset) && (
                <form id="asset-form" onSubmit={handleSubmit} className="space-y-5">
                    
                    {/* Identity Section (Editable) */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                         <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                {t('identification')}
                            </h3>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('tickerLabel')}</label>
                                <input 
                                    type="text" 
                                    value={symbol} 
                                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    autoFocus={!initialAsset}
                                    required
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('nameLabel')}</label>
                                <input 
                                    type="text" 
                                    value={name} onChange={e => setName(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                             </div>
                         </div>
                    </div>

                    {/* Financials Section */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4 relative">
                        <h3 className="text-sm font-semibold text-slate-700">{t('valuationHoldings')}</h3>
                        
                        {/* EDIT MODE: Locking Fields Logic */}
                        {initialAsset && !showAdjustment && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-slate-200/50">
                                <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 max-w-sm">
                                    <AlertCircle size={32} className="mx-auto text-blue-500 mb-2" />
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Holdings are Managed via Transactions</h4>
                                    <p className="text-xs text-slate-500 mb-3">
                                        Quantity and Cost are calculated from your transaction history. To fix errors, you can adjust the balance directly.
                                    </p>
                                    <div className="flex gap-2 justify-center">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowAdjustment(true)}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                                        >
                                            Adjust Balance
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={onClose}
                                            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {showAdjustment && (
                             <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2 animate-fade-in">
                                <label className="block text-xs font-bold text-blue-700 uppercase mb-1">New Correct Quantity</label>
                                <input 
                                    type="number" step="any"
                                    placeholder="Enter actual quantity"
                                    value={actualQuantity}
                                    onChange={e => setActualQuantity(e.target.value)}
                                    className="w-full p-2 bg-white border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-900"
                                    autoFocus
                                />
                                <p className="text-[10px] text-blue-600 mt-1">
                                    This will create a 'Balance Adjustment' transaction to fix your holdings.
                                </p>
                             </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 opacity-100">
                             {/* Date Acquired */}
                             <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('dateAcquired')}</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                    <input 
                                        type="date"
                                        value={dateAcquired}
                                        onChange={(e) => setDateAcquired(e.target.value)}
                                        disabled={!!initialAsset}
                                        className="w-full pl-9 p-2.5 bg-white border border-slate-200 rounded-lg outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                                    {type === AssetType.CASH ? t('balance') : (type === AssetType.LIABILITY ? t('principalRemaining') : t('quantity'))}
                                </label>
                                <input 
                                    type="number" step="any" 
                                    placeholder="0.00"
                                    value={quantity} onChange={e => setQuantity(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none"
                                    required={!initialAsset}
                                />
                            </div>

                            {/* Logic: Strict Manual Assets show "Current Price". Market Assets show Avg Cost. */}
                            {isStrictManualAsset(type) ? (
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                                        {t('unitPrice')}
                                    </label>
                                    <input 
                                        type="number" step="any" 
                                        placeholder="0.00"
                                        value={currentVal} onChange={e => setCurrentVal(e.target.value)}
                                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                                        {type === AssetType.CASH ? t('costBasis') : t('avgCostUnit')}
                                    </label>
                                    <input 
                                        type="number" step="any" 
                                        placeholder="0.00"
                                        value={cost} onChange={e => setCost(e.target.value)}
                                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                </form>
            )}
        </div>

        {/* Footer Actions */}
        {(step === 2 || initialAsset) && (
            <div className="p-6 pt-0 bg-white shrink-0">
                <button 
                    onClick={handleSubmit}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                    <Save size={18}/>
                    {showAdjustment ? "Confirm Adjustment" : (initialAsset ? t('saveChanges') : t('addToPortfolio'))}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
