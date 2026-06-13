import { Asset, Transaction, TransactionType, AssetType } from '../../types/domain';
import { Language, ActionType, PendingAction } from '../../types/store';
import { ToolContext, ToolResult } from './types';

export class ToolExecutor {
  executeToolCall(
    name: string,
    args: any,
    context: ToolContext
  ): ToolResult {
    const { assets, transactions, language } = context;

    if (name === 'get_portfolio_state') {
      const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
      const totalCost = assets.reduce((sum, a) => sum + a.totalCost, 0);
      return {
        response: {
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
        }
      };
    }

    if (name === 'get_asset_details') {
      const query = (args.symbolOrId || "").toUpperCase();
      const asset = assets.find(a => a.id === query || a.symbol === query);

      if (!asset) {
        return { response: { error: "Asset not found" } };
      }

      const assetTxs = transactions
        .filter(t => t.assetId === asset.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20);

      return {
        response: {
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
        }
      };
    }

    if (name === 'search_transactions') {
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

      return {
        response: {
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
        }
      };
    }

    if (name === 'propose_add_asset') {
      return {
        action: {
          type: 'ADD_ASSET',
          data: {
            symbol: args.symbol,
            name: args.name,
            quantity: args.initialQuantity,
            price: args.price,
            cost: args.cost,
            type: args.assetType as AssetType,
            currency: args.currency,
            date: args.dateAcquired || new Date().toISOString().split('T')[0]
          },
          summary: `Add New Asset: ${args.symbol}`
        }
      };
    }

    if (name === 'propose_update_metadata') {
      let displaySymbol = args.assetId;
      const existing = assets.find(a => a.id === args.assetId);
      if (existing) displaySymbol = existing.symbol;

      return {
        action: {
          type: 'UPDATE_ASSET',
          targetId: args.assetId,
          data: {
            symbol: args.symbol,
            name: args.name,
            type: args.assetType as AssetType,
            currency: args.currency,
            price: args.currentPrice
          },
          summary: `Update Metadata: ${displaySymbol}`
        }
      };
    }

    if (name === 'propose_bulk_asset_update') {
      const count = args.assets?.length || 0;
      return {
        text: language === 'zh'
          ? "我从图片中识别到了以下资产，请确认是否导入："
          : "I found the following assets in the image. Please confirm to import:",
        action: {
          type: 'BULK_ASSET_UPDATE',
          data: {},
          items: args.assets,
          summary: language === 'zh'
            ? `从图片识别到 ${count} 个资产持仓`
            : `Identified ${count} assets from image`
        }
      };
    }

    if (name === 'propose_transaction') {
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

      return {
        action: {
          type: actionType,
          targetId: args.transactionId,
          data: {
            assetId: args.assetId,
            type: args.txType as TransactionType,
            quantity: args.quantity,
            price: args.price,
            date: args.date || new Date().toISOString().split('T')[0],
            fee: args.fee
          },
          summary: `${args.mutationType} Transaction: ${args.txType || ''} ${symbolStr}`
        }
      };
    }

    if (name === 'propose_batch_delete') {
      const count = args.assetIds?.length || 0;
      return {
        text: language === 'zh'
          ? `我建议删除以下 ${count} 个资产。请确认：`
          : `I propose deleting the following ${count} assets. Please confirm:`,
        action: {
          type: 'BATCH_DELETE_ASSET',
          data: {},
          items: args.assetIds.map((id: string) => ({ id })),
          summary: language === 'zh'
            ? `批量删除 ${count} 个资产: ${args.reason || ''}`
            : `Batch delete ${count} assets: ${args.reason || ''}`
        }
      };
    }

    return { response: { error: "Unknown tool" } };
  }
}
