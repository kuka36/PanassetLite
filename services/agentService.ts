
import { Content, FunctionDeclaration, GoogleGenAI, Type, Part } from "@google/genai";
import { Asset, ChatMessage, Currency, PendingAction, TransactionType, AssetType, Language } from "../types";

// --- Tool Definitions ---

const GET_PORTFOLIO_TOOL: FunctionDeclaration = {
  name: "get_portfolio_summary",
  description: "Get a summary of the current portfolio holdings, including symbols, quantities, and current values.",
};

const STAGE_TRANSACTION_TOOL: FunctionDeclaration = {
  name: "stage_transaction",
  description: "Propose a transaction (Buy/Sell) or adding a new asset. Do not execute, just stage it for confirmation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ["BUY", "SELL", "ADD_NEW_ASSET"], description: "The type of action" },
      symbol: { type: Type.STRING, description: "Ticker symbol (e.g. AAPL, BTC)" },
      quantity: { type: Type.NUMBER, description: "Quantity" },
      price: { type: Type.NUMBER, description: "Price per unit" },
      assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY"], description: "Only for ADD_NEW_ASSET" }
    },
    required: ["action", "symbol", "quantity", "price"]
  }
};

// --- Service Logic ---

export class AgentService {
  private ai: GoogleGenAI | null = null;
  private modelName = 'gemini-2.5-flash';

  constructor(apiKey: string) {
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async processMessage(
    userMessage: string,
    history: ChatMessage[],
    assets: Asset[],
    baseCurrency: Currency,
    language: Language
  ): Promise<{ text: string, action?: PendingAction }> {
    
    // 1. Fallback: No API Key
    if (!this.ai) {
      return {
        text: language === 'zh' 
          ? "我需要 **Gemini API Key** 才能作为您的 AI 助手工作。\n\n请前往 **设置** 页面进行配置。在此期间，您可以使用屏幕上的按钮手动记录交易。"
          : "I need a **Gemini API Key** to function as your AI assistant. \n\nPlease go to **Settings** to configure it. In the meantime, you can manually record transactions using the buttons on the screen."
      };
    }

    try {
      // 2. Prepare Context
      const today = new Date().toISOString().split('T')[0];
      const assetSummary = assets.map(a => `${a.symbol} (${a.name}): ${a.quantity} units`).join(', ');
      
      const langInstruction = language === 'zh' 
        ? "You MUST reply in Chinese (Simplified)." 
        : "You MUST reply in English.";

      const systemInstruction = `
        You are the intelligent assistant for "PanassetLite".
        Today is ${today}. Base Currency: ${baseCurrency}.
        
        **Language Rule:**
        ${langInstruction}
        
        **Current Portfolio Context:**
        ${assetSummary || "Portfolio is empty."}

        **Role & Personality:**
        You are a highly capable, friendly, and knowledgeable AI assistant.
        While your primary special skill is managing the user's investment portfolio, **you are NOT limited to financial topics**.
        You should help the user with **ANY** request—whether it's writing code, explaining complex concepts, chatting about daily life, or analyzing their assets.
        Always be polite, concise, and helpful.

        **Portfolio Capabilities:**
        1. Answer questions about current holdings (use 'get_portfolio_summary' if needed, or rely on context).
        2. Help user record transactions. You CANNOT write to the database directly. You MUST use the 'stage_transaction' tool to propose an action.
        
        **Transaction Rules:**
        - If the user wants to buy/sell, infer the symbol, quantity, and price. If price is missing, estimate or ask.
      `;

      // 3. Map & Sanitize History
      // CRITICAL FIX: Filter out messages with empty content to prevent "ContentUnion is required" error
      const geminiHistory: Content[] = history
        .filter(m => m.role !== 'system' && m.content && m.content.trim().length > 0)
        .slice(-10)
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

      // 4. Create Chat Session
      const chat = this.ai.chats.create({
        model: this.modelName,
        history: geminiHistory,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [GET_PORTFOLIO_TOOL, STAGE_TRANSACTION_TOOL] }],
        }
      });

      // 5. Send Message (Guard against empty input just in case)
      const safeUserMessage = userMessage.trim() || ".";
      const response = await chat.sendMessage({ message: safeUserMessage });
      
      // 6. Handle Function Calls
      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        
        if (call.name === 'get_portfolio_summary') {
           const functionResponseParts: Part[] = [{
             functionResponse: {
                name: call.name,
                response: { assets: assets.map(a => ({ s: a.symbol, q: a.quantity, v: a.currentPrice })) }
             }
           }];
           const finalResponse = await chat.sendMessage({ message: functionResponseParts });
           return { text: finalResponse.text || (language === 'zh' ? "这是您的资产概览。" : "Here is your portfolio summary.") };
        }

        if (call.name === 'stage_transaction') {
          const args = call.args as any;
          const action: PendingAction = {
            type: args.action === 'ADD_NEW_ASSET' ? 'ADD_ASSET' : 'ADD_TRANSACTION',
            data: {
              symbol: args.symbol,
              quantity: args.quantity,
              price: args.price,
              type: args.action === 'ADD_NEW_ASSET' 
                  ? (args.assetType as AssetType || AssetType.STOCK) 
                  : (args.action === 'BUY' ? TransactionType.BUY : TransactionType.SELL)
            },
            summary: `${args.action === 'BUY' ? (language==='zh'?'买入':'Buy') : (args.action === 'SELL' ? (language==='zh'?'卖出':'Sell') : (language==='zh'?'添加':'Add'))} ${args.quantity} ${args.symbol} @ ${args.price}`
          };
          
          const confirmText = language === 'zh' 
            ? `我已经为您准备了一份草稿: **${action.summary}**。请在下方确认。` 
            : `I've prepared a draft for you: **${action.summary}**. Please confirm below.`;

          return {
            text: confirmText,
            action
          };
        }
      }

      // Normal text response (Safe fallback if text is missing)
      return { text: response.text || "" };

    } catch (error: any) {
      console.error("Agent Error:", error);
      return {
        text: language === 'zh' 
          ? "抱歉，连接 AI 大脑时出现问题。请检查网络或 API Key。" 
          : "Sorry, I encountered an issue connecting to the AI brain. Please check your network or API Key."
      };
    }
  }
}
