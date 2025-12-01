import React from 'react';
import { Globe, Languages, Cpu, Bot, FileCode, Search } from 'lucide-react';
import { Language, AppSettings } from '../../types/store';
import { Currency } from '../../types/domain';
import { Card } from '../ui/Card';

export interface PreferencesCardProps {
    settings: AppSettings;
    updateSettings: (updates: Partial<AppSettings>) => void;
    showMultiAgent: boolean;
    setShowMultiAgent: (val: boolean) => void;
    t: (key: string) => string;
}

export const PreferencesCard: React.FC<PreferencesCardProps> = ({
    settings,
    updateSettings,
    showMultiAgent,
    setShowMultiAgent,
    t,
}) => {
    return (
        <>
            <Card title={t('generalPreferences')}>
                <div className="space-y-6">
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

            <Card title={settings.language === 'zh' ? '多 Agent 开发流水线' : 'Multi-Agent Development Pipeline'}>
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-purple-500 text-white rounded-lg">
                                <Cpu size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-slate-800 text-sm mb-1">
                                    {settings.language === 'zh' ? 'AI 驱动的自动开发流程' : 'AI-Powered Automated Development Pipeline'}
                                </div>
                                <div className="text-xs text-slate-600 leading-relaxed">
                                    {settings.language === 'zh'
                                        ? '使用多个专业 Agent 协同工作，自动完成需求分析、代码实现、测试、审查和文档生成。'
                                        : 'Use multiple specialized agents to collaboratively handle requirement analysis, code implementation, testing, review, and documentation generation.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                            <Bot size={18} className="mx-auto mb-1 text-blue-500" />
                            <div className="text-xs font-medium text-slate-700">Architect</div>
                            <div className="text-xs text-slate-400">{settings.language === 'zh' ? '架构设计' : 'Architecture'}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                            <FileCode size={18} className="mx-auto mb-1 text-green-500" />
                            <div className="text-xs font-medium text-slate-700">Developer</div>
                            <div className="text-xs text-slate-400">{settings.language === 'zh' ? '代码生成' : 'Code Gen'}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                            <Search size={18} className="mx-auto mb-1 text-orange-500" />
                            <div className="text-xs font-medium text-slate-700">Reviewer</div>
                            <div className="text-xs text-slate-400">{settings.language === 'zh' ? '代码审查' : 'Review'}</div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowMultiAgent(true)}
                        disabled={!settings.geminiApiKey && !settings.deepSeekApiKey && !settings.qwenApiKey}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
                    >
                        <Cpu size={18} />
                        {settings.language === 'zh' ? '启动多 Agent 开发流水线' : 'Launch Multi-Agent Pipeline'}
                    </button>

                    {(!settings.geminiApiKey && !settings.deepSeekApiKey && !settings.qwenApiKey) && (
                        <div className="text-xs text-amber-600 text-center">
                            {settings.language === 'zh' ? '请先配置 AI Provider API Key 以启用此功能' : 'Please configure AI Provider API Key first'}
                        </div>
                    )}
                </div>
            </Card>
        </>
    );
};
