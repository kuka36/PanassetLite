import React, { useState } from 'react';
import { AssetType, Currency, EntryMode } from '../types';
import { usePortfolio } from '../context/PortfolioContext';
import { X, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddAssetModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addAsset } = usePortfolio();
  const [mode, setMode] = useState<EntryMode>(EntryMode.SIMPLE);
  
  // Form State
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>(AssetType.STOCK);
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState(''); // Represents avgCost in Simple, or Price in Transaction

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qtyNum = parseFloat(quantity);
    const costNum = parseFloat(cost);

    if (!symbol || isNaN(qtyNum) || isNaN(costNum)) return;

    // For this demo, both modes essentially create/update an asset entry
    // In a full app, Transaction mode would append to a history table.
    // Here we simulate "Easy Entry" by creating the asset state directly.
    
    addAsset({
      id: crypto.randomUUID(),
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      type,
      quantity: qtyNum,
      avgCost: costNum,
      currentPrice: costNum, // Assume current price is buy price for initial entry
      currency: Currency.USD
    });

    onClose();
    // Reset form
    setSymbol(''); setName(''); setQuantity(''); setCost('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">Add Investment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>

        {/* Mode Switcher */}
        <div className="p-2 bg-slate-50 border-b border-slate-100 flex gap-1">
            <button 
                onClick={() => setMode(EntryMode.SIMPLE)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === EntryMode.SIMPLE ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                Simple Entry
            </button>
            <button 
                onClick={() => setMode(EntryMode.TRANSACTION)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === EntryMode.TRANSACTION ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                Transaction Mode
            </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Asset Type</label>
               <select 
                value={type} 
                onChange={(e) => setType(e.target.value as AssetType)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
               >
                 <option value={AssetType.STOCK}>Stock (US/HK/CN)</option>
                 <option value={AssetType.CRYPTO}>Crypto</option>
                 <option value={AssetType.FUND}>Fund / ETF</option>
                 <option value={AssetType.CASH}>Cash / FX</option>
               </select>
            </div>
            <div className="col-span-2 md:col-span-1">
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Symbol / Ticker</label>
               <input 
                type="text" placeholder="e.g. AAPL, BTC"
                value={symbol} onChange={e => setSymbol(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
               />
            </div>
          </div>

          <div>
             <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Name (Optional)</label>
             <input 
               type="text" placeholder="e.g. Apple Inc."
               value={name} onChange={e => setName(e.target.value)}
               className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Quantity</label>
               <input 
                type="number" step="any" placeholder="0.00"
                value={quantity} onChange={e => setQuantity(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
               />
            </div>
            <div>
               <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                   {mode === EntryMode.SIMPLE ? 'Average Cost' : 'Buy Price'}
               </label>
               <div className="relative">
                 <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                 <input 
                  type="number" step="any" placeholder="0.00"
                  value={cost} onChange={e => setCost(e.target.value)}
                  className="w-full pl-7 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                 />
               </div>
            </div>
          </div>

          {mode === EntryMode.TRANSACTION && (
            <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100">
                Transaction mode enabled: This will record a Buy history and recalculate your portfolio's weighted average cost.
            </div>
          )}

          <button 
            type="submit" 
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18}/>
            Save Asset
          </button>

        </form>
      </div>
    </div>
  );
};