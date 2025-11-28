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
  description: "Propose to Add, Update, or Delete a single Asset Metadata. Use this for precise single edits.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mutationType: { type: Type.STRING, enum: ["ADD", "UPDATE", "DELETE"], description: "Type of change" },
      symbol: { type: Type.STRING, description: "Asset Symbol (Required for ADD)" },
      assetId: { type: Type.STRING, description: "Asset ID (Required for UPDATE/DELETE). Use get_assets to find ID." },
      initialQuantity: { type: Type.NUMBER, description: "Initial quantity to hold immediately (for ADD only)." },
      price: { type: Type.NUMBER, description: "Price or Cost" },
      assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND", "OTHER"], description: "Asset Type (for ADD)" },
      name: { type: Type.STRING, description: "Asset Name" },
      currency: { type: Type.STRING, enum: ["USD", "CNY", "HKD"], description: "Currency of the asset." },
      dateAcquired: { type: Type.STRING, description: "Date acquired (ISO 8601 YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss). Use if user specifies a past date." }
    },
    required: ["mutationType"]
  }
};

const PROPOSE_BULK_ASSET_UPDATE: FunctionDeclaration = {
  name: "propose_bulk_asset_update",
  description: "Propose MULTIPLE asset additions or updates at once. Use this for analyzing IMAGES or for BATCH UPDATES (e.g. 'set all stocks to quantity 10').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assets: {
        type: Type.ARRAY,
        description: "List of assets identified from the image.",
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING, description: "Ticker Symbol (e.g. AAPL, 00700)" },
            name: { type: Type.STRING, description: "Asset Name" },
            quantity: { type: Type.NUMBER, description: "Quantity held" },
            price: { type: Type.NUMBER, description: "Current Price or Cost Basis" },
            currency: { type: Type.STRING, enum: ["USD", "CNY", "HKD"], description: "Inferred currency" },
            assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND", "OTHER"], description: "Asset Type" },
            dateAcquired: { type: Type.STRING, description: "Date acquired if visible/known" }
          },
          required: ["symbol", "quantity"]
        }
      }
    },
    required: ["assets"]
  }
};

const PROPOSE_TRANSACTION_MUTATION: FunctionDeclaration = {
  name: "propose_transaction_mutation",
  description: "Propose to Add (Record), Update, or Delete a Transaction. Use this for adding trades to EXISTING assets.",
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

const PROPOSE_BATCH_DELETE: FunctionDeclaration = {
  name: "propose_batch_delete",
  description: "Propose to DELETE multiple assets at once based on criteria (e.g. 'delete all crypto', 'delete everything except Tesla').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assetIds: {
        type: Type.ARRAY,
        description: "List of Asset IDs to delete. Use get_assets to find IDs matching the user's criteria.",
        items: { type: Type.STRING }
      },
      reason: { type: Type.STRING, description: "Reason for deletion (for summary)" }
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
        1. **READ**: You can inspect the user's Assets and Transaction History using \`get_assets\` and \`get_transactions\`.
        2. **WRITE**: You can propose changes using \`propose_asset_mutation\` (single) or \`propose_transaction_mutation\` (trades).
        3. **BULK IMPORT**: If the user provides an IMAGE/SCREENSHOT, use \`propose_bulk_asset_update\` to extract items.
        
        **Universal Asset Logic:**
        1.  **Scope**: **ANYTHING can be an asset.** You are NOT limited to financial documents.
            -   **Physical Items**: Cars, watches, electronics, bags, wine, etc.
            -   **Virtual Items**: Game skins, domain names, etc.
            -   **Financial**: Stocks, crypto, cash, funds.

        2.  **Symbol/ID Generation**:
            -   **Financial**: Use the Ticker (e.g., AAPL, BTC).
            -   **Physical/Other**: Generate a concise, logical ID (e.g., "ROLEX_SUB_DATE", "MACBOOK_PRO_M3", "VINTAGE_WINE_1990").

        3.  **Asset Type Inference**:
            -   Stocks/Crypto/Funds/Cash -> Use respective types.
            -   Real Estate -> REAL_ESTATE.
            -   Everything else (Cars, Watches, Electronics, Art) -> **OTHER**.

        4.  **Quantity Rules**:
            -   **Default**: If the user mentions buying/adding an item without specifying a quantity (e.g., "I bought a laptop", "Add a roller skate"), you MUST set quantity to 1.
            -   **Count**: For images, count the items.
            -   **Funds**: If you see a Total Value (Holding Amount) but cannot find the Number of Units (Quantity), set Quantity = Total Value and Price = 1.

        5.  **Price/Value**:
            -   If a price is visible/stated, use it.
            -   If NO price is stated, **ESTIMATE** the current market value based on your knowledge.

        6.  **Currency Inference**:
            -   Infer based on symbol, name, or context (e.g. RMB for Chinese items, USD for global tech).

        **Tool Usage Rules:**
        -   **Single Item (Text)**: Use \`propose_asset_mutation\` (ADD/UPDATE).
        -   **Multiple Items (Image/Text)**: Use \`propose_bulk_asset_update\`.
        -   **Transactions**: If the asset ALREADY exists (check \`get_assets\`), use \`propose_transaction_mutation\` instead of adding it again.


        **TOOL CALLING RULES:**
        - **DO NOT** use \`print()\`, \`console.log()\`, or any other output wrapper.
        - **DO NOT** wrap the function call in a code block (e.g. \`\`\`python ... \`\`\`).
        - **DO NOT** use \`default_api.\` or any other object prefix. Just call the function name directly.
        - **CORRECT**: \`propose_bulk_asset_update(assets = [...])\`
        - **INCORRECT**: \`print(propose_bulk_asset_update(...))\`
        - **INCORRECT**: \`default_api.propose_bulk_asset_update(...)\`
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
          tools: [{ functionDeclarations: [GET_ASSETS_TOOL, GET_TRANSACTIONS_TOOL, PROPOSE_ASSET_MUTATION, PROPOSE_BULK_ASSET_UPDATE, PROPOSE_TRANSACTION_MUTATION, PROPOSE_BATCH_DELETE] }],
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
          filtered = filtered.sort((a, b) => b.date.localeCompare(a.date)).slice(0, args.limit || 10);

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

            let displaySymbol = args.symbol;
            if (!displaySymbol && args.assetId) {
              const existing = assets.find(a => a.id === args.assetId);
              if (existing) displaySymbol = existing.symbol;
            }
            const summary = `${args.mutationType} Asset: ${displaySymbol || args.assetId || 'Unknown'}`;

            return {
              text: "",
              action: {
                type: actionType,
                targetId: args.assetId,
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