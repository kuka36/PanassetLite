import React from 'react';
import { Card } from '../ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Sparkles, RefreshCw, Zap } from 'lucide-react';

interface RiskAnalysisChartProps {
    riskProfile: { name: string; value: number; color: string }[];
    riskData: any;
    loadingRisk: boolean;
    riskError: boolean;
    onRefreshRisk: () => void;
    formatCurrency: (val: number) => string;
    t: (key: string) => string;
}

export const RiskAnalysisChart: React.FC<RiskAnalysisChartProps> = ({
    riskProfile, riskData, loadingRisk, riskError, onRefreshRisk, formatCurrency, t
}) => {
    return (
        <Card className="lg:col-span-2 min-w-0" title={t('riskAnalysis')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                <div className="h-[240px] min-w-0 flex flex-col justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={riskProfile}
                                cx="50%"
                                cy="50%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius={60}
                                outerRadius={90}
                                dataKey="value"
                                paddingAngle={2}
                            >
                                {riskProfile.map((entry, index) => (
                                    <Cell key={`cell-risk-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                            <RechartsTooltip
                                formatter={(val: number) => formatCurrency(val)}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex flex-col justify-center pr-2 py-2">
                    <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 h-full flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Sparkles size={64} className="text-purple-600" />
                        </div>

                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                    <Sparkles size={14} />
                                </div>
                                {t('aiAssessment')}
                            </h4>

                            {riskData && (
                                <button
                                    onClick={onRefreshRisk}
                                    disabled={loadingRisk}
                                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-purple-600 transition-all"
                                    title={t('recalculate')}
                                >
                                    <RefreshCw size={14} className={loadingRisk ? "animate-spin" : ""} />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col justify-center relative z-10">
                            {riskError ? (
                                <div className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                                    {t('unableToGenerate')} {t('apiKeyMissing')}
                                </div>
                            ) : loadingRisk && !riskData ? (
                                <div className="space-y-3 animate-pulse px-1">
                                    <div className="h-2 bg-slate-200 rounded w-full"></div>
                                    <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-2 bg-slate-200 rounded w-5/6"></div>
                                </div>
                            ) : riskData ? (
                                <div className="animate-fade-in">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${riskData.riskScore > 7 ? 'bg-red-50 text-red-600 border-red-100' :
                                                riskData.riskScore > 4 ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                    'bg-green-50 text-green-600 border-green-100'
                                            }`}>
                                            {riskData.riskLevel}
                                        </span>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-slate-800">{riskData.riskScore}</span>
                                            <span className="text-xs text-slate-400">/10</span>
                                        </div>
                                    </div>

                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${riskData.riskScore > 7 ? 'bg-red-500' :
                                                    riskData.riskScore > 4 ? 'bg-orange-500' :
                                                        'bg-green-500'
                                                }`}
                                            style={{ width: `${riskData.riskScore * 10}%` }}
                                        ></div>
                                    </div>

                                    <div className="text-xs text-slate-600 leading-relaxed italic relative pl-3">
                                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-200 rounded-full"></div>
                                        {riskData.analysis}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <button
                                        onClick={onRefreshRisk}
                                        className="px-5 py-2.5 bg-white hover:bg-purple-50 text-purple-600 border border-purple-100 hover:border-purple-200 text-sm font-medium rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 mx-auto group"
                                    >
                                        <Zap size={16} className="group-hover:fill-purple-600 transition-colors" />
                                        {t('startRiskAnalysis')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};
