import React, { useMemo, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { getRiskAssessment } from '../services/geminiService';
import { convertValue } from '../services/marketData';
import { AssetType } from '../types';
import { PieChart as PieIcon } from 'lucide-react';
import { NetWorthStructureChart } from './analytics/NetWorthStructureChart';
import { AssetAllocationChart } from './analytics/AssetAllocationChart';
import { RiskAnalysisChart } from './analytics/RiskAnalysisChart';
import { PerformanceCharts } from './analytics/PerformanceCharts';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#f97316'];
const RISK_COLORS = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
};

interface RiskData {
  riskScore: number;
  riskLevel: string;
  analysis: string;
}

export const Analytics: React.FC = () => {
  const { assets, settings, exchangeRates, t } = usePortfolio();
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [riskError, setRiskError] = useState(false);

  const formatCurrency = (val: number) => {
    if (settings.isPrivacyMode) return '••••••';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: settings.baseCurrency, notation: 'compact' }).format(val);
  };

  const handleRefreshRisk = async () => {
    if (assets.length === 0) return;

    const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;

    if (!apiKey) {
      setRiskError(true);
      return;
    }

    setLoadingRisk(true);
    setRiskError(false);

    try {
      const data = await getRiskAssessment(assets, apiKey, settings.aiProvider, settings.language, true);
      setRiskData(data);
    } catch (e) {
      console.error("Failed to refresh risk assessment", e);
      setRiskError(true);
    } finally {
      setLoadingRisk(false);
    }
  };

  const typeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    assets.forEach(a => {
      if (a.type === AssetType.LIABILITY) return;
      const rawVal = a.quantity * a.currentPrice;
      const val = convertValue(rawVal, a.currency, settings.baseCurrency, exchangeRates);
      dist[a.type] = (dist[a.type] || 0) + val;
    });
    return Object.entries(dist)
      .map(([name, value]) => ({ name: t(`type_${name.toLowerCase()}`), value }))
      .sort((a, b) => b.value - a.value);
  }, [assets, settings.baseCurrency, exchangeRates, t]);

  const liabilityDistribution = useMemo(() => {
    return assets
      .filter(a => a.type === AssetType.LIABILITY)
      .map(a => {
        const rawVal = a.quantity * a.currentPrice;
        const val = convertValue(rawVal, a.currency, settings.baseCurrency, exchangeRates);
        return { name: a.name || a.symbol, value: val };
      })
      .sort((a, b) => b.value - a.value);
  }, [assets, settings.baseCurrency, exchangeRates]);

  const balanceSheet = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;

    assets.forEach(a => {
      const rawVal = a.quantity * a.currentPrice;
      const val = convertValue(rawVal, a.currency, settings.baseCurrency, exchangeRates);

      if (a.type === AssetType.LIABILITY) {
        totalLiabilities += val;
      } else {
        totalAssets += val;
      }
    });

    return {
      data: [
        { name: t('label_assets'), value: totalAssets, fill: '#10b981' },
        { name: t('label_liabilities'), value: totalLiabilities, fill: '#ef4444' }
      ],
      totalAssets,
      totalLiabilities,
      ratio: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
    };
  }, [assets, settings.baseCurrency, exchangeRates, t]);

  const topAssets = useMemo(() => {
    return [...assets]
      .filter(a => a.type !== AssetType.LIABILITY)
      .map(a => {
        const value = convertValue(a.quantity * a.currentPrice, a.currency, settings.baseCurrency, exchangeRates);
        const cost = convertValue(a.quantity * a.avgCost, a.currency, settings.baseCurrency, exchangeRates);
        return {
          name: a.symbol,
          value,
          cost,
          pnl: value - cost
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [assets, settings.baseCurrency, exchangeRates]);

  const riskProfile = useMemo(() => {
    let high = 0, med = 0, low = 0;
    assets.forEach(a => {
      if (a.type === AssetType.LIABILITY) return;
      const rawVal = a.quantity * a.currentPrice;
      const val = convertValue(rawVal, a.currency, settings.baseCurrency, exchangeRates);

      if (a.type === AssetType.CRYPTO) high += val;
      else if (a.type === AssetType.STOCK) med += val;
      else if (a.type === AssetType.REAL_ESTATE) low += val;
      else low += val;
    });

    const total = high + med + low;
    if (total === 0) return [];

    return [
      { name: t('risk_high'), value: high, color: RISK_COLORS.High },
      { name: t('risk_medium'), value: med, color: RISK_COLORS.Medium },
      { name: t('risk_low'), value: low, color: RISK_COLORS.Low }
    ].filter(x => x.value > 0);
  }, [assets, settings.baseCurrency, exchangeRates, t]);

  const pnlRanking = useMemo(() => {
    return [...assets]
      .filter(a => a.type !== AssetType.LIABILITY)
      .map(a => {
        const value = convertValue(a.quantity * a.currentPrice, a.currency, settings.baseCurrency, exchangeRates);
        const cost = convertValue(a.quantity * a.avgCost, a.currency, settings.baseCurrency, exchangeRates);
        const pnl = value - cost;
        return { name: a.symbol, pnl };
      })
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 8);
  }, [assets, settings.baseCurrency, exchangeRates]);

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <PieIcon size={48} className="mb-4 opacity-50" />
        <p>{t('noAssetsAnalytics')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('analytics')}</h1>
          <p className="text-slate-500 text-sm">{t('analyticsSubtitle')}</p>
        </div>
      </div>

      <NetWorthStructureChart
        data={balanceSheet.data}
        ratio={balanceSheet.ratio}
        formatCurrency={formatCurrency}
        isPrivacyMode={settings.isPrivacyMode}
        t={t}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AssetAllocationChart
          data={typeDistribution}
          colors={COLORS}
          formatCurrency={formatCurrency}
          t={t}
        />

        <RiskAnalysisChart
          riskProfile={riskProfile}
          riskData={riskData}
          loadingRisk={loadingRisk}
          riskError={riskError}
          onRefreshRisk={handleRefreshRisk}
          formatCurrency={formatCurrency}
          t={t}
        />
      </div>

      <PerformanceCharts
        topAssets={topAssets}
        pnlRanking={pnlRanking}
        liabilityDistribution={liabilityDistribution}
        formatCurrency={formatCurrency}
        isPrivacyMode={settings.isPrivacyMode}
        t={t}
      />
    </div>
  );
};
