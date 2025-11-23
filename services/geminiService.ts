

import { Type } from "@google/genai";
import { Asset, AssetType, Language, AIProvider, VoiceParseResult } from "../types";
import { AIEngineFactory } from "./aiEngine";

export const RISK_CACHE_KEY = 'investflow_risk_cache';
export const RISK_CACHE_TTL = 3600 * 1000; // 1 hour

export const ADVISOR_CACHE_KEY = 'investflow_advisor_cache';
export const ADVISOR_CACHE_TTL = 24 * 3600 * 1000; // 24 hours

// In-memory promise cache to prevent simultaneous duplicate calls
let pendingRiskPromise: { hash: string, promise: Promise<any> } | null = null;
let pendingAdvisorPromise: { hash: string, promise: Promise<string> } | null = null;

export const generatePortfolioHash = (assets: Asset[]) => {
  return assets
    .map(a => {
      const isManualValuation = a.type === AssetType.REAL_ESTATE || a.type === AssetType.LIABILITY || a.type === AssetType.OTHER;
      const pricePart = isManualValuation ? `:${a.currentPrice}` : '';
      return `${a.symbol}:${a.quantity}:${a.type}${pricePart}`;
    })
    .sort()
    .join('|');
};

export const getPortfolioAnalysis = async (assets: Asset[], apiKey: string, provider: AIProvider, language: Language = 'en', forceRefresh: boolean = false) => {
  if (!apiKey) throw new Error("API Key is missing");
  if (assets.length === 0) return "";

  const currentHash = `${generatePortfolioHash(assets)}:${language}:${provider}`;
  const now = Date.now();

  // 1. Check LocalStorage Cache
  if (!forceRefresh) {
    try {
      const cachedRaw = localStorage.getItem(ADVISOR_CACHE_KEY);
      if (cachedRaw) {
        const { hash, timestamp, data } = JSON.parse(cachedRaw);
        if (hash === currentHash && (now - timestamp < ADVISOR_CACHE_TTL)) {
          return data;
        }
      }
    } catch (e) {
      console.warn("PanassetLite: Advisor Cache parse error", e);
    }
  }

  if (pendingAdvisorPromise && pendingAdvisorPromise.hash === currentHash && !forceRefresh) {
    return pendingAdvisorPromise.promise;
  }

  const apiCall = (async () => {
    const portfolioSummary = assets.map(a => ({
      symbol: a.symbol,
      type: a.type,
      qty: a.quantity,
      val: (a.quantity * a.currentPrice).toFixed(0),
      curr: a.currency
    }));

    const targetLanguage = language === 'zh' ? 'Chinese (Simplified)' : 'English';

    // Optimized System Prompt
    const prompt = `
    You are the Chief Investment Officer (CIO) for 'PanassetLite' (盘资产·轻), a private wealth management platform.

    **User Portfolio Snapshot (For Analysis Only):**
    ${JSON.stringify(portfolioSummary)}

    **Financial Context:**
    - **Net Worth** = Total Assets - Total Liabilities.
    - **Liquid Assets**: Stocks, Crypto, Cash, Funds.
    - **Illiquid Assets**: Real Estate (Low volatility, hard to sell).
    - **Liabilities**: Loans, Mortgages (Negative impact on Net Worth).

    **STRICT PRIVACY & OUTPUT RULES:**
    1. **NO ABSOLUTE NUMBERS:** You are generating a report for a privacy-focused dashboard. **DO NOT** output any specific monetary values (e.g., do NOT write "$10,000", "72,361 RMB", or "1.5 BTC") in the final report.
    2. **USE RATIOS & PERCENTAGES:** Instead of numbers, use percentages (%), ratios, and qualitative terms (e.g., "healthy buffer", "significant portion", "minor allocation").
    3. **LANGUAGE:** The output must be in **${targetLanguage}**.

    **Task:**
    Generate a strategic wealth analysis report. Use Markdown.

    **Structure:**
    1.  **Wealth Health Check**:
        - Analyze the **Net Worth** structure (Asset vs Liability mix) using percentages only.
        - Assess **Debt-to-Asset Ratio**. (Liabilities > 30% is caution).
        - Assess **Liquidity**. Are they over-leveraged or too illiquid?

    2.  **Risk & Allocation**:
        - Evaluate exposure to High Volatility (Crypto) vs Stable Assets (Real Estate/Cash) based on portfolio weight.
        - Comment on concentration risk (e.g., "Allocated heavily in a single asset").

    3.  **Strategic Recommendations**:
        - Provide 3 specific, actionable steps to optimize the portfolio based on the asset mix.

    **Tone:** Professional, insightful, objective, and encouraging.
    **Length:** Concise (~300 words).
    `;

    // Strategy Pattern usage:
    const engine = AIEngineFactory.create(provider, apiKey);
    const textResult = await engine.generateText(prompt);

    const finalResult = textResult || (language === 'zh' ? "暂时无法生成分析报告。" : "Unable to generate analysis report.");

    try {
      localStorage.setItem(ADVISOR_CACHE_KEY, JSON.stringify({
        hash: currentHash,
        timestamp: Date.now(),
        data: finalResult
      }));
    } catch (e) {
      console.warn("PanassetLite: Failed to save advisor cache", e);
    }

    return finalResult;
  })();

  pendingAdvisorPromise = { hash: currentHash, promise: apiCall };

  try {
    return await apiCall;
  } finally {
    pendingAdvisorPromise = null;
  }
};

export const getRiskAssessment = async (assets: Asset[], apiKey: string, provider: AIProvider, language: Language = 'en', forceRefresh: boolean = false) => {
  if (!apiKey) throw new Error("API Key is missing");
  if (assets.length === 0) return null;

  const currentHash = `${generatePortfolioHash(assets)}:${language}:${provider}`;
  const now = Date.now();

  if (!forceRefresh) {
    try {
      const cachedRaw = localStorage.getItem(RISK_CACHE_KEY);
      if (cachedRaw) {
        const { hash, timestamp, data } = JSON.parse(cachedRaw);
        if (hash === currentHash && (now - timestamp < RISK_CACHE_TTL)) {
          return data;
        }
      }
    } catch (e) {}
  }

  if (pendingRiskPromise && pendingRiskPromise.hash === currentHash && !forceRefresh) {
     return pendingRiskPromise.promise;
  }

  const apiCall = (async () => {
    const portfolioSummary = assets.map(a => ({
      type: a.type,
      val: (a.quantity * a.currentPrice).toFixed(0),
    }));

    const targetLanguage = language === 'zh' ? 'Chinese' : 'English';

    const prompt = `
      Analyze the risk profile of this portfolio: ${JSON.stringify(portfolioSummary)}.
      
      **PRIVACY RULE**: Do not mention specific monetary amounts in the 'analysis' text. Use percentages or general terms.

      Classify assets:
      - High Risk: Crypto
      - Medium Risk: Stocks, Funds
      - Low/Stable Risk: Cash, Real Estate
      - Liability: Debt (increases overall risk profile if high)
      
      Return JSON with a riskScore (1-10) and a brief analysis in ${targetLanguage}.
      
      The JSON keys must be: "riskScore", "riskLevel", "analysis".
    `;

    // Define Schema (Mainly for Gemini, but serves as documentation for DeepSeek too)
    const schema = {
      type: Type.OBJECT,
      properties: {
        riskScore: { type: Type.NUMBER, description: "1-10 Score (10 is Aggressive)" },
        riskLevel: { type: Type.STRING, description: "Conservative, Balanced, Aggressive" },
        analysis: { type: Type.STRING, description: `Max 60 words summary in ${targetLanguage}, no specific dollar/currency amounts.` }
      },
      required: ["riskScore", "riskLevel", "analysis"]
    };

    // Strategy Pattern usage:
    const engine = AIEngineFactory.create(provider, apiKey);
    const data = await engine.generateJSON(prompt, schema);

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

export const parseVoiceCommand = async (
    text: string, 
    mode: 'ASSET' | 'TRANSACTION',
    apiKey: string, 
    provider: AIProvider,
    existingContext: { symbol: string, name: string, id: string }[] = []
  ): Promise<VoiceParseResult> => {
    if (!apiKey) throw new Error("API Key is missing");

    // Inject Current Date so LLM can resolve "Today", "Yesterday"
    const today = new Date().toISOString().split('T')[0];

    const prompt = `
      Role: Financial Data Parser.
      Task: Parse user spoken input into structured JSON for an app called 'InvestFlow'.
      
      Time Context: 
      - Current Reference Date: ${today} (YYYY-MM-DD).
      - Use this date to correctly resolve relative time terms like "today", "yesterday", "last friday".

      User Input: "${text}"
      
      Context Mode: ${mode}
      Existing Assets: ${JSON.stringify(existingContext.map(a => `${a.symbol} (${a.name})`))}

      Instructions:
      1. Extract 'symbol', 'quantity', 'price', 'date' (YYYY-MM-DD), 'currency'.
      2. **INTELLIGENT MAPPING**:
         - **Symbols**: Use your broad financial knowledge to map spoken company names or asset classes to standard Ticker Symbols (e.g. "Nvidia" -> "NVDA", "Gold" -> "GOLD", "Maotai" -> "600519.SS"). 
         - **Manual Assets**: For Real Estate or unique items, generate a logical, concise uppercase ID (e.g. "APT_NY", "ROLEX_SUB").
         - **Currencies**: Map spoken currency names (e.g. "RMB", "Bucks", "Yuan") to standard ISO 4217 codes (CNY, USD, HKD, etc.).
      3. **TRANSACTION MODE**:
         - If mode is TRANSACTION, map the input to one of the Existing Assets if possible.
         - Determine 'txType' (BUY, SELL, DIVIDEND). Default to BUY if ambiguous.
      4. **ASSET MODE**:
         - Determine 'type' (STOCK, CRYPTO, FUND, CASH, REAL_ESTATE, LIABILITY, OTHER).
      
      Return STRICT JSON. No markdown formatting.
      Fields: symbol, name, type (enum: STOCK, CRYPTO, FUND, CASH, REAL_ESTATE, LIABILITY, OTHER), txType (enum: BUY, SELL, DIVIDEND), quantity (number), price (number), date (string YYYY-MM-DD), currency (string).
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        symbol: { type: Type.STRING },
        name: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "FUND", "CASH", "REAL_ESTATE", "LIABILITY", "OTHER"] },
        txType: { type: Type.STRING, enum: ["BUY", "SELL", "DIVIDEND"] },
        quantity: { type: Type.NUMBER },
        price: { type: Type.NUMBER },
        date: { type: Type.STRING },
        currency: { type: Type.STRING }
      }
    };

    const engine = AIEngineFactory.create(provider, apiKey);
    return await engine.generateJSON(prompt, schema);
};
