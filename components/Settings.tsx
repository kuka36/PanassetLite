
import React, { useRef, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/ConfirmModal';
import { Currency, Language, AssetType, TransactionType, AssetMetadata, Transaction } from '../types';
import { 
  Upload, Trash2, Shield, Globe, AlertTriangle, CheckCircle, Key, Languages, Activity, Lock, Github, ExternalLink, Bot, Eye, EyeOff, Download, Info, FileText
} from 'lucide-react';

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

  const [importStatus, setImportStatus] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visibility States for API Keys
  const [showGemini, setShowGemini] = useState(false);
  const [showDeepSeek, setShowDeepSeek] = useState(false);
  const [showAlpha, setShowAlpha] = useState(false);

  // --- CSV Helpers ---

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const safeFloat = (val: string): number => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
  };

  const handleExportUnified = () => {
    const headers = [
        'tx_id', 'tx_date', 'tx_type', 'tx_quantity', 'tx_price', 'tx_fee', 'tx_total', 'tx_note',
        'asset_id', 'asset_symbol', 'asset_name', 'asset_type', 'asset_currency', 'asset_current_price', 'asset_date_acquired'
    ];

    const rows = transactions.map(tx => {
        const asset = assets.find(a => a.id === tx.assetId);
        
        return [
            tx.id,
            tx.date,
            tx.type,
            tx.quantityChange,
            tx.pricePerUnit,
            tx.fee,
            tx.total,
            tx.note || '',
            tx.assetId,
            asset?.symbol || 'UNKNOWN',
            asset?.name || 'Unknown Asset',
            asset?.type || AssetType.OTHER,
            asset?.currency || Currency.USD,
            asset?.currentPrice || 0,
            asset?.dateAcquired || ''
        ].map(escapeCSV).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `panasset_full_data_${dateStr}.csv`);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let startValueIndex = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            let val = line.substring(startValueIndex, i);
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
            result.push(val);
            startValueIndex = i + 1;
        }
    }
    let lastVal = line.substring(startValueIndex);
    if (lastVal.startsWith('"') && lastVal.endsWith('"')) lastVal = lastVal.slice(1, -1).replace(/""/g, '"');
    result.push(lastVal);
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("File is empty or invalid");

        const headers = parseCSVLine(lines[0]).map(h => h.trim());
        
        if (!headers.includes('tx_id') || !headers.includes('asset_id')) {
             throw new Error("Invalid CSV format. Please use the Unified Export format.");
        }

        const assetsMap = new Map<string, AssetMetadata>();
        const parsedTransactions: Transaction[] = [];

        lines.slice(1).forEach(line => {
             const vals = parseCSVLine(line);
             const getVal = (key: string) => {
                 const idx = headers.indexOf(key);
                 return idx !== -1 ? vals[idx] : '';
             };

             const assetId = getVal('asset_id');
             if (!assetId) return;

             if (!assetsMap.has(assetId)) {
                 assetsMap.set(assetId, {
                     id: assetId,
                     symbol: getVal('asset_symbol') || 'UNKNOWN',
                     name: getVal('asset_name') || 'Unknown',
                     type: (getVal('asset_type') as AssetType) || AssetType.OTHER,
                     currency: (getVal('asset_currency') as Currency) || Currency.USD,
                     currentPrice: safeFloat(getVal('asset_current_price')),
                     dateAcquired: getVal('asset_date_acquired'),
                     lastUpdated: Date.now() 
                 });
             }

             const txId = getVal('tx_id') || crypto.randomUUID();
             parsedTransactions.push({
                 id: txId,
                 assetId: assetId,
                 type: (getVal('tx_type') as TransactionType) || TransactionType.BUY,
                 date: getVal('tx_date') || new Date().toISOString(),
                 quantityChange: safeFloat(getVal('tx_quantity')),
                 pricePerUnit: safeFloat(getVal('tx_price')),
                 fee: safeFloat(getVal('tx_fee')),
                 total: safeFloat(getVal('tx_total')),
                 note: getVal('tx_note')
             });
        });
        
        const assetsToImport = Array.from(assetsMap.values());
        const txsToImport = parsedTransactions;

        importAssetsCSV(assetsToImport);
        importTransactionsCSV(txsToImport);

        setImportStatus({ 
            msg: `${t('importSuccess')} (${assetsToImport.length} Assets, ${txsToImport.length} Txs)`, 
            type: 'success' 
        });
        
        setTimeout(() => setImportStatus(null), 5000);
      } catch (err) {
        console.error(err);
        setImportStatus({ msg: t('importError'), type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmClearData = () => {
      clearData();
      setImportStatus({ msg: t('resetSuccess'), type: 'success' });
      setTimeout(() => setImportStatus(null), 3000);
  };

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

      {/* Privacy & Security Section - Redesigned */}
      <Card title={t('privacySecurity')}>
         <div className="space-y-6">
             {/* Privacy Mode Professional Toggle */}
             <div className="flex items-center justify-between">
                 <div className="flex items-start gap-4">
                     <div className={`p-3 rounded-xl transition-all ${settings.isPrivacyMode ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400'}`}>
                         {settings.isPrivacyMode ? <EyeOff size={24} /> : <Eye size={24} />}
                     </div>
                     <div>
                         <div className="font-semibold text-slate-800 text-base">{t('privacyMode')}</div>
                         <div className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{t('privacyModeDesc')}</div>
                     </div>
                 </div>

                 <button
                    onClick={() => updateSettings({ isPrivacyMode: !settings.isPrivacyMode })}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                        settings.isPrivacyMode ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                 >
                    <span 
                        className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                            settings.isPrivacyMode ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    />
                 </button>
             </div>

             <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                <Shield size={20} className="text-emerald-600 mt-0.5 shrink-0" />
                <span className="text-sm text-emerald-800 leading-relaxed font-medium">
                    {t('localDataSecurity')}
                </span>
            </div>
         </div>
      </Card>

      {/* API Configuration */}
      <Card title={t('apiConfiguration')}>
        <div className="space-y-6">
            
            {/* AI Provider Selection */}
            <div className="flex items-start gap-3">
                 <div className="p-2 bg-slate-100 text-slate-600 rounded-lg mt-1">
                    <Bot size={20} />
                </div>
                <div className="flex-1">
                     <div className="font-medium text-slate-800 mb-1">{t('aiProvider')}</div>
                     <div className="text-sm text-slate-500 mb-3">{t('aiProviderDesc')}</div>
                     
                     <div className="grid grid-cols-2 gap-4 max-w-md">
                        <label className={`border rounded-xl p-4 cursor-pointer transition-all ${settings.aiProvider === 'gemini' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-200'}`}>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="radio" 
                                    name="aiProvider"
                                    checked={settings.aiProvider === 'gemini'}
                                    onChange={() => updateSettings({ aiProvider: 'gemini' })}
                                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="font-medium text-slate-800">Google Gemini</span>
                            </div>
                        </label>

                        <label className={`border rounded-xl p-4 cursor-pointer transition-all ${settings.aiProvider === 'deepseek' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="radio" 
                                    name="aiProvider"
                                    checked={settings.aiProvider === 'deepseek'}
                                    onChange={() => updateSettings({ aiProvider: 'deepseek' })}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="font-medium text-slate-800">DeepSeek</span>
                            </div>
                        </label>
                     </div>
                </div>
            </div>

            <div className="border-t border-slate-100 pt-4"></div>

            {/* Dynamic AI Key Input */}
            <div className="flex items-start gap-3">
                 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg mt-1">
                    <Key size={20} />
                </div>
                <div className="flex-1">
                     {settings.aiProvider === 'gemini' ? (
                        <>
                            <div className="font-medium text-slate-800 mb-1">{t('geminiKey')}</div>
                            <div className="text-sm text-slate-500 mb-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                {t('geminiKeyDesc')}
                                <div className="mt-1">
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">{t('getKey')}</a>
                                </div>
                            </div>
                            <div className="relative">
                                <input 
                                    type={showGemini ? "text" : "password"}
                                    name="gemini_api_key_field"
                                    autoComplete="off"
                                    placeholder="Paste your Gemini API Key here..."
                                    value={settings.geminiApiKey}
                                    onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                                    className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowGemini(!showGemini)}
                                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                >
                                    {showGemini ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </>
                     ) : (
                        <>
                            <div className="font-medium text-slate-800 mb-1">{t('deepSeekKey')}</div>
                            <div className="text-sm text-slate-500 mb-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                {t('deepSeekKeyDesc')}
                                <div className="mt-1">
                                    <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">{t('getKey')}</a>
                                </div>
                            </div>
                            <div className="relative">
                                <input 
                                    type={showDeepSeek ? "text" : "password"}
                                    name="deepseek_api_key_field"
                                    autoComplete="off"
                                    placeholder="Paste your DeepSeek API Key here..."
                                    value={settings.deepSeekApiKey}
                                    onChange={(e) => updateSettings({ deepSeekApiKey: e.target.value })}
                                    className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowDeepSeek(!showDeepSeek)}
                                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                >
                                    {showDeepSeek ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </>
                     )}
                </div>
            </div>

            <div className="border-t border-slate-100 pt-4"></div>

            {/* Alpha Vantage API Key */}
            <div className="flex items-start gap-3">
                 <div className="p-2 bg-teal-50 text-teal-600 rounded-lg mt-1">
                    <Activity size={20} />
                </div>
                <div className="flex-1">
                     <div className="font-medium text-slate-800 mb-1">{t('alphaVantageKey')}</div>
                     <div className="text-sm text-slate-500 mb-3">
                        {t('alphaVantageKeyDesc')}
                        <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline ml-1">{t('getKey')}</a>.
                     </div>
                     <div className="relative">
                        <input 
                            type={showAlpha ? "text" : "password"}
                            name="alphavantage_api_key_field"
                            autoComplete="off"
                            placeholder="Paste your Alpha Vantage API Key here..."
                            value={settings.alphaVantageApiKey}
                            onChange={(e) => updateSettings({ alphaVantageApiKey: e.target.value })}
                            className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                        />
                         <button 
                            type="button"
                            onClick={() => setShowAlpha(!showAlpha)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                            {showAlpha ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                     </div>
                </div>
            </div>
            
            {/* Security Note */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-3 mt-4">
                <Shield size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-500 leading-relaxed">
                    {t('apiKeysSecurity')}
                </span>
            </div>
        </div>
      </Card>

      {/* Preferences Section */}
      <Card title={t('generalPreferences')}>
        <div className="space-y-6">
            {/* Currency */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Globe size={20} />
                    </div>
                    <div>
                        <div className="font-medium text-slate-800">{t('baseCurrency')}</div>
                        <div className="text-sm text-slate-500">{t('baseCurrencyDesc')}</div>
                    </div>
                </div>
                <select 
                    value={settings.baseCurrency}
                    onChange={(e) => updateSettings({ baseCurrency: e.target.value as Currency })}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[120px]"
                >
                    <option value={Currency.USD}>USD ($)</option>
                    <option value={Currency.CNY}>CNY (¥)</option>
                    <option value={Currency.HKD}>HKD ($)</option>
                </select>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Languages size={20} />
                    </div>
                    <div>
                        <div className="font-medium text-slate-800">{t('language')}</div>
                        <div className="text-sm text-slate-500">{t('languageDesc')}</div>
                    </div>
                </div>
                <select 
                    value={settings.language}
                    onChange={(e) => updateSettings({ language: e.target.value as Language })}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[120px]"
                >
                    <option value="en">English</option>
                    <option value="zh">中文 (简体)</option>
                </select>
            </div>
        </div>
      </Card>

      {/* Data Management Section */}
      <Card title={t('dataManagement')}>
        <div className="space-y-4">
            {importStatus && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${importStatus.type === 'success' ? 'bg-green-50 text-green-700' : (importStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700')}`}>
                    {importStatus.type === 'success' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                    {importStatus.msg}
                </div>
            )}

            {/* Unified Export Button */}
            <button 
                onClick={handleExportUnified}
                className="w-full flex items-center justify-center p-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all group gap-3 shadow-sm"
            >
                <div className="p-2 bg-slate-100 text-slate-600 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <FileText size={20} />
                </div>
                <div className="text-left">
                    <div className="font-medium text-slate-700 text-sm flex items-center gap-2">
                        {t('exportUnified')} <Download size={14} className="text-slate-400"/>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{t('exportUnifiedDesc')}</div>
                </div>
            </button>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-2 text-slate-800 font-medium">
                    <Upload size={18} className="text-blue-600"/> {t('importData')}
                </div>
                <div className="text-xs text-slate-500 mb-3 leading-relaxed flex items-start gap-2">
                    <Info size={14} className="mt-0.5 shrink-0"/>
                    {t('importHint')}
                </div>
                
                <button 
                    onClick={handleImportClick}
                    className="w-full py-2.5 bg-white border border-blue-200 text-blue-700 font-medium rounded-lg hover:bg-blue-50 transition-colors text-sm shadow-sm"
                >
                    {t('uploadCSV')}
                </button>
                <input 
                    type="file" 
                    accept=".csv" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                />
            </div>

            <div className="border-t border-slate-100 my-4"></div>

            {/* Reset */}
            <button 
                onClick={() => setIsResetConfirmOpen(true)}
                className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
            >
                <Trash2 size={16} />
                {t('resetData')}
            </button>
        </div>
      </Card>

      {/* Feedback */}
      <Card title={t('feedback')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                    <Github size={22} />
                </div>
                <div>
                    <div className="font-medium text-slate-800">{t('reportBug')}</div>
                    <div className="text-sm text-slate-500">{t('githubDesc')}</div>
                </div>
            </div>
            <a 
                href="https://github.com/kuka36/PanassetLite/issues"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0"
            >
                <Github size={16} />
                <span>{t('githubLinkText')}</span>
                <ExternalLink size={14} className="opacity-70"/>
            </a>
        </div>
      </Card>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={confirmClearData}
        title={t('resetData')}
        message={t('resetConfirm')}
        confirmText={t('resetData')}
        isDanger
      />

      <div className="text-center text-slate-400 text-sm pt-4">
          {settings.language === 'zh' ? "盘资产·轻 v1.2.1 • 本地数据存储" : "PanassetLite v1.2.1 • Local Data Storage"}
      </div>
    </div>
  );
};
