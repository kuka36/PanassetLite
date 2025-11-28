import React from 'react';
import { X } from 'lucide-react';
import { NetWorthChart } from './NetWorthChart';
import { Asset, Transaction, Currency, ExchangeRates } from '../types';

interface TrendModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    transactions: Transaction[];
    baseCurrency: Currency;
    exchangeRates: ExchangeRates;
    isPrivacyMode: boolean;
    t: (key: string) => string;
}

export const TrendModal: React.FC<TrendModalProps> = ({
    isOpen,
    onClose,
    assets,
    transactions,
    baseCurrency,
    exchangeRates,
    isPrivacyMode,
    t
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[600px] max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            {t('netWorthTrend')}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {t('trendModalSubtitle') || 'Trend analysis based on current filtered assets'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 bg-slate-50/50 overflow-hidden">
                    <NetWorthChart
                        assets={assets}
                        transactions={transactions}
                        baseCurrency={baseCurrency}
                        exchangeRates={exchangeRates}
                        isPrivacyMode={isPrivacyMode}
                        t={t}
                        initialRange="1W"
                    />
                </div>
            </div>
        </div>
    );
};
