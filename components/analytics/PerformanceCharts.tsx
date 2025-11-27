import React from 'react';
import { Card } from '../ui/Card';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Cell, ResponsiveContainer, LabelList, ReferenceLine, PieChart, Pie
} from 'recharts';

interface PerformanceChartsProps {
    topAssets: any[];
    pnlRanking: any[];
    liabilityDistribution: any[];
    formatCurrency: (val: number) => string;
    isPrivacyMode: boolean;
    t: (key: string) => string;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
    topAssets, pnlRanking, liabilityDistribution, formatCurrency, isPrivacyMode, t
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <Card title={t('costVsValue')} className="min-w-0">
                <div className="h-[250px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topAssets} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" tickFormatter={formatCurrency} hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={50}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                interval={0}
                            />
                            <RechartsTooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(val: number) => formatCurrency(val)}
                            />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="cost" name={t('label_cost')} fill="#cbd5e1" radius={[0, 3, 3, 0]} barSize={8} />
                            <Bar dataKey="value" name={t('label_value')} fill="#3b82f6" radius={[0, 3, 3, 0]} barSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card title={t('topMovers')} className="min-w-0">
                <div className="h-[250px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pnlRanking} margin={{ top: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <RechartsTooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(val: number) => formatCurrency(val)}
                            />
                            <Bar dataKey="pnl" name={t('label_net_pnl')} radius={[4, 4, 0, 0]}>
                                {pnlRanking.map((entry, index) => (
                                    <Cell key={`cell-pnl-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                                {!isPrivacyMode && (
                                    <LabelList
                                        dataKey="pnl"
                                        position="top"
                                        formatter={(val: number) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(val)}
                                        style={{ fontSize: '10px', fill: '#94a3b8' }}
                                    />
                                )}
                            </Bar>
                            <ReferenceLine y={0} stroke="#cbd5e1" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {liabilityDistribution.length > 0 && (
                <Card title={t('liabilityBreakdown')} className="md:col-span-2 min-w-0">
                    <div className="h-[180px] w-full flex items-center justify-center min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={liabilityDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {liabilityDistribution.map((entry, index) => (
                                        <Cell key={`cell-liab-${index}`} fill={index % 2 === 0 ? '#ef4444' : '#f87171'} stroke="none" />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val: number) => formatCurrency(val)}
                                />
                                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
        </div>
    );
};
