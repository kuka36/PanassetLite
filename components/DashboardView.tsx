import React from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { GeminiAdvisor } from './GeminiAdvisor';
import { Dashboard } from './Dashboard';

export const DashboardView: React.FC = () => {
    const { t } = usePortfolio();

    return (
        <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{t('overview')}</h1>
                </div>
            </div>

            <GeminiAdvisor />
            <Dashboard />
        </div>
    );
};
