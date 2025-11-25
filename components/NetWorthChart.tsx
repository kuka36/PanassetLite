
import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line 
} from 'recharts';
import { Asset, Transaction, TransactionType, AssetType, Currency } from '../types';
import { convertValue, ExchangeRates, fetchAssetHistory, HistoricalDataPoint } from '../services/marketData';
import { Calendar, TrendingUp, TrendingDown, MousePointer2, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';

interface NetWorthChartProps {
  assets: Asset[];
  transactions: Transaction[];
  baseCurrency: Currency;
  exchangeRates: ExchangeRates;
  isPrivacyMode: boolean;
  t: (key: string) => string;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// Helper to generate array of dates
const getDatesInRange = (startDate: Date, endDate: Date) => {
    const dates = [];
    const theDate = new Date(startDate);
    // Safety break to prevent infinite loops
    let loops = 0;
    while (theDate <= endDate && loops < 5000) {
        dates.push(new Date(theDate).toISOString().split('T')[0]);
        theDate.setDate(theDate.getDate() + 1);
        loops++;
    }
    return dates;
};

export const NetWorthChart: React.FC<NetWorthChartProps> = ({ 
  assets, 
  transactions, 
  baseCurrency, 
  exchangeRates,
  isPrivacyMode,
  t
}) => {
  const { settings } = usePortfolio();
  const [range, setRange] = useState<TimeRange>('1M');
  const [historyMap, setHistoryMap] = useState<Record<string, HistoricalDataPoint[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // 1. Fetch History
  useEffect(() => {
    const loadData = async () => {
      if (assets.length === 0) return;
      
      setLoadingHistory(true);
      const map: Record<string, HistoricalDataPoint[]> = {};
      const apiKey = settings.alphaVantageApiKey;

      // Process in chunks
      const promises = assets.map(async (asset) => {
        // Skip manual assets history fetch to speed up
        if (asset.type === AssetType.REAL_ESTATE || asset.type === AssetType.LIABILITY || asset.type === AssetType.OTHER || asset.type === AssetType.CASH) {
             return { id: asset.id, data: [] };
        }

        if (!historyMap[asset.id] || historyMap[asset.id].length === 0) {
            try {
                return { id: asset.id, data: await fetchAssetHistory(asset, apiKey) };
            } catch (e) {
                return { id: asset.id, data: [] };
            }
        }
        return { id: asset.id, data: historyMap[asset.id] };
      });

      const results = await Promise.all(promises);
      results.forEach(r => map[r.id] = r.data);
      
      setHistoryMap(map);
      setLoadingHistory(false);
    };

    loadData();
  }, [assets.length, settings.alphaVantageApiKey]); 

  // 2. Format Helpers
  const formatCurrency = (val: number) => {
    if (isPrivacyMode) return '****';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: baseCurrency, 
      notation: "compact", 
      maximumFractionDigits: 1 
    }).format(val);
  };

  // 3. Build Lookup Map for Price (Optimized for O(1) access)
  const priceLookupMap = useMemo(() => {
      const lookup: Record<string, Map<string, number>> = {};
      
      Object.keys(historyMap).forEach(assetId => {
          const points = historyMap[assetId];
          const assetMap = new Map<string, number>();
          // Sort to ensure order
          const sortedPoints = [...points].sort((a, b) => a.date.localeCompare(b.date));
          
          sortedPoints.forEach(p => {
              assetMap.set(p.date, p.price);
          });
          lookup[assetId] = assetMap;
      });
      return lookup;
  }, [historyMap]);

  // 4. Core Calculation: Forward Replay with Synthetic Transactions
  const chartData = useMemo(() => {
    if (assets.length === 0) return [];
    
    // Safety check: if transactions are undefined, default to empty
    const safeTransactions = transactions || [];

    // A. Generate Synthetic Transactions for "Simple Mode" assets (Legacy Support)
    // If an asset has NO transactions in the log, we treat its current state as the Initial Buy.
    const assetIdsWithTx = new Set(safeTransactions.map(t => t.assetId));
    const syntheticTransactions: any[] = [];
    
    assets.forEach(a => {
        if (!assetIdsWithTx.has(a.id)) {
            const date = a.dateAcquired || new Date().toISOString().split('T')[0]; 
            // Create a synthetic transaction that matches the Transaction interface
            syntheticTransactions.push({
                id: `synthetic-${a.id}`,
                assetId: a.id,
                type: a.type === AssetType.LIABILITY ? TransactionType.BORROW : TransactionType.BUY,
                date: date,
                quantityChange: a.quantity, // Normalized field
                pricePerUnit: a.avgCost,
                fee: 0,
                total: a.quantity * a.avgCost
            });
        }
    });

    const allTransactions = [...safeTransactions, ...syntheticTransactions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // B. Determine Timeline
    const now = new Date();
    const startDate = new Date();
    
    // Find first ever transaction time (real or synthetic)
    const firstTxTime = allTransactions.length > 0 
        ? Math.min(...allTransactions.map(t => new Date(t.date).getTime())) 
        : now.getTime();
    const firstTxDate = new Date(firstTxTime);

    switch (range) {
      case '1W': startDate.setDate(now.getDate() - 7); break;
      case '1M': startDate.setDate(now.getDate() - 30); break;
      case '3M': startDate.setDate(now.getDate() - 90); break;
      case '6M': startDate.setDate(now.getDate() - 180); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case 'ALL': 
        startDate.setTime(firstTxTime); 
        startDate.setDate(startDate.getDate() - 2); // Buffer
        break;
    }

    // Replay start date logic
    const replayStartDate = new Date(Math.min(startDate.getTime(), firstTxDate.getTime()));
    replayStartDate.setHours(0,0,0,0);
    
    const dateList = getDatesInRange(replayStartDate, now);

    // C. Simulation State
    const currentHoldings: Record<string, number> = {};
    const currentCostBasis: Record<string, number> = {}; 
    
    // Initialize
    assets.forEach(a => {
        currentHoldings[a.id] = 0;
        currentCostBasis[a.id] = 0;
    });

    // Last Known Prices Map (Forward Fill)
    const lastKnownPrices: Record<string, number> = {};
    assets.forEach(a => {
        const history = historyMap[a.id];
        // Use history start if available, else current price
        if (history && history.length > 0) {
            // Find closest price to replay start? No, just track forward.
            lastKnownPrices[a.id] = history[0].price;
        } else {
            lastKnownPrices[a.id] = a.currentPrice;
        }
    });

    const dataPoints = [];

    // D. Iterate
    for (const dateStr of dateList) {
        // 1. Update Prices for this date (if available)
        assets.forEach(a => {
             const priceMap = priceLookupMap[a.id];
             if (priceMap && priceMap.has(dateStr)) {
                 lastKnownPrices[a.id] = priceMap.get(dateStr)!;
             }
        });

        // 2. Apply Transactions happening ON this date
        const daysTransactions = allTransactions.filter(t => t.date === dateStr);
        
        for (const tx of daysTransactions) {
            if (currentHoldings[tx.assetId] === undefined) currentHoldings[tx.assetId] = 0;
            if (currentCostBasis[tx.assetId] === undefined) currentCostBasis[tx.assetId] = 0;

            // Handle signed quantityChange correctly
            const qtyChange = tx.quantityChange || 0;
            const absQty = Math.abs(qtyChange);
            const total = tx.total || 0;

            if (tx.type === TransactionType.BUY || tx.type === TransactionType.DEPOSIT || tx.type === TransactionType.BORROW || tx.type === TransactionType.BALANCE_ADJUSTMENT) {
                // If Balance Adjustment is positive, it's like a Buy
                if (qtyChange >= 0) {
                    currentHoldings[tx.assetId] += qtyChange;
                    currentCostBasis[tx.assetId] += total;
                } else {
                    // Negative Adjustment (Reduction)
                     const previousQty = currentHoldings[tx.assetId];
                     if (previousQty > 0) {
                         const ratio = absQty / previousQty;
                         currentCostBasis[tx.assetId] -= (currentCostBasis[tx.assetId] * ratio);
                     }
                     currentHoldings[tx.assetId] -= absQty;
                }
            } else if (tx.type === TransactionType.SELL || tx.type === TransactionType.WITHDRAWAL || tx.type === TransactionType.REPAY) {
                const previousQty = currentHoldings[tx.assetId];
                if (previousQty > 0) {
                    // Reduce cost basis proportionally
                    const ratio = absQty / previousQty;
                    currentCostBasis[tx.assetId] -= (currentCostBasis[tx.assetId] * ratio);
                }
                currentHoldings[tx.assetId] -= absQty;
                if (currentHoldings[tx.assetId] < 0) currentHoldings[tx.assetId] = 0;
            }
        }

        // 3. Calculate Daily Aggregate Value
        let dayNetWorth = 0;
        let dayTotalCost = 0;

        assets.forEach(asset => {
            const qty = currentHoldings[asset.id] || 0;
            const price = lastKnownPrices[asset.id];

            if (qty > 0) {
                const val = convertValue(qty * price, asset.currency, baseCurrency, exchangeRates);
                const cost = convertValue(currentCostBasis[asset.id], asset.currency, baseCurrency, exchangeRates);

                if (asset.type === AssetType.LIABILITY) {
                    dayNetWorth -= val;
                    // Liabilities don't usually add to "Investment Cost" in the same way, 
                    // but for Net Worth tracking, we subtract the value.
                } else {
                    dayNetWorth += val;
                    dayTotalCost += cost;
                }
            }
        });

        // 4. Push Data (Only if within requested range)
        if (dateStr >= startDate.toISOString().split('T')[0]) {
            dataPoints.push({
                date: dateStr,
                displayDate: new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                value: dayNetWorth,
                cost: dayTotalCost,
                pnl: dayNetWorth - dayTotalCost,
                pnlPercent: dayTotalCost !== 0 ? ((dayNetWorth - dayTotalCost) / dayTotalCost) * 100 : 0
            });
        }
    }

    return dataPoints;
  }, [assets, transactions, range, baseCurrency, exchangeRates, historyMap, priceLookupMap]);

  const isProfitable = chartData.length > 0 && (chartData[chartData.length-1].pnl >= 0);
  const colorMain = isProfitable ? '#10b981' : '#ef4444';
  const colorCost = '#94a3b8';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl shadow-xl border border-slate-100 text-xs sm:text-sm animate-in fade-in zoom-in-95 duration-150 max-w-[180px] sm:max-w-none">
          <p className="text-slate-500 font-medium mb-1.5 sm:mb-2 border-b border-slate-50 pb-1">{data.displayDate}</p>
          
          <div className="flex items-center justify-between gap-3 sm:gap-6 mb-1">
            <span className="text-slate-500 flex items-center gap-1">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{background: colorMain}}></div>
                {t('value')}
            </span>
            <span className="font-bold text-slate-700">{formatCurrency(data.value)}</span>
          </div>

          <div className="flex items-center justify-between gap-3 sm:gap-6 mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
                 <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-300"></div>
                 {t('label_cost')}
            </span>
            <span className="font-medium text-slate-400">{formatCurrency(data.cost)}</span>
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-50 font-medium ${data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <span>{data.pnl >= 0 ? t('label_net_pnl') : 'Loss'}</span>
            <div className="flex items-center gap-1">
                {data.pnl >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                <span>{formatCurrency(Math.abs(data.pnl))} <span className="text-[10px] opacity-80">({Math.abs(data.pnlPercent).toFixed(1)}%)</span></span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const hasStocks = assets.some(a => a.type === AssetType.STOCK || a.type === AssetType.FUND);
  const missingKey = hasStocks && !settings.alphaVantageApiKey;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                {t('netWorthTrend')}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MousePointer2 size={12} /> {t('costVsValue')}
                {loadingHistory && <span className="flex items-center gap-1 text-blue-500 ml-2"><RefreshCw size={10} className="animate-spin"/> Syncing...</span>}
            </p>
        </div>

        <div className="flex bg-slate-50 p-1 rounded-lg self-start sm:self-auto overflow-x-auto max-w-full">
            {(['1W', '1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map((r) => (
                <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                        range === r 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    {r}
                </button>
            ))}
        </div>
      </div>

      {missingKey && !loadingHistory && hasStocks && (
        <div className="bg-amber-50 px-4 py-2 text-[10px] text-amber-700 flex items-center justify-center gap-2 border-b border-amber-100">
           <AlertTriangle size={12} />
           <span>For accurate stock history, please add Alpha Vantage API Key in Settings.</span>
        </div>
      )}

      <div className="p-4 flex-1 min-h-[320px]">
        {isPrivacyMode ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                    <MousePointer2 size={24} className="text-slate-300"/>
                </div>
                <p>{t('chartHidden')}</p>
            </div>
        ) : chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colorMain} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={colorMain} stopOpacity={0}/>
                </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                    dataKey="displayDate" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 11}} 
                    minTickGap={30}
                />
                <YAxis 
                    hide={true} 
                    domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                
                <Line 
                    type="stepAfter" 
                    dataKey="cost" 
                    stroke={colorCost} 
                    strokeWidth={2} 
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={false}
                    name="Invested"
                />
                
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={colorMain} 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorNetWorth)" 
                    activeDot={{ r: 4, strokeWidth: 0, fill: colorMain }}
                    name="Net Worth"
                />
            </AreaChart>
            </ResponsiveContainer>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                {loadingHistory ? (
                   <RefreshCw size={32} className="mb-2 animate-spin text-blue-400"/>
                ) : (
                   <Calendar size={32} className="mb-2 opacity-50"/>
                )}
                <span className="text-sm">{loadingHistory ? 'Syncing market data...' : t('noTransactions')}</span>
            </div>
        )}
      </div>
    </div>
  );
};
