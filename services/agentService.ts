
import { Content, FunctionDeclaration, GoogleGenAI, Type } from "@google/genai";
import { Asset, ChatMessage, Currency, PendingAction, TransactionType, AssetType } from "../types";

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
    baseCurrency: Currency
  ): Promise<{ text: string, action?: PendingAction }> {
    
    // 1. Fallback: No API Key (Graceful Degradation)
    if (!this.ai) {
      return {
        text: "I need a **Gemini API Key** to function as your AI assistant. \n\nPlease go to **Settings** to configure it. In the meantime, you can manually record transactions using the buttons on the screen."
      };
    }

    try {
      // 2. Prepare Context (System Instruction)
      const today = new Date().toISOString().split('T')[0];
      const assetSummary = assets.map(a => `${a.symbol} (${a.name}): ${a.quantity} units`).join(', ');
      
      const systemInstruction = `
        You are the intelligent assistant for "PanassetLite".
        Today is ${today}. Base Currency: ${baseCurrency}.
        
        **Current Portfolio Context:**
        ${assetSummary || "Portfolio is empty."}

        **Capabilities:**
        1. Answer questions about the user's current holdings (use 'get_portfolio_summary' if needed, or rely on context).
        2. Help user record transactions. You CANNOT write to the database directly. You MUST use the 'stage_transaction' tool to propose an action.
        
        **Rules:**
        - Be concise and friendly.
        - If the user wants to buy/sell, infer the symbol, quantity, and price. If price is missing, estimate or ask.
        - If the user asks about market news, you can answer generally but emphasize you are a tracker.
        - Support Chinese and English based on user input language.
      `;

      // 3. Map Internal History to Gemini History
      // We take the last 10 messages to save context window
      const geminiHistory: Content[] = history
        .filter(m => m.role !== 'system')
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

      // 5. Send Message
      const response = await chat.sendMessage(userMessage);
      
      // 6. Handle Function Calls
      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        
        if (call.name === 'get_portfolio_summary') {
          // The model wants to read data. We give it the data and let it generate the text answer.
           const functionResponseParts = [{
             functionResponse: {
                name: call.name,
                response: { assets: assets.map(a => ({ s: a.symbol, q: a.quantity, v: a.currentPrice })) }
             }
           }];
           const finalResponse = await chat.sendMessage(functionResponseParts);
           return { text: finalResponse.text };
        }

        if (call.name === 'stage_transaction') {
          const args = call.args as any;
          // Construct the Pending Action for the UI
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
            summary: `${args.action === 'BUY' ? 'Buy' : (args.action === 'SELL' ? 'Sell' : 'Add')} ${args.quantity} ${args.symbol} @ ${args.price}`
          };
          
          return {
            text: `I've prepared a draft for you: **${action.summary}**. Please confirm below.`,
            action
          };
        }
      }

      // Normal text response
      return { text: response.text };

    } catch (error: any) {
      console.error("Agent Error:", error);
      return {
        text: "Sorry, I encountered an issue connecting to the AI brain. Please check your network or API Key."
      };
    }
  }
}
