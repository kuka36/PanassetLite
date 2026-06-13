import { FunctionDeclaration, Type } from "@google/genai";

export const GET_PORTFOLIO_STATE_TOOL: FunctionDeclaration = {
  name: "get_portfolio_state",
  description: "获取投资组合的当前状态。返回总资产价值、摘要统计信息以及所有资产及其当前持有量和价格的列表。",
};

export const GET_ASSET_DETAILS_TOOL: FunctionDeclaration = {
  name: "get_asset_details",
  description: "获取特定资产的详细信息。返回元数据、当前计算状态和最近的交易历史。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbolOrId: { type: Type.STRING, description: "资产的代码（例如 AAPL）或 ID。" }
    },
    required: ["symbolOrId"]
  }
};

export const SEARCH_TRANSACTIONS_TOOL: FunctionDeclaration = {
  name: "search_transactions",
  description: "搜索交易历史。按日期范围、类型或代码进行过滤。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "按资产代码过滤" },
      startDate: { type: Type.STRING, description: "开始日期 (ISO 8601)" },
      endDate: { type: Type.STRING, description: "结束日期 (ISO 8601)" },
      limit: { type: Type.NUMBER, description: "最大结果数（默认 20）" }
    }
  }
};

export const PROPOSE_ADD_ASSET: FunctionDeclaration = {
  name: "propose_add_asset",
  description: "提议向投资组合中添加新资产。如果资产已存在，请改用 propose_transaction。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: "资产代码（例如 AAPL, BTC）" },
      name: { type: Type.STRING, description: "资产名称" },
      assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND", "OTHER"], description: "资产类型" },
      currency: { type: Type.STRING, enum: ["USD", "CNY", "HKD"], description: "货币" },
      initialQuantity: { type: Type.NUMBER, description: "初始持有数量（将创建一个初始交易）。" },
      price: { type: Type.NUMBER, description: "当前市场价格" },
      cost: { type: Type.NUMBER, description: "初始买入成本价（用于创建初始交易）。如果未提供，默认使用 price。" },
      dateAcquired: { type: Type.STRING, description: "取得日期 (ISO 8601)" }
    },
    required: ["symbol", "assetType"]
  }
};

export const PROPOSE_UPDATE_METADATA: FunctionDeclaration = {
  name: "propose_update_metadata",
  description: "提议更新现有资产的元数据（名称、类型、货币、价格）。无法更改数量（请为此使用交易）。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assetId: { type: Type.STRING, description: "资产 ID" },
      name: { type: Type.STRING, description: "新名称" },
      symbol: { type: Type.STRING, description: "新代码" },
      assetType: { type: Type.STRING, enum: ["STOCK", "CRYPTO", "CASH", "REAL_ESTATE", "LIABILITY", "FUND", "OTHER"], description: "新类型" },
      currency: { type: Type.STRING, enum: ["USD", "CNY", "HKD"], description: "新货币" },
      currentPrice: { type: Type.NUMBER, description: "更新当前市场价格（不影响数量）" }
    },
    required: ["assetId"]
  }
};

export const PROPOSE_BULK_ASSET_UPDATE: FunctionDeclaration = {
  name: "propose_bulk_asset_update",
  description: "提议一次进行多个资产添加或更新。用于分析图片或进行批量更新。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assets: {
        type: Type.ARRAY,
        description: "识别出的资产列表。",
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING, description: "交易代码" },
            name: { type: Type.STRING, description: "资产名称" },
            quantity: { type: Type.NUMBER, description: "持有数量" },
            currentPrice: { type: Type.NUMBER, description: "当前市场价格 (Current Market Price)" },
            avgCost: { type: Type.NUMBER, description: "平均持仓成本 (Average Cost Base)" },
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

export const PROPOSE_TRANSACTION: FunctionDeclaration = {
  name: "propose_transaction",
  description: "提议添加、更新或删除交易。这是更改现有资产数量的唯一途径。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mutationType: { type: Type.STRING, enum: ["ADD", "UPDATE", "DELETE"], description: "变更类型" },
      transactionId: { type: Type.STRING, description: "交易 ID（更新/删除时必填）" },
      assetId: { type: Type.STRING, description: "资产 ID（添加时必填）" },
      txType: { type: Type.STRING, enum: ["BUY", "SELL", "DIVIDEND", "DEPOSIT", "WITHDRAWAL", "BORROW", "REPAY", "BALANCE_ADJUSTMENT"], description: "交易类型" },
      quantity: { type: Type.NUMBER, description: "涉及数量" },
      price: { type: Type.NUMBER, description: "单位价格" },
      date: { type: Type.STRING, description: "ISO 8601 日期时间" },
      fee: { type: Type.NUMBER, description: "费用" },
      note: { type: Type.STRING, description: "可选备注" }
    },
    required: ["mutationType"]
  }
};

export const PROPOSE_BATCH_DELETE: FunctionDeclaration = {
  name: "propose_batch_delete",
  description: "提议一次删除多个资产。",
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

export const ALL_TOOLS: FunctionDeclaration[] = [
  GET_PORTFOLIO_STATE_TOOL,
  GET_ASSET_DETAILS_TOOL,
  SEARCH_TRANSACTIONS_TOOL,
  PROPOSE_ADD_ASSET,
  PROPOSE_UPDATE_METADATA,
  PROPOSE_BULK_ASSET_UPDATE,
  PROPOSE_TRANSACTION,
  PROPOSE_BATCH_DELETE
];
