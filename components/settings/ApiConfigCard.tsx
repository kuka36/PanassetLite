import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { AIProvider, MarketDataProvider } from '../../types/store';
import { Bot, Eye, EyeOff, Key, Shield } from 'lucide-react';

export interface ApiConfigCardProps {
    aiProvider: AIProvider;
    onAiProviderChange: (val: AIProvider) => void;
    geminiApiKey: string;
    onGeminiApiKeyChange: (val: string) => void;
    deepSeekApiKey: string;
    onDeepSeekApiKeyChange: (val: string) => void;
    qwenApiKey: string;
    onQwenApiKeyChange: (val: string) => void;
    marketDataProvider: MarketDataProvider;
    onMarketDataProviderChange: (val: MarketDataProvider) => void;
    alphaVantageApiKey: string;
    onAlphaVantageApiKeyChange: (val: string) => void;
    finnhubApiKey: string;
    onFinnhubApiKeyChange: (val: string) => void;
    t: (key: string) => string;
}

export const ApiConfigCard: React.FC<ApiConfigCardProps> = ({
    aiProvider,
    onAiProviderChange,
    geminiApiKey,
    onGeminiApiKeyChange,
    deepSeekApiKey,
    onDeepSeekApiKeyChange,
    qwenApiKey,
    onQwenApiKeyChange,
    marketDataProvider,
    onMarketDataProviderChange,
    alphaVantageApiKey,
    onAlphaVantageApiKeyChange,
    finnhubApiKey,
    onFinnhubApiKeyChange,
    t,
}) => {
    const [showGemini, setShowGemini] = useState(false);
    const [showDeepSeek, setShowDeepSeek] = useState(false);
    const [showQwen, setShowQwen] = useState(false);
    const [showAlpha, setShowAlpha] = useState(false);
    const [showFinnhub, setShowFinnhub] = useState(false);

    const toggleGemini = () => setShowGemini(!showGemini);
    const toggleDeepSeek = () => setShowDeepSeek(!showDeepSeek);
    const toggleQwen = () => setShowQwen(!showQwen);
    const toggleAlpha = () => setShowAlpha(!showAlpha);
    const toggleFinnhub = () => setShowFinnhub(!showFinnhub);

    return (
        <Card title={t('apiConfiguration')}>
            <div className="space-y-6">

                <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg mt-1">
                        <Bot size={20} />
                    </div>
                    <div className="flex-1">
                        <div className="font-medium text-slate-800 mb-1">{t('aiProvider')}</div>
                        <div className="text-sm text-slate-500 mb-3">{t('aiProviderDesc')}</div>

                        <div className="mt-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select AI Provider</label>
                            <div className="relative">
                                <select
                                    value={aiProvider}
                                    onChange={(e) => onAiProviderChange(e.target.value as AIProvider)}
                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-800 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                >
                                    <option value="gemini">Google Gemini</option>
                                    <option value="deepseek">DeepSeek V3</option>
                                    <option value="qwen">Qwen (Tongyi Qianwen)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4"></div>

                
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg mt-1">
                        <Key size={20} />
                    </div>
                    <div className="flex-1">
                        {aiProvider === 'gemini' && (
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
                                        value={geminiApiKey}
                                        onChange={(e) => onGeminiApiKeyChange(e.target.value)}
                                        className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={toggleGemini}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                    >
                                        {showGemini ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </>
                        )}

                        {aiProvider === 'deepseek' && (
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
                                        value={deepSeekApiKey}
                                        onChange={(e) => onDeepSeekApiKeyChange(e.target.value)}
                                        className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={toggleDeepSeek}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                    >
                                        {showDeepSeek ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </>
                        )}

                        {aiProvider === 'qwen' && (
                            <>
                                <div className="font-medium text-slate-800 mb-1">{t('qwenKey')}</div>
                                <div className="text-sm text-slate-500 mb-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    {t('qwenKeyDesc')}
                                    <div className="mt-1">
                                        <a href="https://bailian.console.aliyun.com/?apiKey=1" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">{t('getKey')}</a>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showQwen ? "text" : "password"}
                                        name="qwen_api_key_field"
                                        autoComplete="off"
                                        placeholder="Paste your Qwen API Key here..."
                                        value={qwenApiKey}
                                        onChange={(e) => onQwenApiKeyChange(e.target.value)}
                                        className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={toggleQwen}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                    >
                                        {showQwen ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4"></div>

                
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg mt-1">
                        <Bot size={20} />
                    </div>
                    <div className="flex-1">
                        <div className="font-medium text-slate-800 mb-1">{t('marketDataProvider')}</div>
                        <div className="text-sm text-slate-500 mb-3">{t('marketDataProviderDesc')}</div>

                        <div className="mt-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select Market Data Source</label>
                            <div className="relative">
                                <select
                                    value={marketDataProvider}
                                    onChange={(e) => onMarketDataProviderChange(e.target.value as MarketDataProvider)}
                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-800 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                >
                                    <option value="finnhub">Finnhub</option>
                                    <option value="alphavantage">Alpha Vantage</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4"></div>

                
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 text-slate-500 rounded-lg mt-1">
                        <Key size={20} />
                    </div>
                    <div className="flex-1">
                        {marketDataProvider === 'finnhub' ? (
                            <>
                                <div className="font-medium text-slate-800 mb-1">{t('finnhubKey')}</div>
                                <div className="text-sm text-slate-500 mb-3">
                                    {t('finnhubKeyDesc')}
                                    <a href="https://finnhub.io/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline ml-1">{t('getKey')}</a>.
                                </div>
                                <div className="relative">
                                    <input
                                        type={showFinnhub ? "text" : "password"}
                                        name="finnhub_api_key_field"
                                        autoComplete="off"
                                        placeholder="Paste your Finnhub API Key here..."
                                        value={finnhubApiKey}
                                        onChange={(e) => onFinnhubApiKeyChange(e.target.value)}
                                        className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={toggleFinnhub}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                    >
                                        {showFinnhub ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
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
                                        value={alphaVantageApiKey}
                                        onChange={(e) => onAlphaVantageApiKeyChange(e.target.value)}
                                        className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={toggleAlpha}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                    >
                                        {showAlpha ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-3 mt-4">
                    <Shield size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-500 leading-relaxed">
                        {t('apiKeysSecurity')}
                    </span>
                </div>
            </div>
        </Card>
    );
};