import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

export const Dashboard: React.FC = () => {
  const { assets } = usePortfolio();

  // Calculate Summaries
  const summary = useMemo(() => {
    let totalBalance = 0;
    let totalCost = 0;
    let dayPnL = 0;

    assets.forEach(asset => {
      const value = asset.quantity * asset.currentPrice;
      const cost = asset.quantity * asset.avgCost;
      totalBalance += value;
      totalCost += cost;
      // Mocking Day PnL as 1.2% of value just for demo visualization if real API absent
      // In a real app, this comes from (currentPrice - prevClose) * quantity
      dayPnL += value * (Math.random() * 0.05 - 0.02); 
    });

    const totalPnL = totalBalance - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    return { totalBalance, totalCost, totalPnL, totalPnLPercent, dayPnL };
  }, [assets]);

  // Prepare Pie Chart Data
  const allocationData = useMemo(() => {
    return assets.map(asset => ({
      name: asset.symbol,
      value: asset.quantity * asset.currentPrice
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [assets]);

  // Prepare Mock History Data for Area Chart
  const historyData = useMemo(() => {
    const data = [];
    let balance = summary.totalCost || 10000; 
    // Generate 30 days of mock history trending towards current balance
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const volatility = (Math.random() - 0.45) * (balance * 0.02);
      balance += volatility;
      // Force the last point to match current actual balance for smoothness
      if (i === 0) balance = summary.totalBalance;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.max(0, balance)
      });
    }
    return data;
  }, [summary.totalBalance, summary.totalCost]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <span className="text-blue-100 font-medium">Total Balance</span>
                <div className="p-2 bg-white/20 rounded-lg"><DollarSign size={20} /></div>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(summary.totalBalance)}</div>
            <div className="text-sm text-blue-100">Asset Net Worth</div>
        </div>

        <Card className="flex flex-col justify-center">
            <span className="text-slate-500 font-medium mb-2 flex items-center gap-2">
                Today's P&L <Activity size={16} />
            </span>
            <div className="text-2xl font-bold text-slate-800 mb-1">{formatCurrency(summary.dayPnL)}</div>
            <div className={`text-sm font-medium flex items-center gap-1 ${summary.dayPnL >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {summary.dayPnL >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                {(Math.abs(summary.dayPnL / summary.totalBalance) * 100).toFixed(2)}%
            </div>
        </Card>

        <Card className="flex flex-col justify-center">
            <span className="text-slate-500 font-medium mb-2">Unrealized P&L</span>
            <div className="text-2xl font-bold text-slate-800 mb-1">{formatCurrency(summary.totalPnL)}</div>
            <div className={`text-sm font-medium flex items-center gap-1 ${summary.totalPnL >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                 {summary.totalPnL >= 0 ? '+' : ''}{summary.totalPnLPercent.toFixed(2)}% All time
            </div>
        </Card>

        <Card className="flex flex-col justify-center">
            <span className="text-slate-500 font-medium mb-2">Active Assets</span>
            <div className="text-2xl font-bold text-slate-800 mb-1">{assets.length}</div>
            <div className="text-sm text-slate-400">Across {new Set(assets.map(a => a.type)).size} Categories</div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <Card title="Net Worth Trend (30D)" className="lg:col-span-2">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis tickFormatter={(val) => `$${val/1000}k`} tickLine={false} axisLine={false} tick={{fill: '#64748b', fontSize: 12}} width={40}/>
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pie Chart */}
        <Card title="Allocation">
          <div className="h-[300px] w-full flex flex-col items-center justify-center relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                     formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Legend Overlay */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <div className="text-xs text-slate-400">Top Asset</div>
                <div className="font-bold text-slate-700">{allocationData[0]?.name || '-'}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pb-2">
              {allocationData.slice(0, 4).map((entry, idx) => (
                  <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-500">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      {entry.name} {((entry.value / summary.totalBalance) * 100).toFixed(0)}%
                  </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
};