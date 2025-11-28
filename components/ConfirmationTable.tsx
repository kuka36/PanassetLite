import React, { useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { AssetType, Currency } from '../types';

interface ConfirmationTableProps {
    items: any[];
    onUpdate: (items: any[]) => void;
}

export const ConfirmationTable: React.FC<ConfirmationTableProps> = ({ items, onUpdate }) => {
    const [isZoomed, setIsZoomed] = useState(false);

    const handleChange = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onUpdate(newItems);
    };

    const renderTable = (isModal: boolean) => (
        <div className={`overflow-auto ${isModal ? 'max-h-[80vh]' : 'max-h-[200px]'}`}>
            <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-indigo-50/50 text-indigo-600 font-medium sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                        <th className="p-2 border-b border-indigo-100 min-w-[80px]">Symbol</th>
                        <th className="p-2 border-b border-indigo-100 min-w-[100px]">Name</th>
                        <th className="p-2 border-b border-indigo-100 min-w-[80px]">Type</th>
                        <th className="p-2 border-b border-indigo-100 text-right min-w-[60px]">Qty</th>
                        <th className="p-2 border-b border-indigo-100 text-right min-w-[80px]">Price</th>
                        <th className="p-2 border-b border-indigo-100 min-w-[60px]">Ccy</th>
                        <th className="p-2 border-b border-indigo-100 text-right min-w-[100px]">Date</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50">
                    {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 group">
                            <td className="p-1">
                                <input
                                    type="text"
                                    value={item.symbol || ''}
                                    onChange={(e) => handleChange(idx, 'symbol', e.target.value)}
                                    className="w-full bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none transition-colors font-medium text-slate-700 uppercase"
                                />
                            </td>
                            <td className="p-1">
                                <input
                                    type="text"
                                    value={item.name || ''}
                                    onChange={(e) => handleChange(idx, 'name', e.target.value)}
                                    className="w-full bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none transition-colors text-slate-600"
                                />
                            </td>
                            <td className="p-1">
                                <select
                                    value={item.assetType || item.type || AssetType.STOCK}
                                    onChange={(e) => handleChange(idx, 'assetType', e.target.value)}
                                    className="w-full bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none transition-colors text-slate-600"
                                >
                                    {Object.values(AssetType).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="p-1">
                                <input
                                    type="number"
                                    value={item.quantity || ''}
                                    onChange={(e) => handleChange(idx, 'quantity', e.target.value)}
                                    className="w-full text-right bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none transition-colors text-slate-600"
                                />
                            </td>
                            <td className="p-1">
                                <input
                                    type="number"
                                    value={item.price || ''}
                                    onChange={(e) => handleChange(idx, 'price', e.target.value)}
                                    className="w-full text-right bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none transition-colors text-slate-600"
                                />
                            </td>
                            <td className="p-1">
                                <select
                                    value={item.currency || Currency.USD}
                                    onChange={(e) => handleChange(idx, 'currency', e.target.value)}
                                    className="w-full bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none transition-colors text-slate-600"
                                >
                                    {Object.values(Currency).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="p-1">
                                <input
                                    type="date"
                                    value={item.dateAcquired ? item.dateAcquired.split('T')[0] : ''}
                                    onChange={(e) => handleChange(idx, 'dateAcquired', e.target.value)}
                                    className="w-full text-right bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none transition-colors text-slate-600 text-xs"
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <>
            <div className="relative bg-white/50 rounded-lg border border-indigo-100 overflow-hidden">
                <div className="absolute top-2 right-2 z-20">
                    <button
                        onClick={() => setIsZoomed(true)}
                        className="p-1.5 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md shadow-sm border border-slate-200 transition-colors"
                        title="Expand View"
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>
                {renderTable(false)}
            </div>

            {isZoomed && (
                <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                Edit Asset Details
                            </h3>
                            <button
                                onClick={() => setIsZoomed(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto bg-white rounded-b-xl">
                            {renderTable(true)}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex justify-end">
                            <button
                                onClick={() => setIsZoomed(false)}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
