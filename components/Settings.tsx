
import React, { useRef, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/ConfirmModal';
import { Currency, Language, AssetType, TransactionType } from '../types';
import { 
  Upload, Trash2, Shield, Globe, AlertTriangle, CheckCircle, Key, Languages, Activity, Lock, Github, ExternalLink, Bot, Sparkles, Eye, EyeOff, FileSpreadsheet, FileText, Download, Info
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

  const handleExportAssets = () => {
    const headers = ['id', 'symbol', 'name', 'type', 'currency', 'currentPrice', 'dateAcquired', 'lastUpdated'];
    const rows = assets.map(a => [
      a.id,
      a.symbol,
      a.name,
      a.type,
      a.currency,
      a.currentPrice,
      a.dateAcquired || '',
      a.lastUpdated || ''
    ].map(escapeCSV).join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCSV(csvContent, `panasset_assets.csv`);
  };

  const handleExportTransactions = () => {
    const headers = ['id', 'assetId', 'type', 'date', 'quantityChange', 'pricePerUnit', 'fee', 'total', 'note'];
    const rows = transactions.map(tx => [
      tx.id,
      tx.assetId,
      tx.type,
      tx.date,
      tx.quantityChange,
      tx.pricePerUnit,
      tx.fee,
      tx.total,
      tx.note || ''
    ].map(escapeCSV).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCSV(csvContent, `panasset_transactions.csv`);
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
        
        // Detect Type based on headers
        if (headers.includes('symbol') && headers.includes('type') && headers.includes('currency')) {
            // Import Assets (Metadata)
            const newAssets = lines.slice(1).map(line => {
                const vals = parseCSVLine(line);
                const getVal = (key: string) => vals[headers.indexOf(key)];
                
                return {
                    id: getVal('id') || crypto.randomUUID(),
                    symbol: getVal('symbol'),
                    name: getVal('name'),
                    type: getVal('type') as AssetType,
                    currency: getVal('currency') as Currency,
                    currentPrice: parseFloat(getVal('currentPrice')) || 0,
                    dateAcquired: getVal('dateAcquired'),
                    lastUpdated: parseInt(getVal('lastUpdated')) || Date.now(),
                };
            });
            
            const count = importAssetsCSV(newAssets);
            setImportStatus({ msg: `${t('importSuccess')} (${count} Assets updated/added)`, type: 'success' });

        } else if (headers.includes('assetId') && headers.includes('quantityChange') && headers.includes('type')) {
            // Import Transactions
            const newTxs = lines.slice(1).map(line => {
                const vals = parseCSVLine(line);
                const getVal = (key: string) => vals[headers.indexOf(key)];
                return {
                    id: getVal('id') || crypto.randomUUID(),
                    assetId: getVal('assetId'),
                    type: getVal('type') as TransactionType,
                    date: getVal('date'),
                    quantityChange: parseFloat(getVal('quantityChange')),
                    pricePerUnit: parseFloat(getVal('pricePerUnit')),
                    fee: parseFloat(getVal('fee')) || 0,
                    total: parseFloat(getVal('total')) || 0,
                    note: getVal('note')
                };
            });
            
            const count = importTransactionsCSV(newTxs);
            setImportStatus({ msg: `${t('importSuccess')} (${count} Txns updated/added)`, type: 'success' });
        } else {
            throw new Error("Unknown CSV format. Headers must match standard export.");
        }
        
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

      {/* API Configuration */}
      <Card title={t('apiConfiguration')}>
        <div className="space-y-6">
            
            {/* Global Security Note */}
            <div className="bg-green-50/50 border border-green-100 rounded-lg p-3 flex items-start gap-3">
                <Shield size={16} className="text-green-600 mt-0.5 shrink-0" />
                <span className="text-sm text-green-800 leading-relaxed">
                    {t('apiKeysSecurity')}
                </span>
            </div>

            {/* AI Assistant Toggle */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${!settings.geminiApiKey ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${!settings.geminiApiKey ? 'bg-slate-200 text-slate-400' : 'bg-indigo-100 text-indigo-600'}`}>
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <div className={`font-medium ${!settings.geminiApiKey ? 'text-slate-500' : 'text-slate-800'}`}>{t('enableAiAssistant')}</div>
                        <div className="text-xs text-slate-500">
                             {!settings.geminiApiKey 
                               ? (settings.language === 'zh' ? "需要配置 Gemini API Key 才能开启" : "Requires Gemini API Key to enable")
                               : "Show AI chat bubble in the sidebar"
                             }
                        </div>
                    </div>
                </div>
                <label className={`relative inline-flex items-center ${!settings.geminiApiKey ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.isAiAssistantEnabled && !!settings.geminiApiKey}
                        disabled={!settings.geminiApiKey}
                        onChange={(e) => updateSettings({ isAiAssistantEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
            </div>

            <div className="border-t border-slate-100"></div>
            
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
            <div className="flex items-center justify-between pb-4 border-b border-slate-50 last:border-0 last:pb-0">
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

            {/* Privacy Mode */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <Shield size={20} />
                    </div>
                    <div>
                        <div className="font-medium text-slate-800">{t('privacyMode')}</div>
                        <div className="text-sm text-slate-500">{t('privacyModeDesc')}</div>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.isPrivacyMode}
                        onChange={(e) => updateSettings({ isPrivacyMode: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
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

            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                <Lock size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <span className="text-sm text-blue-700 leading-relaxed">{t('localDataSecurity')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Assets */}
                <button 
                    onClick={handleExportAssets}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all group"
                >
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-full mb-2 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <FileSpreadsheet size={20} />
                    </div>
                    <span className="font-medium text-slate-700 text-sm flex items-center gap-1">
                        {settings.language === 'zh' ? "导出 资产清单" : "Export Assets"} <Download size={12}/>
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">CSV</span>
                </button>

                {/* Export Transactions */}
                <button 
                    onClick={handleExportTransactions}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all group"
                >
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-full mb-2 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <FileText size={20} />
                    </div>
                    <span className="font-medium text-slate-700 text-sm flex items-center gap-1">
                        {settings.language === 'zh' ? "导出 交易记录" : "Export Transactions"} <Download size={12}/>
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">CSV</span>
                </button>
            </div>

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
          {settings.language === 'zh' ? "盘资产·轻 v1.2.0 • 本地数据存储" : "PanassetLite v1.2.0 • Local Data Storage"}
      </div>
    </div>
  );
};
