import React from 'react';
import { Card } from '../ui/Card';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell, ResponsiveContainer, LabelList
} from 'recharts';
import { Scale } from 'lucide-react';

interface NetWorthStructureChartProps {
    data: { name: string; value: number; fill: string }[];
    ratio: number;
    formatCurrency: (val: number) => string;
    isPrivacyMode: boolean;
    t: (key: string) => string;
}

export const NetWorthStructureChart: React.FC<NetWorthStructureChartProps> = ({ data, ratio, formatCurrency, isPrivacyMode, t }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title={t('netWorthStructure')} className="md:col-span-2 min-w-0">
                <div className="h-[200px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }} barSize={32}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <RechartsTooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(val: number) => formatCurrency(val)}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                                {!isPrivacyMode && (
                                    <LabelList dataKey="value" position="right" formatter={formatCurrency} style={{ fontSize: '11px', fill: '#64748b', fontWeight: 600 }} />
                                )}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center items-center md:col-span-1 relative overflow-hidden">
                <h3 className="text-slate-500 text-sm font-medium mb-3 flex items-center gap-2 z-10">
                    <Scale size={16} /> {t('debtRatio')}
                </h3>

                <div className="relative z-10 text-center mb-2">
                    <div className={`text-3xl font-bold mb-1 ${ratio > 50 ? 'text-red-500' : (ratio > 30 ? 'text-orange-500' : 'text-slate-800')}`}>
                        {ratio.toFixed(1)}%
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full inline-block ${ratio > 30 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                        }`}>
                        {ratio > 30 ? t('highLeverage') : t('healthy')}
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ${ratio > 50 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(ratio, 100)}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};
