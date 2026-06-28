import type { Asset, PriceHistory, Settings, Strategy, StrategyTransaction, Transaction } from '../../types'
import { DEFAULT_SETTINGS } from '../../types'

const DAY_MS = 86400_000

export const T0 = new Date('2024-01-01T12:00:00').getTime()
export const T1 = T0 + 180 * DAY_MS
export const T2 = T0 + 365 * DAY_MS
export const NOW = new Date('2025-06-01T12:00:00').getTime()

export function settings(overrides?: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

export function asset(overrides: Partial<Asset> & Pick<Asset, 'id' | 'type'>): Asset {
  return {
    name: overrides.name ?? '测试资产',
    currency: overrides.currency ?? 'CNY',
    priceSource: overrides.priceSource ?? 'manual',
    createdAt: overrides.createdAt ?? T0,
    ...overrides,
  }
}

export function tx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'assetId' | 'type' | 'occurredAt'>): Transaction {
  const now = overrides.occurredAt
  return {
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function strategy(overrides: Partial<Strategy> & Pick<Strategy, 'id' | 'assetId'>): Strategy {
  return {
    name: overrides.name ?? '测试策略',
    kind: overrides.kind ?? 'manual',
    currency: overrides.currency ?? 'CNY',
    createdAt: overrides.createdAt ?? T0,
    ...overrides,
  }
}

export function strategyTx(
  overrides: Partial<StrategyTransaction> & Pick<StrategyTransaction, 'id' | 'strategyId' | 'type' | 'occurredAt'>,
): StrategyTransaction {
  return {
    createdAt: overrides.occurredAt,
    ...overrides,
  }
}

export const emptyPrices: PriceHistory = {}
