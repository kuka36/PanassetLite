import React, { useState } from 'react';
import { Card } from './ui/Card';
import { usePortfolio } from '../context/PortfolioContext';
import { getPortfolioAnalysis } from '../services/geminiService';
import { Sparkles, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const GeminiAdvisor: React.FC = () => {
  const { assets } = usePortfolio();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (assets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPortfolioAnalysis(assets);
      setAnalysis(result);
    } catch (err) {
      setError("Could not generate analysis. Please check your API Key.");
    } finally {
      setLoading(false);
    }
  };

  if (assets.length === 0) return null;

  return (
    <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50/50">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-600 rounded-lg shadow-lg shadow-purple-200">
             <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">AI Portfolio Insights</h3>
            <p className="text-xs text-slate-500">Powered by Gemini 2.5 Flash</p>
          </div>
        </div>
        <button 
          onClick={handleAnalyze}
          disabled={loading}
          className="text-sm px-4 py-2 bg-white border border-slate-200 hover:border-purple-300 text-slate-600 hover:text-purple-600 rounded-lg transition-all flex items-center gap-2"
        >
          {loading ? <RefreshCw className="animate-spin" size={16}/> : "Analyze Now"}
        </button>
      </div>

      {loading && (
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

      {analysis && !loading && (
        <div className="prose prose-sm prose-purple max-w-none text-slate-600">
           {/* Note: In a real app we'd install react-markdown, using simple split for demo if pkg unavailable or raw text */}
           {/* Mocking markdown rendering behavior simply for this environment */}
           <div className="whitespace-pre-wrap leading-relaxed">{analysis}</div>
        </div>
      )}

      {!analysis && !loading && !error && (
        <p className="text-sm text-slate-500 italic">
          Click analyze to get a comprehensive breakdown of your asset allocation, potential risks, and rebalancing suggestions.
        </p>
      )}
    </Card>
  );
};