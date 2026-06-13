import React, { useState, useRef } from 'react';
import MultiAgentPipeline from './multiagent/MultiAgentPipeline';
import { usePortfolio } from '../context/PortfolioContext';
import { ConfirmModal } from './ui/ConfirmModal';
import { generateExportCSV, downloadCSV } from '../utils/csvUtils';
import { useCsvImport } from '../hooks/useCsvImport';
import { PrivacyDataCard } from './settings/PrivacyDataCard';
import { ApiConfigCard } from './settings/ApiConfigCard';
import { PreferencesCard } from './settings/PreferencesCard';
import { FeedbackCard } from './settings/FeedbackCard';

export const Settings: React.FC = () => {
    const {
        assets,
        transactions,
        settings,
        updateSettings,
        importAssetsCSV,
        importTransactionsCSV,
        clearData,
        t
    } = usePortfolio();

    const [importStatus, setImportStatus] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [showMultiAgent, setShowMultiAgent] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const confirmClearData = () => {
        clearData();
        setImportStatus({ msg: t('resetSuccess'), type: 'success' });
        setTimeout(() => setImportStatus(null), 3000);
    };

    const handleExport = () => {
        const csv = generateExportCSV(transactions, assets);
        const dateStr = new Date().toISOString().split('T')[0];
        downloadCSV(csv, `panasset_full_data_${dateStr}.csv`);
    };

    const { handleFileChange } = useCsvImport({
        assets,
        importAssetsCSV,
        importTransactionsCSV,
        onStatus: setImportStatus,
        t
    });

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('settings')}</h1>
                    <p className="text-slate-500">{t('managePreferences')}</p>
                </div>
            </div>

            <PrivacyDataCard
                isPrivacyMode={settings.isPrivacyMode}
                onPrivacyToggle={() => updateSettings({ isPrivacyMode: !settings.isPrivacyMode })}
                importStatus={importStatus}
                onExport={handleExport}
                onImport={handleFileChange}
                fileInputRef={fileInputRef}
                onImportClick={handleImportClick}
                onResetClick={() => setIsResetConfirmOpen(true)}
                t={t}
            />

            <ApiConfigCard
                aiProvider={settings.aiProvider}
                onAiProviderChange={(val) => updateSettings({ aiProvider: val })}
                geminiApiKey={settings.geminiApiKey}
                onGeminiApiKeyChange={(val) => updateSettings({ geminiApiKey: val })}
                deepSeekApiKey={settings.deepSeekApiKey}
                onDeepSeekApiKeyChange={(val) => updateSettings({ deepSeekApiKey: val })}
                qwenApiKey={settings.qwenApiKey}
                onQwenApiKeyChange={(val) => updateSettings({ qwenApiKey: val })}
                marketDataProvider={settings.marketDataProvider}
                onMarketDataProviderChange={(val) => updateSettings({ marketDataProvider: val })}
                alphaVantageApiKey={settings.alphaVantageApiKey}
                onAlphaVantageApiKeyChange={(val) => updateSettings({ alphaVantageApiKey: val })}
                finnhubApiKey={settings.finnhubApiKey}
                onFinnhubApiKeyChange={(val) => updateSettings({ finnhubApiKey: val })}
                t={t}
            />

            <PreferencesCard
                settings={settings}
                updateSettings={updateSettings}
                showMultiAgent={showMultiAgent}
                setShowMultiAgent={setShowMultiAgent}
                t={t}
            />

            {showMultiAgent && (
                <MultiAgentPipeline
                    provider={settings.aiProvider}
                    apiKey={
                        settings.aiProvider === 'gemini' ? settings.geminiApiKey :
                        settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey :
                        settings.qwenApiKey
                    }
                    onClose={() => setShowMultiAgent(false)}
                />
            )}

            <FeedbackCard
                t={t}
                language={settings.language}
            />

            <ConfirmModal
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={confirmClearData}
                title={t('resetData')}
                message={t('resetConfirm')}
                confirmText={t('resetData')}
                isDanger
            />
        </div>
    );
};
