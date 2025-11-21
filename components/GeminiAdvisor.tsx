import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { usePortfolio } from '../context/PortfolioContext';
import { getPortfolioAnalysis, generatePortfolioHash, ADVISOR_CACHE_KEY, ADVISOR_CACHE_TTL } from '../services/geminiService';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, CheckCircle } from 'lucide-react';

export const GeminiAdvisor: React.FC = () => {
  const { assets } = usePortfolio();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canAnalyze, setCanAnalyze] = useState(false);

  // Check cache status whenever assets change or component mounts
  useEffect(() => {
    const checkCache = () => {
        if (assets.length === 0) {
            setCanAnalyze(false);
            return;
        }

        const currentHash = generatePortfolioHash(assets);
        const cachedRaw = localStorage.getItem(ADVISOR_CACHE_KEY);
        
        if (!cachedRaw) {
            // No cache -> Enable Analysis
            setCanAnalyze(true);
            // Also try to auto-fetch if this is the very first load and no analysis exists?
            // User preference usually implies manual "Analyze" for costs, but we can auto-load if desired.
            // For now, we just enable the button.
        } else {
            try {
                const { hash, timestamp, data } = JSON.parse(cachedRaw);
                const age = Date.now() - timestamp;
                const isStale = age > ADVISOR_CACHE_TTL;
                const hasChanged = hash !== currentHash;

                // If data is already loaded into state, fine. If not, load it from cache.
                if (!analysis && data) {
                    setAnalysis(data);
                }

                // Enable button ONLY if stale OR changed
                setCanAnalyze(isStale || hasChanged);

            } catch (e) {
                setCanAnalyze(true);
            }
        }
    };

    checkCache();
  }, [assets, analysis]);

  // Initial load (from cache only, don't trigger API)
  useEffect(() => {
     const loadInitial = () => {
        const cachedRaw = localStorage.getItem(ADVISOR_CACHE_KEY);
        if (cachedRaw) {
            try {
                const { data } = JSON.parse(cachedRaw);
                if (data) setAnalysis(data);
            } catch (e) { /* ignore */ }
        }
     };
     loadInitial();
  }, []);

  const handleAnalyze = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (assets.length === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      // Force fresh analysis
      // Note: getPortfolioAnalysis handles caching internally, but since we know we want a refresh 
      // based on our UI logic, calling it here will use the internal logic.
      // Actually, getPortfolioAnalysis returns cache if valid. 
      // If we want to FORCE, we might need to clear cache or just rely on the fact 
      // that our UI 'canAnalyze' logic aligns with the service's internal logic 
      // (service returns cache if < 24h and hash same).
      // If canAnalyze is true, it means hash changed OR time > 24h, so service WILL fetch new data.
      const result = await getPortfolioAnalysis(assets);
      setAnalysis(result);
      if (!isExpanded) setIsExpanded(true);
      setCanAnalyze(false); // Reset button state
    } catch (err) {
      setError("Could not generate analysis. Please check your API Key.");
    } finally {
      setLoading(false);
    }
  };

  if (assets.length === 0) return null;

  return (
    <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50/50 transition-all duration-300">
      <div 
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600 rounded-lg shadow-lg shadow-purple-200">
                <Sparkles className="text-white" size={20} />
            </div>
            <div>
                <h3 className="font-bold text-slate-800">AI Portfolio Insights</h3>
                <p className="text-xs text-slate-500">Daily Analysis • Powered by Gemini</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
            {canAnalyze ? (
                <button 
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="text-sm px-4 py-2 bg-white border border-slate-200 hover:border-purple-300 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all flex items-center gap-2 shadow-sm z-10 font-medium"
                >
                    {loading ? <RefreshCw className="animate-spin" size={16}/> : <><Sparkles size={16} /> Analyze Now</>}
                </button>
            ) : (
                <div className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg border border-green-100 flex items-center gap-1">
                    <CheckCircle size={12} /> Up to date
                </div>
            )}
            <div className="text-slate-400 hover:text-purple-600 transition-colors p-1">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-purple-100/50 animate-fade-in">
            {loading && !analysis && (
                <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-purple-100 rounded w-3/4"></div>
                <div className="h-4 bg-purple-100 rounded w-1/2"></div>
                <div className="h-4 bg-purple-100 rounded w-5/6"></div>
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
                </div>
            )}

            {analysis && (
                <div className="prose prose-sm prose-purple max-w-none text-slate-600">
                <div className="whitespace-pre-wrap leading-relaxed">{analysis}</div>
                </div>
            )}
        </div>
      )}
    </Card>
  );
};