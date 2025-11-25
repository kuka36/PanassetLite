


import { Content, FunctionDeclaration, GoogleGenAI, Type, Part } from "@google/genai";
import { Asset, ChatMessage, Currency, PendingAction, TransactionType, AssetType, Language, Transaction, ActionType } from "../types";

// --- Tool Definitions ---

const GET_ASSETS_TOOL: FunctionDeclaration = {
  name: "get_assets",
  description: "Read current portfolio holdings/assets. Returns list of assets with ids, symbols, quantities, etc.",
};

const GET_TRANSACTIONS_TOOL: FunctionDeclaration = {
  name: "get_transactions",
  description: "Read transaction history. Supports filtering by symbol or type. Returns list of transactions with ids, dates, prices.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "Filter by asset symbol (e.g. AAPL)" },
      limit: { type: Type.NUMBER, description: "Limit number of results (default 10)" }
    }
  }
};

const PROPOSE_ASSET_MUTATION: FunctionDeclaration = {
  name: "propose_asset_mutation",
  description: "Propose to Add, Update, or Delete an Asset Metadata (Holding Info). For quantity changes, propose a TRANSACTION instead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mutationType: { type: Type.STRING, enum: ["ADD", "UPDATE", "DELETE"], description: "Type of change" },
      symbol: { type: Type.STRING, description: "Asset Symbol (Required for ADD)" },
      assetId: { type: Type.STRING, description: "Asset ID (Required for UPDATE/DELETE). Use get_assets to find ID." },
      initialQuantity: { type: Type.NUMBER, description: "Initial quantity (for ADD only)" },
      price: { type: Type.NUMBER, description: "Price or Cost" },
      assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND"], description: "Asset Type (for ADD)" },
      name: { type: Type.STRING, description: "Asset Name" }
    },
    required: ["mutationType"]
  }
};

const PROPOSE_TRANSACTION_MUTATION: FunctionDeclaration = {
  name: "propose_transaction_mutation",
  description: "Propose to Add (Record), Update, or Delete a Transaction. Use this for BUY, SELL, DEPOSIT, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mutationType: { type: Type.STRING, enum: ["ADD", "UPDATE", "DELETE"], description: "Type of change" },
      transactionId: { type: Type.STRING, description: "Transaction ID (Required for UPDATE/DELETE). Use get_transactions to find ID." },
      assetId: { type: Type.STRING, description: "Asset ID (Required for ADD). Use get_assets to find ID." },
      txType: { type: Type.STRING, enum: ["BUY", "SELL", "DIVIDEND", "DEPOSIT", "WITHDRAWAL", "BORROW", "REPAY"], description: "Transaction Type" },
      quantity: { type: Type.NUMBER, description: "Quantity" },
      price: { type: Type.NUMBER, description: "Price per unit" },
      date: { type: Type.STRING, description: "ISO 8601 Date Time string (YYYY-MM-DDTHH:mm:ss)" },
      fee: { type: Type.NUMBER, description: "Transaction fees" }
    },
    required: ["mutationType"]
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
    transactions: Transaction[], 
    baseCurrency: Currency,
    language: Language,
    image?: string
  ): Promise<{ text: string, action?: PendingAction }> {
    
    if (!this.ai) {
      return {
        text: language === 'zh' 
          ? "我需要 **Gemini API Key** 才能作为您的 AI 助手工作。\n\n请前往 **设置** 页面进行配置。"
          : "I need a **Gemini API Key** to function as your AI assistant. \n\nPlease go to **Settings** to configure it."
      };
    }

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toISOString();

      const langInstruction = language === 'zh' 
        ? "You MUST reply in Chinese (Simplified)." 
        : "You MUST reply in English.";

      const systemInstruction = `
        You are the intelligent assistant for "PanassetLite".
        Today is ${today}. Current Time is ${currentTime}. Base Currency: ${baseCurrency}.
        
        **Language Rule:**
        ${langInstruction}
        
        **Capabilities:**
        1. **READ**: You can inspect the user's Assets and Transaction History using \`get_assets\` and \`get_transactions\`.
           - ALWAYS check \`get_assets\` before proposing a transaction to get the correct \`assetId\`.
           - ALWAYS check \`get_transactions\` before updating/deleting a transaction to get the correct \`transactionId\`.
        2. **WRITE**: You can propose changes using \`propose_asset_mutation\` (for holdings) or \`propose_transaction_mutation\` (for trades).
        
        **Behavior:**
        - Be concise.
        - If the user says "I bought 10 AAPL", first check \`get_assets\` to see if AAPL exists. If yes, use its ID for \`propose_transaction_mutation\`. If no, you might need to Add Asset first.
        - Use full ISO date strings if time is relevant, otherwise YYYY-MM-DD is acceptable (app handles both).
      `;

      const geminiHistory: Content[] = history
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => {
          const parts: Part[] = [];
          if (m.image) {
            const base64Data = m.image.split(',')[1];
            const mimeType = m.image.split(';')[0].split(':')[1];
            parts.push({ inlineData: { mimeType, data: base64Data } });
          }
          if (m.content && m.content.trim().length > 0) {
            parts.push({ text: m.content });
          }
          return {
            role: m.role === 'user' ? 'user' : 'model',
            parts: parts
          };
        });

      const chat = this.ai.chats.create({
        model: this.modelName,
        history: geminiHistory,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [GET_ASSETS_TOOL, GET_TRANSACTIONS_TOOL, PROPOSE_ASSET_MUTATION, PROPOSE_TRANSACTION_MUTATION] }],
        }
      });

      const currentParts: Part[] = [];
      if (image) {
          const base64Data = image.split(',')[1];
          const mimeType = image.split(';')[0].split(':')[1];
          currentParts.push({ inlineData: { mimeType, data: base64Data } });
      }
      const safeUserMessage = userMessage.trim();
      if (safeUserMessage) {
          currentParts.push({ text: safeUserMessage });
      }
      if (currentParts.length === 0) currentParts.push({ text: "." });

      let response = await chat.sendMessage({ message: currentParts });
      
      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        
        // --- READ TOOLS ---
        if (call.name === 'get_assets') {
           const result = { assets: assets.map(a => ({ id: a.id, symbol: a.symbol, name: a.name, qty: a.quantity, price: a.currentPrice })) };
           response = await chat.sendMessage({ message: [{ functionResponse: { name: call.name, response: result } }] });
        }
        else if (call.name === 'get_transactions') {
           const args = call.args as any;
           let filtered = [...transactions];
           if (args.symbol) {
             const targetAsset = assets.find(a => a.symbol === args.symbol.toUpperCase());
             if (targetAsset) filtered = filtered.filter(t => t.assetId === targetAsset.id);
             else filtered = [];
           }
           filtered = filtered.sort((a,b) => b.date.localeCompare(a.date)).slice(0, args.limit || 10);
           
           const result = { 
               transactions: filtered.map(t => {
                   const a = assets.find(as => as.id === t.assetId);
                   return { id: t.id, date: t.date, type: t.type, symbol: a?.symbol, qty: t.quantityChange, price: t.pricePerUnit };
               }) 
           };
           response = await chat.sendMessage({ message: [{ functionResponse: { name: call.name, response: result } }] });
        }
        
        // --- MUTATION TOOLS ---
        const finalCalls = response.functionCalls;
        if (finalCalls && finalCalls.length > 0) {
            const finalCall = finalCalls[0];
            const args = finalCall.args as any;

            if (finalCall.name === 'propose_asset_mutation') {
                const typeMap: Record<string, ActionType> = {
                    'ADD': 'ADD_ASSET',
                    'UPDATE': 'UPDATE_ASSET',
                    'DELETE': 'DELETE_ASSET'
                };
                const actionType = typeMap[args.mutationType];
                const summary = `${args.mutationType} Asset: ${args.symbol || args.assetId}`;

                return {
                    text: language === 'zh' ? `建议操作: **${args.mutationType} 资产**。请确认。` : `Proposed Action: **${args.mutationType} Asset**. Please confirm.`,
                    action: {
                        type: actionType,
                        targetId: args.assetId,
                        data: {
                            symbol: args.symbol,
                            name: args.name,
                            quantity: args.initialQuantity, // Note mapped from initialQuantity
                            price: args.price,
                            type: args.assetType as AssetType
                        },
                        summary
                    }
                };
            }

            if (finalCall.name === 'propose_transaction_mutation') {
                const typeMap: Record<string, ActionType> = {
                    'ADD': 'ADD_TRANSACTION',
                    'UPDATE': 'UPDATE_TRANSACTION',
                    'DELETE': 'DELETE_TRANSACTION'
                };
                const actionType = typeMap[args.mutationType];
                
                let symbolStr = "Unknown";
                if (args.assetId) {
                    const a = assets.find(as => as.id === args.assetId);
                    if (a) symbolStr = a.symbol;
                }

                const summary = `${args.mutationType} Transaction: ${args.txType || ''} ${symbolStr}`;
                
                return {
                    text: language === 'zh' ? `建议操作: **${args.mutationType} 交易记录**。请确认。` : `Proposed Action: **${args.mutationType} Transaction**. Please confirm.`,
                    action: {
                        type: actionType,
                        targetId: args.transactionId,
                        data: {
                            assetId: args.assetId,
                            type: args.txType as TransactionType,
                            quantity: args.quantity,
                            price: args.price,
                            date: args.date,
                            fee: args.fee
                        },
                        summary
                    }
                };
            }
        }
      }

      return { text: response.text || "" };

    } catch (error: any) {
      console.error("Agent Error:", error);
      return {
        text: language === 'zh' 
          ? "抱歉，AI 暂时无法处理您的请求。" 
          : "Sorry, I encountered an issue processing your request."
      };
    }
  }
}