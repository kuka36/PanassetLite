import { useState, useEffect } from 'react';
import { Asset, AppSettings } from '../types';
import { getPortfolioAnalysis, generatePortfolioHash, ADVISOR_CACHE_KEY, ADVISOR_CACHE_TTL } from '../services/geminiService';
import { StorageService } from '../services/StorageService';

export const useAIAdvisor = (assets: Asset[], settings: AppSettings) => {
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canAnalyze, setCanAnalyze] = useState(false);

    useEffect(() => {
        const checkCache = () => {
            if (assets.length === 0) {
                setCanAnalyze(false);
                return;
            }

            const currentHash = generatePortfolioHash(assets);
            const cached = StorageService.getCache<{ hash: string, data: string }>(ADVISOR_CACHE_KEY);

            if (!cached) {
                // No cache -> Enable Analysis
                setCanAnalyze(true);
            } else {
                const { timestamp, data: { hash, data } } = cached;
                const age = Date.now() - timestamp;
                const isStale = age > ADVISOR_CACHE_TTL;
                const hasChanged = hash !== `${currentHash}:${settings.language}:${settings.aiProvider}`;

                // Load cached data into view if available and we haven't generated new data yet
                if (!analysis && data) {
                    setAnalysis(data);
                }

                // The button is enabled ONLY if the portfolio changed OR the data is > 24h old OR Settings Changed
                setCanAnalyze(isStale || hasChanged);
            }
        };

        checkCache();
    }, [assets, analysis, settings.language, settings.aiProvider]);

    const analyze = async () => {
        const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;

        if (!apiKey) {
            throw new Error('API Key is missing');
        }

        if (assets.length === 0) return;

        setLoading(true);
        setError(null);

        try {
            const result = await getPortfolioAnalysis(assets, apiKey, settings.aiProvider, settings.language);
            setAnalysis(result);
            setCanAnalyze(false); // Analysis is now fresh
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'AI Service Unavailable');
        } finally {
            setLoading(false);
        }
    };

    return {
        analysis,
        loading,
        error,
        canAnalyze,
        analyze,
        setError
    };
};
