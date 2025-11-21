import { GoogleGenAI, Type } from "@google/genai";
import { Asset, AssetType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const RISK_CACHE_KEY = 'investflow_risk_cache';
export const RISK_CACHE_TTL = 3600 * 1000; // 1 hour

export const ADVISOR_CACHE_KEY = 'investflow_advisor_cache';
export const ADVISOR_CACHE_TTL = 24 * 3600 * 1000; // 24 hours

// In-memory promise cache to prevent simultaneous duplicate calls
let pendingRiskPromise: { hash: string, promise: Promise<any> } | null = null;
let pendingAdvisorPromise: { hash: string, promise: Promise<string> } | null = null;

export const generatePortfolioHash = (assets: Asset[]) => {
  return assets
    .map(a => `${a.symbol}:${a.quantity}:${a.type}`)
    .sort()
    .join('|');
};

export const getPortfolioAnalysis = async (assets: Asset[]) => {
  if (!process.env.API_KEY) throw new Error("API Key is missing");
  if (assets.length === 0) return "";

  const currentHash = generatePortfolioHash(assets);
  const now = Date.now();

  // 1. Check LocalStorage Cache
  try {
    const cachedRaw = localStorage.getItem(ADVISOR_CACHE_KEY);
    if (cachedRaw) {
      const { hash, timestamp, data } = JSON.parse(cachedRaw);
      if (hash === currentHash && (now - timestamp < ADVISOR_CACHE_TTL)) {
        return data;
      }
    }
  } catch (e) {
    console.warn("InvestFlow: Advisor Cache parse error", e);
  }

  if (pendingAdvisorPromise && pendingAdvisorPromise.hash === currentHash) {
    return pendingAdvisorPromise.promise;
  }

  const apiCall = (async () => {
    const portfolioSummary = assets.map(a => ({
      symbol: a.symbol,
      type: a.type,
      qty: a.quantity,
      estimatedValue: (a.quantity * a.currentPrice).toFixed(0),
      currency: a.currency
    }));

    // Optimized System Prompt for Multi-Asset Wealth Management
    const prompt = `
    You are the AI Wealth Advisor for 'InvestFlow', a comprehensive multi-asset tracking application.
    
    User's Portfolio Data (JSON):
    ${JSON.stringify(portfolioSummary)}

    Analyze this portfolio considering these asset classes:
    - **Liquid Assets**: Stocks, Crypto, Cash (Funds).
    - **Hard Assets**: Real Estate.
    - **Liabilities**: Loans, Mortgages (Negative value).

    Please generate a **concise** strategic report (in Chinese) using Markdown:

    ### 1. 资产概览 (Portfolio Overview)
    Briefly summarize the Net Worth health. Are they over-leveraged (High Debt)? Is liquidity low (Too much Real Estate)?
    
    ### 2. 风险评估 (Risk Assessment)
    Identify concentration risks. 
    *Note: Crypto is High Risk. Real Estate is Illiquid. Single Stock concentration is risky.*
    
    ### 3. 优化建议 (Actionable Advice)
    Provide 3 specific bullet points on how to balance the portfolio (e.g., "Pay down high-interest debt", "Diversify into ETFs", "Increase cash reserves").

    **Tone:** Professional, Insightful, Objective.
    **Language:** Chinese (Simplified).
    **Length:** Max 300 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const textResult = response.text || "暂时无法生成分析报告。";

    try {
      localStorage.setItem(ADVISOR_CACHE_KEY, JSON.stringify({
        hash: currentHash,
        timestamp: Date.now(),
        data: textResult
      }));
    } catch (e) {
      console.warn("InvestFlow: Failed to save advisor cache", e);
    }

    return textResult;
  })();

  pendingAdvisorPromise = { hash: currentHash, promise: apiCall };

  try {
    return await apiCall;
  } finally {
    pendingAdvisorPromise = null;
  }
};

export const getRiskAssessment = async (assets: Asset[]) => {
  if (!process.env.API_KEY) throw new Error("API Key is missing");
  if (assets.length === 0) return null;

  const currentHash = generatePortfolioHash(assets);
  const now = Date.now();

  try {
    const cachedRaw = localStorage.getItem(RISK_CACHE_KEY);
    if (cachedRaw) {
      const { hash, timestamp, data } = JSON.parse(cachedRaw);
      if (hash === currentHash && (now - timestamp < RISK_CACHE_TTL)) {
        return data;
      }
    }
  } catch (e) {}

  if (pendingRiskPromise && pendingRiskPromise.hash === currentHash) {
     return pendingRiskPromise.promise;
  }

  const apiCall = (async () => {
    const portfolioSummary = assets.map(a => ({
      type: a.type,
      val: (a.quantity * a.currentPrice).toFixed(0),
    }));

    const prompt = `
      Analyze the risk of this portfolio structure: ${JSON.stringify(portfolioSummary)}.
      Consider: Crypto (High), Stocks (Med-High), Real Estate (Low/Illiquid), Cash (Low).
      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER, description: "1-10 Score" },
            riskLevel: { type: Type.STRING, description: "Conservative to Aggressive" },
            analysis: { type: Type.STRING, description: "Max 60 words summary in Chinese" }
          },
          required: ["riskScore", "riskLevel", "analysis"]
        }
      }
    });

    const data = JSON.parse(response.text as string);

    try {
      localStorage.setItem(RISK_CACHE_KEY, JSON.stringify({
        hash: currentHash,
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {}

    return data;
  })();

  pendingRiskPromise = { hash: currentHash, promise: apiCall };

  try {
      return await apiCall;
  } finally {
      pendingRiskPromise = null;
  }
};