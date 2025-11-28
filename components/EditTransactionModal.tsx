import React, { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Transaction, TransactionType } from '../types';
import { X, Save, Calendar, DollarSign, Hash, Edit3, Wallet } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
}

// Helper to get local ISO string for input
const getLocalISOString = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const EditTransactionModal: React.FC<Props> = ({ isOpen, onClose, transaction }) => {
    const { editTransaction, assets, transactions, t } = usePortfolio();

    const [date, setDate] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [fee, setFee] = useState('0');
    const [total, setTotal] = useState('0');
    const [balance, setBalance] = useState('0'); // New Balance State

    // Calculate Previous Balance based on current date state
    const previousBalance = useMemo(() => {
        if (!transaction || !date) return 0;

        // Filter transactions for same asset, excluding current one
        // And strictly before the current date state
        return transactions
            .filter(t =>
                t.assetId === transaction.assetId &&
                t.id !== transaction.id &&
                new Date(t.date).getTime() < new Date(date).getTime()
            )
            .reduce((sum, t) => sum + t.quantityChange, 0);
    }, [transactions, transaction, date]);

    useEffect(() => {
        if (isOpen && transaction) {
            setDate(transaction.date);
            setQuantity(Math.abs(transaction.quantityChange).toString());
            setPrice(transaction.pricePerUnit.toString());
            setFee(transaction.fee.toString());
            setTotal(transaction.total.toString());

            // Initial Balance Calculation
            const prevBal = transactions
                .filter(t =>
                    t.assetId === transaction.assetId &&
                    t.id !== transaction.id &&
                    new Date(t.date).getTime() < new Date(transaction.date).getTime()
                )
                .reduce((sum, t) => sum + t.quantityChange, 0);

            setBalance((prevBal + transaction.quantityChange).toString());
        }
    }, [isOpen, transaction]);

    // Helper to find last price from previous transactions
    const getLastPrice = () => {
        if (!transaction) return 0;
        // Filter transactions for same asset, excluding current one
        const assetTxs = transactions
            .filter(t => t.assetId === transaction.assetId && t.id !== transaction.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (assetTxs.length > 0) {
            return assetTxs[0].pricePerUnit;
        }
        return 0;
    };

    const calculateTotal = (q: number, p: number, f: number, type: TransactionType) => {
        switch (type) {
            case TransactionType.BUY:
            case TransactionType.DEPOSIT:
            case TransactionType.BORROW:
                return (q * p) + f;
            case TransactionType.SELL:
            case TransactionType.WITHDRAWAL:
            case TransactionType.REPAY:
            case TransactionType.DIVIDEND:
                return (q * p) - f;
            default:
                return (q * p);
        }
    };

    const handleQuantityChange = (val: string) => {
        setQuantity(val);
        if (!transaction) return;

        const qtyNum = parseFloat(val);
        let priceNum = parseFloat(price);
        const feeNum = parseFloat(fee) || 0;

        if (isNaN(qtyNum)) return;

        // Update Balance
        // Determine sign based on transaction type or original sign
        let signedQty = qtyNum;
        if (transaction.quantityChange < 0) {
            signedQty = -qtyNum;
        }
        setBalance((previousBalance + signedQty).toString());

        // If price is missing, try to get last price
        if (isNaN(priceNum) || priceNum === 0) {
            const lastPrice = getLastPrice();
            if (lastPrice > 0) {
                priceNum = lastPrice;
                setPrice(lastPrice.toString());
            }
        }

        if (priceNum > 0) {
            const newTotal = calculateTotal(qtyNum, priceNum, feeNum, transaction.type);
            setTotal(newTotal.toFixed(2));
        }
    };

    const handleBalanceChange = (val: string) => {
        setBalance(val);
        if (!transaction) return;

        const newBal = parseFloat(val);
        if (isNaN(newBal)) return;

        // Calculate Quantity = NewBalance - PreviousBalance
        const diff = newBal - previousBalance;
        const absQty = Math.abs(diff);

        // Update Quantity Display
        setQuantity(absQty.toString());

        // Update Total (Money)
        let priceNum = parseFloat(price);
        const feeNum = parseFloat(fee) || 0;

        if (priceNum > 0) {
            const newTotal = calculateTotal(absQty, priceNum, feeNum, transaction.type);
            setTotal(newTotal.toFixed(2));
        }
    };

    const handlePriceChange = (val: string) => {
        setPrice(val);
        if (!transaction) return;

        const priceNum = parseFloat(val);
        const qtyNum = parseFloat(quantity);
        const feeNum = parseFloat(fee) || 0;

        if (!isNaN(priceNum) && !isNaN(qtyNum)) {
            const newTotal = calculateTotal(qtyNum, priceNum, feeNum, transaction.type);
            setTotal(newTotal.toFixed(2));
        }
    };

    const handleFeeChange = (val: string) => {
        setFee(val);
        if (!transaction) return;

        const feeNum = parseFloat(val) || 0;
        const qtyNum = parseFloat(quantity);
        const priceNum = parseFloat(price);

        if (!isNaN(qtyNum) && !isNaN(priceNum)) {
            const newTotal = calculateTotal(qtyNum, priceNum, feeNum, transaction.type);
            setTotal(newTotal.toFixed(2));
        }
    };

    if (!isOpen || !transaction) return null;

    const asset = assets.find(a => a.id === transaction.assetId);
    const symbol = asset ? asset.symbol : 'Unknown Asset';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const qtyNum = parseFloat(quantity);
        const priceNum = parseFloat(price);
        const feeNum = parseFloat(fee) || 0;
        const totalNum = parseFloat(total);
        const balanceNum = parseFloat(balance);

        if (isNaN(qtyNum) || isNaN(priceNum)) return;

        // Restore sign for quantityChange
        let qtyChange = qtyNum;

        if (transaction.type === TransactionType.BALANCE_ADJUSTMENT) {
            // For Adjustment, trust the Balance calculation if available
            if (!isNaN(balanceNum)) {
                qtyChange = balanceNum - previousBalance;
            } else {
                if (transaction.quantityChange < 0) qtyChange = -qtyNum;
            }
        } else {
            // For Buy/Sell, enforce sign based on original transaction type
            if (transaction.quantityChange < 0) {
                qtyChange = -qtyNum;
            }
        }

        editTransaction({
            ...transaction,
            date,
            quantityChange: qtyChange,
            pricePerUnit: priceNum,
            fee: feeNum,
            total: totalNum
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">

                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Edit3 size={18} /></div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">{t('editTransaction')}</h2>
                            <p className="text-xs text-slate-500">{symbol} • {t(`tx_${transaction.type}`)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('date')}</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="datetime-local"
                                step="1"
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
                                <Hash className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="number" step="any" placeholder="0.00"
                                    value={quantity} onChange={e => handleQuantityChange(e.target.value)}
                                    className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        {/* Balance (New Field) */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1 flex justify-between">
                                {t('balance')}
                                <span className="text-[10px] text-slate-400 font-normal">Prev: {previousBalance.toLocaleString()}</span>
                            </label>
                            <div className="relative">
                                <Wallet className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="number" step="any" placeholder="0.00"
                                    value={balance} onChange={e => handleBalanceChange(e.target.value)}
                                    className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Price */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('pricePerUnit')}</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="number" step="any" placeholder="0.00"
                                    value={price} onChange={e => handlePriceChange(e.target.value)}
                                    className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        {/* Fees */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('fees')}</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="number" step="any" placeholder="0.00"
                                    value={fee} onChange={e => handleFeeChange(e.target.value)}
                                    className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        {t('saveChanges')}
                    </button>

                </form>
            </div>
        </div>
    );
};
