/**
 * 风险评估工具模块
 * 
 * 职责：提供资产风险等级评估功能
 * 原则：单一职责、可扩展、易测试
 */

import { AssetMetadata, AssetType } from '../types';

/**
 * 风险等级枚举
 * 注意：值需与 Analytics.tsx 中的 RISK_COLORS 键匹配
 */
export enum RiskLevel {
    LOW = 'Low',
    MEDIUM = 'Medium',
    HIGH = 'High'
}

/**
 * 稳定币列表（与法币挂钩，波动性极低）
 * 可根据市场变化扩展
 */
const STABLECOINS = [
    'USDT',  // Tether
    'USDC',  // USD Coin
    'DAI',   // Dai
    'BUSD',  // Binance USD
    'TUSD',  // TrueUSD
    'USDD',  // Decentralized USD
    'FRAX',  // Frax
    'USDP',  // Pax Dollar
];

/**
 * 主流加密货币（市值大、流动性高、相对稳定）
 * 当前包含市值前2的加密货币
 */
const MAJOR_CRYPTO = [
    'BTC',   // Bitcoin
    'ETH',   // Ethereum
];

/**
 * 判断是否为稳定币
 * @param symbol 资产符号（如 USDT, usdt）
 * @returns 是否为稳定币
 */
export function isStablecoin(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase().trim();
    return STABLECOINS.includes(upperSymbol);
}

/**
 * 判断是否为主流加密货币
 * @param symbol 资产符号（如 BTC, btc）
 * @returns 是否为主流加密货币
 */
export function isMajorCrypto(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase().trim();
    return MAJOR_CRYPTO.includes(upperSymbol);
}

/**
 * 评估单个资产的风险等级
 * 
 * 分类规则：
 * - 低风险：现金、房地产、稳定币
 * - 中等风险：股票、基金、主流加密货币（BTC、ETH）
 * - 高风险：其他加密货币、未分类资产
 * 
 * @param asset 资产元数据
 * @returns 风险等级
 */
export function getAssetRiskLevel(asset: AssetMetadata): RiskLevel {
    // 负债不参与风险评估
    if (asset.type === AssetType.LIABILITY) {
        return RiskLevel.LOW; // 返回值不影响计算，因为负债会被过滤
    }

    // 现金和房地产 - 低风险
    if (asset.type === AssetType.CASH || asset.type === AssetType.REAL_ESTATE) {
        return RiskLevel.LOW;
    }

    // 股票和基金 - 中等风险
    if (asset.type === AssetType.STOCK || asset.type === AssetType.FUND) {
        return RiskLevel.MEDIUM;
    }

    // 加密货币 - 细粒度分类
    if (asset.type === AssetType.CRYPTO) {
        // 稳定币 - 低风险
        if (isStablecoin(asset.symbol)) {
            return RiskLevel.LOW;
        }

        // 主流加密货币（BTC、ETH）- 中等风险
        if (isMajorCrypto(asset.symbol)) {
            return RiskLevel.MEDIUM;
        }

        // 其他加密货币 - 高风险
        return RiskLevel.HIGH;
    }

    // 其他类型资产 - 默认低风险（保守处理）
    return RiskLevel.LOW;
}
