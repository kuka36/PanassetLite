import React from 'react';
import { Card } from '../ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface AssetAllocationChartProps {
    data: { name: string; value: number }[];
    colors: string[];
    formatCurrency: (val: number) => string;
    t: (key: string) => string;
}

export const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({ data, colors, formatCurrency, t }) => {
    return (
        <Card title={t('assetAllocation')} className="lg:col-span-1 min-w-0">
            <div className="h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />
                            ))}
                        </Pie>
                        <RechartsTooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(val: number) => formatCurrency(val)}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};
