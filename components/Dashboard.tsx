import React, { Suspense, lazy } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card } from './ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, EyeOff, Wallet, CreditCard, JapaneseYen } from 'lucide-react';
import { Currency } from '../types/domain';
import { Link } from 'react-router-dom';
import { CHART_COLORS as COLORS } from '../utils/theme';

import { usePortfolioSummary } from '../hooks/usePortfolioSummary';
import { useFormatters } from '../hooks/useFormatters';

const NetWorthChart = lazy(() =>
  import('./NetWorthChart').then(m => ({ default: m.NetWorthChart }))
);

const ChartSkeleton = () => (
  <div className="h-full w-full bg-slate-50 rounded-2xl animate-pulse" />
);

export const Dashboard: React.FC = () => {
  const { assets, transactions, settings, exchangeRates, t } = usePortfolio();
  const { summary, allocationData } = usePortfolioSummary();
  const { formatCurrency, formatPercent } = useFormatters();

  const CurrencyIcon = settings.baseCurrency === Currency.CNY ? JapaneseYen : DollarSign;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Worth */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
          {settings.isPrivacyMode && <EyeOff className="absolute top-6 right-6 text-blue-400 opacity-50" size={24} />}
          <div className="flex items-center justify-between mb-4">
            <span className="text-blue-100 font-medium">{t('netWorth')}</span>
            <Link
              to="/settings"
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors cursor-pointer flex items-center justify-center"
              title={t('changeCurrency')}
            >
              <CurrencyIcon size={20} />
            </Link>
          </div>
          <Link to="/assets" className="block cursor-pointer hover:opacity-90 transition-opacity">
            <div className="text-3xl font-bold mb-1">{formatCurrency(summary.totalNetWorth)}</div>
          </Link>
          <div className="text-sm text-blue-100 flex items-center gap-2">
            <span className={summary.totalPnL >= 0 ? "text-green-300" : "text-red-300"}>
              {settings.isPrivacyMode ? '' : (summary.totalPnL >= 0 ? '+' : '')}{formatPercent(summary.totalPnLPercent)}
            </span>
            {t('allTime')}
          </div>
        </div>

        {/* 2. Total Assets */}
        <Card className="flex flex-col justify-center">
          <span className="text-slate-500 font-medium mb-2 flex items-center gap-2">
            <Wallet size={16} className="text-blue-500" /> {t('totalAssets')}
          </span>
          <Link to="/assets" className="block cursor-pointer hover:opacity-75 transition-opacity">
            <div className="text-2xl font-bold text-slate-800 mb-1">{formatCurrency(summary.totalAssetsValue)}</div>
          </Link>
          <div className="text-xs text-slate-400">
            {t('grossValue')}
          </div>
        </Card>

        {/* 3. Total Liabilities (Red styled if exists) */}
        <Card className={`flex flex-col justify-center ${summary.totalLiabilitiesValue > 0 ? 'border-red-100 bg-red-50/30' : ''}`}>
          <span className="text-slate-500 font-medium mb-2 flex items-center gap-2">
            <CreditCard size={16} className="text-red-500" /> {t('totalLiabilities')}
          </span>
          <div className={`text-2xl font-bold mb-1 ${summary.totalLiabilitiesValue > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {summary.totalLiabilitiesValue > 0 ? '-' : ''}{formatCurrency(summary.totalLiabilitiesValue)}
          </div>
          <div className="text-xs text-slate-400">
            {t('outstandingDebt')}
          </div>
        </Card>

        {/* 4. Day P&L */}
        <Card className="flex flex-col justify-center">
          <span className="text-slate-500 font-medium mb-2 flex items-center gap-2">
            {t('dayPnL')} <Activity size={16} />
          </span>
          <div className="text-2xl font-bold text-slate-800 mb-1">{formatCurrency(summary.dayPnL)}</div>
          <div className={`text-sm font-medium flex items-center gap-1 ${summary.dayPnL >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {settings.isPrivacyMode ? null : (summary.dayPnL >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
            {formatPercent(summary.dayPnL !== 0 ? Math.abs(summary.dayPnL / (summary.totalNetWorth || 1)) * 100 : 0)}
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* NEW: Professional Net Worth Chart */}
        <div className="lg:col-span-2 min-w-0 h-[400px]">
          <Suspense fallback={<ChartSkeleton />}>
            <NetWorthChart
              assets={assets}
              transactions={transactions}
              baseCurrency={settings.baseCurrency}
              exchangeRates={exchangeRates}
              isPrivacyMode={settings.isPrivacyMode}
              t={t}
            />
          </Suspense>
        </div>

        {/* Pie Chart */}
        <Card title={`${t('assetAllocation')} (${settings.baseCurrency})`} className="min-w-0">
          <div className="h-[300px] w-full relative min-w-0">
            {settings.isPrivacyMode ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                <EyeOff size={48} className="mb-2" />
                <p>{t('hidden')}</p>
              </div>
            ) : (
              <>
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
                  <div className="text-xs text-slate-400">{t('topAsset')}</div>
                  <div className="font-bold text-slate-700">{allocationData[0]?.name || '-'}</div>
                </div>
              </>
            )}
          </div>
          {!settings.isPrivacyMode && (
            <div className="flex flex-wrap gap-2 justify-center pb-2 mt-2">
              {allocationData.slice(0, 4).map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-500">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  {entry.name} {((entry.value / (allocationData.reduce((acc, c) => acc + c.value, 0) || 1)) * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
