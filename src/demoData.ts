import type { Asset, PriceHistory, Settings, Strategy, StrategyTransaction, Transaction } from './types'
import { DEFAULT_SETTINGS } from './types'
import { uid } from './services/storage'

/** 生成演示数据:银行存款 + 两个支付宝理财 + 三只股票 + 房贷 + BTC/USDT + 若干策略 */
export function buildDemoData(settings: Settings = DEFAULT_SETTINGS): {
  assets: Asset[]
  transactions: Transaction[]
  prices: PriceHistory
  strategies: Strategy[]
  strategyTransactions: StrategyTransaction[]
} {
  const now = new Date()
  const at = (monthsAgo: number, dd = 5, h = 12, min = 0, sec = 0): number => {
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, dd, h, min, sec, 0)
    if (d > now) d.setMonth(d.getMonth() - 1)
    return d.getTime()
  }

  const mk = (a: Omit<Asset, 'id' | 'createdAt'>): Asset => ({
    ...a,
    id: uid(),
    createdAt: Date.now(),
  })

  const mkStrategy = (s: Omit<Strategy, 'id' | 'createdAt'>): Strategy => ({
    ...s,
    id: uid(),
    createdAt: Date.now(),
  })

  const bank = mk({ name: '招商银行储蓄卡', type: 'cash', currency: 'CNY', priceSource: 'manual', platform: '招商银行' })
  const yuebao = mk({ name: '余额宝', type: 'wealth', currency: 'CNY', priceSource: 'manual', platform: '支付宝' })
  const wealth2 = mk({ name: '稳健理财·安鑫90天', type: 'wealth', currency: 'CNY', priceSource: 'manual', platform: '支付宝' })
  const moutai = mk({ name: '贵州茅台', type: 'stock', currency: 'CNY', symbol: '600519', priceSource: 'manual', platform: '华泰证券' })
  const catl = mk({ name: '宁德时代', type: 'stock', currency: 'CNY', symbol: '300750', priceSource: 'manual', platform: '华泰证券' })
  const aapl = mk({ name: '苹果 AAPL', type: 'stock', currency: 'USD', symbol: 'AAPL', priceSource: 'finnhub', platform: '富途' })
  const btc = mk({ name: '比特币', type: 'crypto', currency: 'CNY', symbol: 'bitcoin', priceSource: 'coingecko', platform: '币安' })
  const usdt = mk({ name: 'USDT', type: 'crypto', currency: 'CNY', symbol: 'tether', priceSource: 'coingecko', platform: '币安' })
  const mortgage = mk({ name: '房贷(剩余本金)', type: 'debt', currency: 'CNY', priceSource: 'manual', platform: '建设银行' })

  const assets = [bank, yuebao, wealth2, moutai, catl, aapl, btc, usdt, mortgage]

  const usdCny = settings.fxRates.USD
  const usdtCny = settings.fxRates.USDT ?? usdCny

  const txs: Array<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>> = [
    { assetId: bank.id, type: 'DEPOSIT', occurredAt: at(8), amount: 60000, note: '初始结余' },
    { assetId: bank.id, type: 'DEPOSIT', occurredAt: at(5, 10), amount: 12000, note: '工资结余' },
    { assetId: bank.id, type: 'WITHDRAW', occurredAt: at(2, 18), amount: 8000, note: '旅行支出' },
    { assetId: bank.id, type: 'VALUATION', occurredAt: at(0, 2), value: 65200 },

    { assetId: yuebao.id, type: 'DEPOSIT', occurredAt: at(7), amount: 30000 },
    { assetId: yuebao.id, type: 'VALUATION', occurredAt: at(5), value: 30075 },
    { assetId: yuebao.id, type: 'VALUATION', occurredAt: at(3), value: 30150 },
    { assetId: yuebao.id, type: 'VALUATION', occurredAt: at(1), value: 30224 },

    { assetId: wealth2.id, type: 'DEPOSIT', occurredAt: at(6, 12), amount: 50000 },
    { assetId: wealth2.id, type: 'VALUATION', occurredAt: at(4, 12), value: 50290 },
    { assetId: wealth2.id, type: 'VALUATION', occurredAt: at(2, 12), value: 50580 },
    { assetId: wealth2.id, type: 'VALUATION', occurredAt: at(0, 3), value: 50860 },

    { assetId: moutai.id, type: 'BUY', occurredAt: at(7, 15), quantity: 100, price: 1450 },
    { assetId: moutai.id, type: 'VALUATION', occurredAt: at(4, 15), value: 149000 },
    { assetId: moutai.id, type: 'VALUATION', occurredAt: at(1, 15), value: 158500 },

    { assetId: catl.id, type: 'BUY', occurredAt: at(6, 20), quantity: 300, price: 210 },
    { assetId: catl.id, type: 'VALUATION', occurredAt: at(3, 20), value: 57600 },
    { assetId: catl.id, type: 'VALUATION', occurredAt: at(0, 4), value: 55200 },

    { assetId: aapl.id, type: 'BUY', occurredAt: at(5, 8), quantity: 20, price: 185 },
    { assetId: aapl.id, type: 'VALUATION', occurredAt: at(1, 8), value: 4120 },

    { assetId: btc.id, type: 'BUY', occurredAt: at(8, 25), quantity: 0.05, price: 430000 },
    { assetId: btc.id, type: 'BUY', occurredAt: at(3, 9), quantity: 0.03, price: 480000 },

    { assetId: usdt.id, type: 'BUY', occurredAt: at(4, 6), quantity: 2000, price: usdtCny },

    { assetId: mortgage.id, type: 'BORROW', occurredAt: at(8), amount: 800000, note: '剩余本金' },
    ...[7, 6, 5, 4, 3, 2, 1, 0].map((i) => ({
      assetId: mortgage.id,
      type: 'REPAY' as const,
      occurredAt: at(i, 20),
      amount: 2600,
      note: '月供本金部分',
    })),
  ]

  const transactions: Transaction[] = txs.map((t) => {
    const ts = Date.now()
    return { ...t, id: uid(), createdAt: ts, updatedAt: ts }
  })

  // 不写入假行情:避免 panasset.prices 污染正式使用;演示资产靠流水定价,真实行情由设置页手动拉取
  const prices: PriceHistory = {}

  const btcDca = mkStrategy({
    assetId: btc.id,
    name: 'BTC 周定投',
    kind: 'dca',
    currency: 'CNY',
    note: '每周四固定买入，与现货账户分开跟踪',
  })
  const aaplDca = mkStrategy({
    assetId: aapl.id,
    name: 'AAPL 月定投',
    kind: 'dca',
    currency: 'USD',
    note: '每月工资日自动扣款',
  })
  const catlGrid = mkStrategy({
    assetId: catl.id,
    name: '宁德时代网格',
    kind: 'grid',
    currency: 'CNY',
    note: '20 格区间，低买高卖',
  })
  const yuebaoTrack = mkStrategy({
    assetId: yuebao.id,
    name: '余额宝收益跟踪',
    kind: 'manual',
    currency: 'CNY',
    note: '单独透镜观察余额宝收益曲线',
  })

  const strategies = [btcDca, aaplDca, catlGrid, yuebaoTrack]

  const stxs: Array<Omit<StrategyTransaction, 'id' | 'createdAt'>> = [
    // BTC 周定投：6 期 × 3000，当前市值 21500
    { strategyId: btcDca.id, type: 'DEPOSIT', occurredAt: at(6, 4), amount: 3000, note: '第 1 期' },
    { strategyId: btcDca.id, type: 'DEPOSIT', occurredAt: at(5, 4), amount: 3000 },
    { strategyId: btcDca.id, type: 'DEPOSIT', occurredAt: at(4, 4), amount: 3000 },
    { strategyId: btcDca.id, type: 'DEPOSIT', occurredAt: at(3, 4), amount: 3000 },
    { strategyId: btcDca.id, type: 'VALUATION', occurredAt: at(2, 18), value: 12800 },
    { strategyId: btcDca.id, type: 'DEPOSIT', occurredAt: at(2, 4), amount: 3000 },
    { strategyId: btcDca.id, type: 'DEPOSIT', occurredAt: at(1, 4), amount: 3000 },
    { strategyId: btcDca.id, type: 'VALUATION', occurredAt: at(0, 8), value: 21500 },

    // AAPL 月定投：5 期 × 500 USD，当前 2780
    { strategyId: aaplDca.id, type: 'DEPOSIT', occurredAt: at(5, 15), amount: 500 },
    { strategyId: aaplDca.id, type: 'DEPOSIT', occurredAt: at(4, 15), amount: 500 },
    { strategyId: aaplDca.id, type: 'DEPOSIT', occurredAt: at(3, 15), amount: 500 },
    { strategyId: aaplDca.id, type: 'DEPOSIT', occurredAt: at(2, 15), amount: 500 },
    { strategyId: aaplDca.id, type: 'DEPOSIT', occurredAt: at(1, 15), amount: 500 },
    { strategyId: aaplDca.id, type: 'VALUATION', occurredAt: at(0, 5), value: 2780 },

    // 宁德时代网格：本金 + 网格收益，近期估值回落
    { strategyId: catlGrid.id, type: 'DEPOSIT', occurredAt: at(5, 8), amount: 30000, note: '初始本金' },
    { strategyId: catlGrid.id, type: 'INCOME', occurredAt: at(4, 12), amount: 680, note: '网格成交收益' },
    { strategyId: catlGrid.id, type: 'VALUATION', occurredAt: at(3, 8), value: 31200 },
    { strategyId: catlGrid.id, type: 'INCOME', occurredAt: at(2, 6), amount: 750, note: '网格成交收益' },
    { strategyId: catlGrid.id, type: 'VALUATION', occurredAt: at(0, 7), value: 30430 },

    // 余额宝收益跟踪：稳步小幅增值
    { strategyId: yuebaoTrack.id, type: 'DEPOSIT', occurredAt: at(4, 1), amount: 10000, note: '纳入跟踪' },
    { strategyId: yuebaoTrack.id, type: 'VALUATION', occurredAt: at(3, 1), value: 10045 },
    { strategyId: yuebaoTrack.id, type: 'VALUATION', occurredAt: at(2, 1), value: 10092 },
    { strategyId: yuebaoTrack.id, type: 'VALUATION', occurredAt: at(1, 1), value: 10138 },
    { strategyId: yuebaoTrack.id, type: 'VALUATION', occurredAt: at(0, 1), value: 10185 },
  ]

  const strategyTransactions: StrategyTransaction[] = stxs.map((t) => ({
    ...t,
    id: uid(),
    createdAt: Date.now(),
  }))

  return { assets, transactions, prices, strategies, strategyTransactions }
}
