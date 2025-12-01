
import { Type } from "@google/genai";
import { Asset, AssetType, VoiceParseResult } from "../types/domain";
import { Language, AIProvider } from "../types/store";
import { AIEngineFactory } from "./aiEngine";
import { StorageService } from "./StorageService";
import { isManualValuation as checkIsManual } from "../utils/assetUtils";

export const RISK_CACHE_KEY = 'panasset_risk_cache';
export const RISK_CACHE_TTL = 3600 * 1000; // 1 hour

export const ADVISOR_CACHE_KEY = 'panasset_advisor_cache';
export const ADVISOR_CACHE_TTL = 24 * 3600 * 1000; // 24 hours

// In-memory promise cache to prevent simultaneous duplicate calls
let pendingRiskPromise: { hash: string, promise: Promise<any> } | null = null;
let pendingAdvisorPromise: { hash: string, promise: Promise<string> } | null = null;

export const generatePortfolioHash = (assets: Asset[]) => {
  return assets
    .map(a => {
      const pricePart = checkIsManual(a.type) ? `:${a.currentPrice}` : '';
      return `${a.symbol}:${a.quantity}:${a.type}${pricePart}`;
    })
    .sort()
    .join('|');
};

interface AICacheData<T> {
  hash: string;
  data: T;
}

export const getPortfolioAnalysis = async (assets: Asset[], apiKey: string, provider: AIProvider, language: Language = 'en', forceRefresh: boolean = false) => {
  if (!apiKey) throw new Error("API Key is missing");
  if (assets.length === 0) return "";

  const currentHash = `${generatePortfolioHash(assets)}:${language}:${provider}`;
  const now = Date.now();

  // 1. Check StorageService Cache
  if (!forceRefresh) {
    const cached = StorageService.getCache<AICacheData<string>>(ADVISOR_CACHE_KEY);
    if (cached) {
      const { timestamp, data: { hash, data } } = cached;
      if (hash === currentHash && (now - timestamp < ADVISOR_CACHE_TTL)) {
        return data;
      }
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
    你现在是“盘资产·轻”(PanassetLite) 私人财富管理平台的首席投资官 (CIO)。

    **用户投资组合概览 (仅供分析使用):**
    ${JSON.stringify(portfolioSummary)}

    **财务背景知识:**
    - **净资产** = 总资产 - 总负债。
    - **流动资产**: 股票、加密货币、现金、基金。
    - **非流动资产**: 房地产 (波动性低，难以变现)。
    - **负债**: 贷款、抵押贷款 (对净资产有负面影响)。

    **严格的隐私和输出规则:**
    1. **禁止出现绝对数值:** 你正在为一个注重隐私的仪表盘生成报告。**严禁**在最终报告中输出任何具体的货币金额 (例如：不要写 “$10,000”、“72,361 RMB” 或 “1.5 BTC”)。
    2. **使用比例和百分比:** 使用百分比 (%)、比例和定性描述 (如 “健康的缓冲”、“占比较大部分”、“少量配置”) 来代替具体数字。
    3. **语言:** 输出必须使用 **${targetLanguage}**。

    **任务:**
    生成一份战略性的财富分析报告。使用 Markdown 格式。

    **结构:**
    1.  **财富健康状况检查**:
        - 仅使用百分比分析 **净资产** 结构 (资产与负债的比例)。
        - 评估 **资产负债率** (负债 > 30% 为警戒线)。
        - 评估 **流动性**。是否存在过度杠杆或流动性不足的问题？

    2.  **风险与配置**:
        - 根据投资组合权重，评估高波动性资产 (加密货币) 与稳健资产 (房地产/现金) 的风险敞口。
        - 对集中度风险进行评论 (例如：“在单一资产上配置过重”)。

    3.  **战略建议**:
        - 根据资产组合，提供 3 个具体且可操作的步骤来优化投资组合。

    **语气:** 专业、深刻、客观且具有鼓舞性。
    **字数:** 简洁 (约 300 字)。
    `;

    // Strategy Pattern usage:
    const engine = AIEngineFactory.create(provider, apiKey);
    const textResult = await engine.generateText(prompt);

    const finalResult = textResult || (language === 'zh' ? "暂时无法生成分析报告。" : "Unable to generate analysis report.");

    StorageService.saveCache<AICacheData<string>>(ADVISOR_CACHE_KEY, {
      hash: currentHash,
      data: finalResult
    });

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
    const cached = StorageService.getCache<AICacheData<any>>(RISK_CACHE_KEY);
    if (cached) {
      const { timestamp, data: { hash, data } } = cached;
      if (hash === currentHash && (now - timestamp < RISK_CACHE_TTL)) {
        return data;
      }
    }
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
      分析此投资组合的风险概况: ${JSON.stringify(portfolioSummary)}。
      
      **隐私规则**: 不要在“分析”文本中提到具体的金额。使用百分比或通用术语。

      按风险等级对资产进行分类：
      - 高风险：山寨币和波动较大的加密货币（不包括稳定币和 BTC/ETH）
      - 中风险：股票、基金、主流加密货币（BTC, ETH）
      - 低/稳健风险：现金、房地产、稳定币（USDT, USDC, DAI, BUSD 等）
      - 负债：债务（如果占比高，会增加整体风险概况）
      
      返回 JSON 格式，包含 riskScore (1-10) 和一段使用 ${targetLanguage} 编写的简短分析。
      
      JSON 的键必须是: "riskScore", "riskLevel", "analysis"。
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

    StorageService.saveCache<AICacheData<any>>(RISK_CACHE_KEY, {
      hash: currentHash,
      data: data
    });

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
  const now = new Date();
  const fullTime = now.toISOString();

  const prompt = `
      角色: 金融数据解析器。
      任务: 将用户的语音输入解析为名为 'PanassetLite' 的应用程序的结构化 JSON。
      
      时间背景: 
      - 当前参考日期/时间: ${fullTime}。
      - 使用此日期正确解析相对时间术语，如“今天”、“昨天”、“上周五”、“5 分钟前”。

      用户输入: "${text}"
      
      上下文模式: ${mode}
      现有资产: ${JSON.stringify(existingContext.map(a => `${a.symbol} (${a.name})`))}

      说明:
      1. 提取 'symbol' (代码), 'quantity' (数量), 'price' (价格), 'date' (日期，首选 YYYY-MM-DDTHH:mm:ss，否则为 YYYY-MM-DD), 'currency' (货币)。
      2. **智能映射**:
         - **代码 (Symbols)**: 利用你广泛的金融知识将口头表达的公司名称或资产类别映射到标准股票代码 (例如 "英伟达" -> "NVDA", "黄金" -> "GOLD", "茅台" -> "600519.SS")。
         - **手动资产**: 对于房地产或独特物品，生成一个逻辑清晰、简洁的大写 ID (例如 "APT_NY", "ROLEX_SUB")。
         - **货币**: 将口语化的货币名称 (如 "人民币", "美金", "元") 映射到标准 ISO 4217 代码 (CNY, USD, HKD 等)。
      3. **交易模式 (TRANSACTION MODE)**:
         - 如果模式是 TRANSACTION，尽可能将输入映射到现有资产之一。
         - 确定 'txType' (交易类型: BUY, SELL, DIVIDEND)。如果含糊不清，默认为 BUY。
      4. **资产模式 (ASSET MODE)**:
         - 确定 'type' (类型: STOCK, CRYPTO, FUND, CASH, REAL_ESTATE, LIABILITY, OTHER)。
      
      返回严格的 JSON。不要使用 Markdown 格式。
      字段: symbol, name, type (枚举: STOCK, CRYPTO, FUND, CASH, REAL_ESTATE, LIABILITY, OTHER), txType (枚举: BUY, SELL, DIVIDEND), quantity (数字), price (数字), date (字符串), currency (字符串)。
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