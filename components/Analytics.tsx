
import React, { useMemo, useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { getRiskAssessment } from '../services/geminiService';
import { convertValue } from '../services/marketData';
import { Card } from './ui/Card';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';
import { AssetType } from '../types';
import { PieChart as PieIcon, Sparkles, Scale, RefreshCw } from 'lucide-react';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#f97316'];
const RISK_COLORS = {
  High: '#ef4444', // Crypto
  Medium: '#f59e0b', // Stock
  Low: '#10b981', // Fund/Cash/RealEstate
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
    if (settings.isPrivacyMode) return '****';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: settings.baseCurrency, notation: 'compact' }).format(val);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchRisk = async () => {
      if (assets.length === 0) return;
      if (!settings.geminiApiKey) {
        setRiskError(true);
        return;
      }
      
      setLoadingRisk(true);
      setRiskError(false);
      
      try {
        // Auto-fetch relies on cache internally in service (forceRefresh = false)
        const data = await getRiskAssessment(assets, settings.geminiApiKey, settings.language, false);
        if (isMounted) {
          setRiskData(data);
        }
      } catch (e) {
        console.error("Failed to fetch risk assessment", e);
        if (isMounted) setRiskError(true);
      } finally {
        if (isMounted) {
          setLoadingRisk(false);
        }
      }
    };

    fetchRisk();

    return () => {
      isMounted = false;
    };
  }, [assets, settings.geminiApiKey, settings.language]);

  const handleRefreshRisk = async () => {
    if (!settings.geminiApiKey || assets.length === 0) return;
    
    setLoadingRisk(true);
    setRiskError(false);

    try {
        // Force refresh to bypass cache
        const data = await getRiskAssessment(assets, settings.geminiApiKey, settings.language, true);
        setRiskData(data);
    } catch (e) {
        console.error("Failed to force refresh risk assessment", e);
        setRiskError(true);
    } finally {
        setLoadingRisk(false);
    }
  };

  // --- Data Preparations ---

  // 1. Distribution by Asset Type (Excluding Liabilities)
  const typeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    assets.forEach(a => {
      if (a.type === AssetType.LIABILITY) return; // Exclude debt

      const rawVal = a.quantity * a.currentPrice;
      const val = convertValue(rawVal, a.currency, settings.baseCurrency, exchangeRates);
      dist[a.type] = (dist[a.type] || 0) + val;
    });
    return Object.entries(dist)
      .map(([name, value]) => ({ name: t(`type_${name.toLowerCase()}`), value }))
      .sort((a, b) => b.value - a.value);
  }, [assets, settings.baseCurrency, exchangeRates, t]);

  // 2. Balance Sheet Summary (Assets vs Liabilities)
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
        { name: t('label_assets'), value: totalAssets, fill: '#10b981' }, // Green
        { name: t('label_liabilities'), value: totalLiabilities, fill: '#ef4444' } // Red
      ],
      totalAssets,
      totalLiabilities,
      ratio: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
    };
  }, [assets, settings.baseCurrency, exchangeRates, t]);

  // 3. Visual Risk Distribution (Assets Only)
  const riskProfile = useMemo(() => {
    let high = 0, med = 0, low = 0;
    assets.forEach(a => {
        if (a.type === AssetType.LIABILITY) return; 

        const rawVal = a.quantity * a.currentPrice;
        const val = convertValue(rawVal, a.currency, settings.baseCurrency, exchangeRates);
        
        if(a.type === AssetType.CRYPTO) high += val;
        else if(a.type === AssetType.STOCK) med += val;
        else if(a.type === AssetType.REAL_ESTATE) low += val; 
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

      {/* --- Section 1: Financial Health (The Big Picture) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Net Worth Structure */}
          <Card title={t('netWorthStructure')} className="md:col-span-2">
             <div className="h-[200px] w-full">
                <ResponsiveContainer>
                    <BarChart data={balanceSheet.data} layout="vertical" margin={{left: 0, right: 40, top: 0, bottom: 0}} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tickFormatter={formatCurrency} tick={{fontSize: 11, fill: '#94a3b8'}} axisLine={false} tickLine={false}/>
                        <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12, fontWeight: 500, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                        <RechartsTooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(val: number) => formatCurrency(val)}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                            { balanceSheet.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                            {!settings.isPrivacyMode && (
                                <LabelList dataKey="value" position="right" formatter={formatCurrency} style={{fontSize: '11px', fill: '#64748b', fontWeight: 600}} />
                            )}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </Card>

          {/* 2. Debt Ratio Indicator */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center items-center md:col-span-1 relative overflow-hidden">
              <h3 className="text-slate-500 text-sm font-medium mb-3 flex items-center gap-2 z-10">
                  <Scale size={16} /> {t('debtRatio')}
              </h3>
              
              <div className="relative z-10 text-center mb-2">
                 <div className={`text-3xl font-bold mb-1 ${balanceSheet.ratio > 50 ? 'text-red-500' : (balanceSheet.ratio > 30 ? 'text-orange-500' : 'text-slate-800')}`}>
                     {balanceSheet.ratio.toFixed(1)}%
                 </div>
                 <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                     balanceSheet.ratio > 30 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                 }`}>
                     {balanceSheet.ratio > 30 ? t('highLeverage') : t('healthy')}
                 </div>
              </div>
              {/* Visual Progress Bar at bottom */}
              <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${balanceSheet.ratio > 50 ? 'bg-red-500' : 'bg-green-500'}`} 
                    style={{width: `${Math.min(balanceSheet.ratio, 100)}%`}}
                  ></div>
              </div>
          </div>
      </div>

      {/* --- Section 2: Composition & Risk (The Characteristics) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Asset Allocation */}
        <Card title={t('assetAllocation')} className="lg:col-span-1">
          <div className="h-[240px] w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none"/>
                  ))}
                </Pie>
                <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => formatCurrency(val)} 
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{fontSize: '11px'}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Risk Profile & AI Insight */}
        <Card className="lg:col-span-2" title={t('riskAnalysis')}>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center h-full">
             <div className="h-[240px]">
                <ResponsiveContainer>
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
                        <Cell key={`cell-risk-${index}`} fill={entry.color} stroke="none"/>
                    ))}
                    </Pie>
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{fontSize: '11px'}} />
                    <RechartsTooltip 
                        formatter={(val: number) => formatCurrency(val)}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                </PieChart>
                </ResponsiveContainer>
             </div>
             
             <div className="pr-4 pb-4 h-full flex flex-col justify-center">
                 <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-slate-600 flex items-center gap-2 text-sm">
                        <Sparkles size={14} className="text-purple-500"/>
                        {t('aiAssessment')}
                    </h4>
                    
                    <div className="flex items-center gap-2">
                        {riskData && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                riskData.riskScore > 7 ? 'bg-red-50 text-red-600 border-red-100' : 
                                riskData.riskScore > 4 ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                                'bg-green-50 text-green-600 border-green-100'
                            }`}>
                                {riskData.riskLevel}
                            </span>
                        )}
                        <button 
                            onClick={handleRefreshRisk} 
                            disabled={loadingRisk}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                            title={t('recalculate')}
                        >
                            <RefreshCw size={14} className={loadingRisk ? "animate-spin" : ""} />
                        </button>
                    </div>
                 </div>

                 {riskError ? (
                    <div className="text-xs text-orange-500 bg-orange-50 p-2 rounded border border-orange-100 mt-2">
                        {t('unableToGenerate')}
                    </div>
                 ) : (
                    riskData && (
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed border-l-2 border-purple-200 pl-2">
                            {riskData.analysis}
                        </p>
                    )
                 )}
             </div>
           </div>
        </Card>
      </div>
    </div>
  );
};
