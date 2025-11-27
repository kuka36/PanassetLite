import React, { useState } from 'react';
import { Card } from './ui/Card';
import { usePortfolio } from '../context/PortfolioContext';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, CheckCircle, Key } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAIAdvisor } from './useAIAdvisor';

export const GeminiAdvisor: React.FC = () => {
  const { assets, settings, t } = usePortfolio();
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    analysis,
    loading,
    error,
    canAnalyze,
    analyze,
    setError
  } = useAIAdvisor(assets, settings);

  const handleAnalyze = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Check key before calling hook action to show UI error immediately if needed
    const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;
    if (!apiKey) {
      setError(t('apiKeyMissing'));
      setIsExpanded(true);
      return;
    }

    setIsExpanded(true);
    await analyze();
  };

  if (assets.length === 0) return null;

  return (
    <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50/50 transition-all duration-300">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-purple-600 rounded-lg shadow-md shadow-purple-200 shrink-0">
            <Sparkles className="text-white" size={18} />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate leading-tight">{t('aiInsights')}</h3>
            <p className="text-xs text-slate-500 hidden sm:block truncate mt-0.5">{t('wealthManagement')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
          {canAnalyze ? (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-slate-200 hover:border-purple-300 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm z-10 font-medium"
            >
              {loading ? <RefreshCw className="animate-spin" size={14} /> : <><Sparkles size={14} /> <span>{t('analyzeNow')}</span></>}
            </button>
          ) : (
            <div className="text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 bg-green-50 text-green-600 rounded-lg border border-green-100 flex items-center gap-1 whitespace-nowrap">
              <CheckCircle size={12} /> <span className="hidden sm:inline">{t('upToDate')}</span>
            </div>
          )}
          <div className="text-slate-400 hover:text-purple-600 transition-colors p-1">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-purple-100/50 animate-fade-in">
          {loading && !analysis && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-purple-100 rounded w-3/4"></div>
              <div className="h-4 bg-purple-100 rounded w-1/2"></div>
              <div className="h-4 bg-purple-100 rounded w-5/6"></div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex justify-between items-center">
              <span>{error}</span>
              <Link to="/settings" className="flex items-center gap-1 text-blue-600 hover:underline font-medium">
                <Key size={14} /> {t('setKey')}
              </Link>
            </div>
          )}

          {analysis && (
            <div className="prose prose-sm prose-purple max-w-none text-slate-600">
              <div className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">{analysis}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};