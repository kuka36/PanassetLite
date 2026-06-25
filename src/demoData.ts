import type { Asset, PriceHistory, Transaction } from './types'
import { uid } from './services/storage'

/** 生成演示数据:银行存款 + 两个支付宝理财 + 三只股票 + 房贷 + BTC/USDT */
export function buildDemoData(): {
  assets: Asset[]
  transactions: Transaction[]
  prices: PriceHistory
} {
  const now = new Date()
  const at = (monthsAgo: number, dd = 5, h = 12, min = 0, sec = 0): number => {
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, dd, h, min, sec, 0)
    if (d > now) d.setMonth(d.getMonth() - 1)
    return d.getTime()
  }

  const dateKey = (monthsAgo: number, dd = 5): string => {
    const d = new Date(at(monthsAgo, dd))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const mk = (a: Omit<Asset, 'id' | 'createdAt'>): Asset => ({
    ...a,
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

    { assetId: usdt.id, type: 'BUY', occurredAt: at(4, 6), quantity: 2000, price: 7.15 },

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

  const prices: PriceHistory = {
    bitcoin: { [dateKey(1, 22)]: 495000, [dateKey(0, 6)]: 510000 },
    tether: { [dateKey(0, 6)]: 7.18 },
    AAPL: { [dateKey(0, 6)]: 1480 },
  }

  return { assets, transactions, prices }
}
