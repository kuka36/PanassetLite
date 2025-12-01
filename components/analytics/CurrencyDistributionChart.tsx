import React from 'react';
import { Card } from '../ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface CurrencyDistributionChartProps {
    data: { name: string; value: number }[];
    colors: string[];
    formatCurrency: (val: number) => string;
    t: (key: string) => string;
}

// 币种对应的颜色映射，确保视觉区分度
const CURRENCY_COLORS: Record<string, string> = {
    USD: '#10b981', // 绿色 - 美元
    CNY: '#ef4444', // 红色 - 人民币
    HKD: '#f59e0b', // 橙色 - 港币
};

export const CurrencyDistributionChart: React.FC<CurrencyDistributionChartProps> = ({
    data,
    colors,
    formatCurrency,
    t
}) => {
    // 使用预定义的币种颜色，如果没有则回退到默认颜色
    const getColor = (currencyName: string, index: number) => {
        return CURRENCY_COLORS[currencyName] || colors[index % colors.length];
    };

    return (
        <Card title={t('currencyDistribution')} className="lg:col-span-1 min-w-0">
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
                                <Cell
                                    key={`cell-${index}`}
                                    fill={getColor(entry.name, index)}
                                    stroke="none"
                                />
                            ))}
                        </Pie>
                        <RechartsTooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(val: number) => formatCurrency(val)}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '11px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};
