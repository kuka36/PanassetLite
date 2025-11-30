import { Content, FunctionDeclaration, GoogleGenAI, Type, Part } from "@google/genai";
import { Asset, ChatMessage, Currency, PendingAction, TransactionType, AssetType, Language, Transaction, ActionType } from "../types";

// --- Tool Definitions ---

const GET_PORTFOLIO_STATE_TOOL: FunctionDeclaration = {
  name: "get_portfolio_state",
  description: "Get the current state of the portfolio. Returns total value, summary stats, and a list of all assets with their current holdings/prices.",
};

const GET_ASSET_DETAILS_TOOL: FunctionDeclaration = {
  name: "get_asset_details",
  description: "Get detailed information about a specific asset. Returns metadata, current computed state, and recent transaction history.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbolOrId: { type: Type.STRING, description: "The symbol (e.g., AAPL) or ID of the asset." }
    },
    required: ["symbolOrId"]
  }
};

const SEARCH_TRANSACTIONS_TOOL: FunctionDeclaration = {
  name: "search_transactions",
  description: "Search transaction history. Filter by date range, type, or symbol.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "Filter by asset symbol" },
      startDate: { type: Type.STRING, description: "Start date (ISO 8601)" },
      endDate: { type: Type.STRING, description: "End date (ISO 8601)" },
      limit: { type: Type.NUMBER, description: "Max results (default 20)" }
    }
  }
};

const PROPOSE_ADD_ASSET: FunctionDeclaration = {
  name: "propose_add_asset",
  description: "Propose adding a NEW asset to the portfolio. If the asset already exists, use propose_transaction instead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "Asset Symbol (e.g. AAPL, BTC)" },
      name: { type: Type.STRING, description: "Asset Name" },
      assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND", "OTHER"], description: "Asset Type" },
      currency: { type: Type.STRING, enum: ["USD", "CNY", "HKD"], description: "Currency" },
      initialQuantity: { type: Type.NUMBER, description: "Initial quantity held (will create an initial transaction)." },
      price: { type: Type.NUMBER, description: "Current Price or Cost Basis" },
      dateAcquired: { type: Type.STRING, description: "Date acquired (ISO 8601)" }
    },
    required: ["symbol", "assetType"]
  }
};

const PROPOSE_UPDATE_METADATA: FunctionDeclaration = {
  name: "propose_update_metadata",
  description: "Propose updating the METADATA (name, type, currency, price) of an existing asset. CANNOT change quantity (use transaction for that).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assetId: { type: Type.STRING, description: "Asset ID" },
      name: { type: Type.STRING, description: "New Name" },
      symbol: { type: Type.STRING, description: "New Symbol" },
      assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND", "OTHER"], description: "New Type" },
      currency: { type: Type.STRING, enum: ["USD", "CNY", "HKD"], description: "New Currency" },
      currentPrice: { type: Type.NUMBER, description: "Update current market price (does not affect quantity)" }
    },
    required: ["assetId"]
  }
};

const PROPOSE_BULK_ASSET_UPDATE: FunctionDeclaration = {
  name: "propose_bulk_asset_update",
  description: "Propose MULTIPLE asset additions or updates at once. Use this for analyzing IMAGES or for BATCH UPDATES.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assets: {
        type: Type.ARRAY,
        description: "List of assets identified.",
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING, description: "Ticker Symbol" },
            name: { type: Type.STRING, description: "Asset Name" },
            quantity: { type: Type.NUMBER, description: "Quantity held" },
            price: { type: Type.NUMBER, description: "Price/Cost" },
            currency: { type: Type.STRING, enum: ["USD", "CNY", "HKD"] },
            assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND", "OTHER"] },
            dateAcquired: { type: Type.STRING }
          },
          required: ["symbol", "quantity"]
        }
      }
    },
    required: ["assets"]
  }
};

const PROPOSE_TRANSACTION: FunctionDeclaration = {
  name: "propose_transaction",
  description: "Propose to Add, Update, or Delete a Transaction. This is the ONLY way to change the quantity of an existing asset.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mutationType: { type: Type.STRING, enum: ["ADD", "UPDATE", "DELETE"], description: "Type of change" },
      transactionId: { type: Type.STRING, description: "Transaction ID (Required for UPDATE/DELETE)" },
      assetId: { type: Type.STRING, description: "Asset ID (Required for ADD)" },
      txType: { type: Type.STRING, enum: ["BUY", "SELL", "DIVIDEND", "DEPOSIT", "WITHDRAWAL", "BORROW", "REPAY", "BALANCE_ADJUSTMENT"], description: "Transaction Type" },
      quantity: { type: Type.NUMBER, description: "Quantity involved" },
      price: { type: Type.NUMBER, description: "Price per unit" },
      date: { type: Type.STRING, description: "ISO 8601 Date Time" },
      fee: { type: Type.NUMBER, description: "Fees" },
      note: { type: Type.STRING, description: "Optional note" }
    },
    required: ["mutationType"]
  }
};

const PROPOSE_BATCH_DELETE: FunctionDeclaration = {
  name: "propose_batch_delete",
  description: "Propose to DELETE multiple assets at once.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assetIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      reason: { type: Type.STRING }
    },
    required: ["assetIds"]
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
        1. **READ**: Use \`get_portfolio_state\` to see all assets. Use \`get_asset_details\` to investigate specific assets and their history.
        2. **WRITE**: 
           - **NEW Assets**: Use \`propose_add_asset\`.
           - **EXISTING Assets**: 
             - To change Quantity/Cost -> Use \`propose_transaction\`.
             - To change Name/Type/Price -> Use \`propose_update_metadata\`.
        3. **BULK IMPORT**: If the user provides an IMAGE, use \`propose_bulk_asset_update\`.
        
        **Universal Asset Logic:**
        1.  **Scope**: **ANYTHING can be an asset.**
        2.  **Symbol/ID**: Financial = Ticker; Physical = Concise ID.
        3.  **Asset Type**: Infer best match.
        4.  **Quantity Rules**:
            -   **Default**: 1 if unspecified.
            -   **Funds**: If only Total Value known, Qty = Total Value, Price = 1.
        5.  **Price/Value**: Estimate if unknown.
        6.  **Currency**: Infer from context.

        **Tool Usage Rules:**
        -   **Single Source of Truth**: The ONLY way to change an asset's quantity is via a TRANSACTION.
        -   **Adding**: \`propose_add_asset\` creates the asset AND an initial transaction.
        -   **Updating**: 
            -   If user says "I bought 5 more", use \`propose_transaction(ADD, type=BUY...)\`.
            -   If user says "Update price to 100", use \`propose_update_metadata\`.
            -   If user says "I actually have 10, not 5" (correction), use \`propose_transaction(ADD, type=BALANCE_ADJUSTMENT...)\`.

        **TOOL CALLING RULES:**
        - **DO NOT** use \`print()\`, \`console.log()\`.
        - **DO NOT** wrap the function call in a code block (e.g. \`\`\`python ... \`\`\`).
        - Ensure arguments match the JSON schema exactly.
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
          tools: [{ functionDeclarations: [GET_PORTFOLIO_STATE_TOOL, GET_ASSET_DETAILS_TOOL, SEARCH_TRANSACTIONS_TOOL, PROPOSE_ADD_ASSET, PROPOSE_UPDATE_METADATA, PROPOSE_BULK_ASSET_UPDATE, PROPOSE_TRANSACTION, PROPOSE_BATCH_DELETE] }],
        }
      });

      const currentParts: Part[] = [];
      if (image) {
        const base64Data = image.split(',')[1];
        const mimeType = image.split(';')[0].split(':')[1];
        currentParts.push({ inlineData: { mimeType, data: base64Data } });
        currentParts.push({ text: "Please analyze this image and list all asset holdings found. Use the bulk update tool." });
      }
      const safeUserMessage = userMessage.trim();
      if (safeUserMessage) {
        currentParts.push({ text: safeUserMessage });
      } else if (currentParts.length === 0) {
        currentParts.push({ text: "." });
      }

      let response = await chat.sendMessage({ message: currentParts });

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];

        // --- READ TOOLS ---
        // --- READ TOOLS ---
        if (call.name === 'get_portfolio_state') {
          const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
          const totalCost = assets.reduce((sum, a) => sum + a.totalCost, 0);
          const result = {
            summary: {
              totalValue,
              totalCost,
              totalPnL: totalValue - totalCost,
              assetCount: assets.length
            },
            assets: assets.map(a => ({
              id: a.id,
              symbol: a.symbol,
              name: a.name,
              type: a.type,
              qty: a.quantity,
              price: a.currentPrice,
              value: a.currentValue,
              currency: a.currency
            }))
          };
          response = await chat.sendMessage({ message: [{ functionResponse: { name: call.name, response: result } }] });
        }
        else if (call.name === 'get_asset_details') {
          const args = call.args as any;
          const query = (args.symbolOrId || "").toUpperCase();
          const asset = assets.find(a => a.id === query || a.symbol === query);

          if (!asset) {
            response = await chat.sendMessage({ message: [{ functionResponse: { name: call.name, response: { error: "Asset not found" } } }] });
          } else {
            const assetTxs = transactions
              .filter(t => t.assetId === asset.id)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 20); // Last 20 transactions
            const result = {
              metadata: {
                id: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                type: asset.type,
                currency: asset.currency,
                currentPrice: asset.currentPrice
              },
              computed: {
                quantity: asset.quantity,
                avgCost: asset.avgCost,
                totalCost: asset.totalCost,
                currentValue: asset.currentValue,
                pnl: asset.pnl,
                pnlPercent: asset.pnlPercent
              },
              recentTransactions: assetTxs.map(t => ({
                id: t.id,
                date: t.date,
                type: t.type,
                qtyChange: t.quantityChange,
                price: t.pricePerUnit,
                total: t.total,
                note: t.note
              }))
            };
            response = await chat.sendMessage({ message: [{ functionResponse: { name: call.name, response: result } }] });
          }
        }
        else if (call.name === 'search_transactions') {
          const args = call.args as any;
          let filtered = [...transactions];

          if (args.symbol) {
            const targetAsset = assets.find(a => a.symbol === args.symbol.toUpperCase());
            if (targetAsset) filtered = filtered.filter(t => t.assetId === targetAsset.id);
            else filtered = [];
          }

          if (args.startDate) {
            filtered = filtered.filter(t => t.date >= args.startDate);
          }
          if (args.endDate) {
            filtered = filtered.filter(t => t.date <= args.endDate);
          }

          filtered = filtered.sort((a, b) => b.date.localeCompare(a.date)).slice(0, args.limit || 20);

          const result = {
            transactions: filtered.map(t => {
              const a = assets.find(as => as.id === t.assetId);
              return {
                id: t.id,
                date: t.date,
                type: t.type,
                symbol: a?.symbol,
                qty: t.quantityChange,
                price: t.pricePerUnit,
                total: t.total
              };
            })
          };
          response = await chat.sendMessage({ message: [{ functionResponse: { name: call.name, response: result } }] });
        }

        // --- MUTATION TOOLS ---
        const finalCalls = response.functionCalls;
        if (finalCalls && finalCalls.length > 0) {
          const finalCall = finalCalls[0];
          const args = finalCall.args as any;

          if (finalCall.name === 'propose_add_asset') {
            const summary = `Add New Asset: ${args.symbol}`;
            return {
              text: "",
              action: {
                type: 'ADD_ASSET',
                data: {
                  symbol: args.symbol,
                  name: args.name,
                  quantity: args.initialQuantity,
                  price: args.price,
                  type: args.assetType as AssetType,
                  currency: args.currency,
                  date: args.dateAcquired
                },
                summary
              }
            };
          }

          if (finalCall.name === 'propose_update_metadata') {
            let displaySymbol = args.assetId;
            const existing = assets.find(a => a.id === args.assetId);
            if (existing) displaySymbol = existing.symbol;

            const summary = `Update Metadata: ${displaySymbol}`;
            return {
              text: "",
              action: {
                type: 'UPDATE_ASSET', // Reusing existing type, but data will be limited
                targetId: args.assetId,
                data: {
                  symbol: args.symbol,
                  name: args.name,
                  type: args.assetType as AssetType,
                  currency: args.currency,
                  price: args.currentPrice
                  // NO quantity here
                },
                summary
              }
            };
          }

          if (finalCall.name === 'propose_bulk_asset_update') {
            const count = args.assets?.length || 0;
            const summary = language === 'zh'
              ? `从图片识别到 ${count} 个资产持仓`
              : `Identified ${count} assets from image`;

            return {
              text: language === 'zh' ? "我从图片中识别到了以下资产，请确认是否导入：" : "I found the following assets in the image. Please confirm to import:",
              action: {
                type: 'BULK_ASSET_UPDATE',
                data: {}, // Dummy data for interface
                items: args.assets, // Array of items
                summary
              }
            };
          }

          if (finalCall.name === 'propose_transaction') {
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
              text: "",
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
          if (finalCall.name === 'propose_batch_delete') {
            const count = args.assetIds?.length || 0;
            const summary = language === 'zh'
              ? `批量删除 ${count} 个资产: ${args.reason || ''}`
              : `Batch delete ${count} assets: ${args.reason || ''}`;

            return {
              text: language === 'zh' ? `我建议删除以下 ${count} 个资产。请确认：` : `I propose deleting the following ${count} assets. Please confirm:`,
              action: {
                type: 'BATCH_DELETE_ASSET',
                data: {},
                items: args.assetIds.map((id: string) => ({ id })), // Store IDs in items
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