import type { Asset, PriceHistory, Transaction } from './types'
import { uid } from './services/storage'

/** 生成演示数据:银行存款 + 两个支付宝理财 + 三只股票 + 房贷 + BTC/USDT */
export function buildDemoData(): {
  assets: Asset[]
  transactions: Transaction[]
  prices: PriceHistory
} {
  const now = new Date()
  /** n 个月前的日期(日固定为 dd) */
  const m = (monthsAgo: number, dd = 5): string => {
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, dd)
    if (d > now) d.setMonth(d.getMonth() - 1)
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

  const txs: Array<Omit<Transaction, 'id' | 'createdAt'>> = [
    // 银行卡
    { assetId: bank.id, type: 'DEPOSIT', date: m(8), amount: 60000, note: '初始结余' },
    { assetId: bank.id, type: 'DEPOSIT', date: m(5, 10), amount: 12000, note: '工资结余' },
    { assetId: bank.id, type: 'WITHDRAW', date: m(2, 18), amount: 8000, note: '旅行支出' },
    { assetId: bank.id, type: 'VALUATION', date: m(0, 2), value: 65200 },

    // 余额宝:月度估值,年化约 1.5%
    { assetId: yuebao.id, type: 'DEPOSIT', date: m(7), amount: 30000 },
    { assetId: yuebao.id, type: 'VALUATION', date: m(5), value: 30075 },
    { assetId: yuebao.id, type: 'VALUATION', date: m(3), value: 30150 },
    { assetId: yuebao.id, type: 'VALUATION', date: m(1), value: 30224 },

    // 稳健理财:年化约 3.4%
    { assetId: wealth2.id, type: 'DEPOSIT', date: m(6, 12), amount: 50000 },
    { assetId: wealth2.id, type: 'VALUATION', date: m(4, 12), value: 50290 },
    { assetId: wealth2.id, type: 'VALUATION', date: m(2, 12), value: 50580 },
    { assetId: wealth2.id, type: 'VALUATION', date: m(0, 3), value: 50860 },

    // 贵州茅台:100 股,有浮盈
    { assetId: moutai.id, type: 'BUY', date: m(7, 15), quantity: 100, price: 1450 },
    { assetId: moutai.id, type: 'VALUATION', date: m(4, 15), value: 149000 },
    { assetId: moutai.id, type: 'VALUATION', date: m(1, 15), value: 158500 },

    // 宁德时代:300 股,浮亏
    { assetId: catl.id, type: 'BUY', date: m(6, 20), quantity: 300, price: 210 },
    { assetId: catl.id, type: 'VALUATION', date: m(3, 20), value: 57600 },
    { assetId: catl.id, type: 'VALUATION', date: m(0, 4), value: 55200 },

    // 苹果:20 股(USD)
    { assetId: aapl.id, type: 'BUY', date: m(5, 8), quantity: 20, price: 185 },
    { assetId: aapl.id, type: 'VALUATION', date: m(1, 8), value: 4120 },

    // BTC:0.08 枚,分两次买入
    { assetId: btc.id, type: 'BUY', date: m(8, 25), quantity: 0.05, price: 430000 },
    { assetId: btc.id, type: 'BUY', date: m(3, 9), quantity: 0.03, price: 480000 },

    // USDT:2000 枚
    { assetId: usdt.id, type: 'BUY', date: m(4, 6), quantity: 2000, price: 7.15 },

    // 房贷:剩余本金 78 万,每月还款约减少本金 2600
    { assetId: mortgage.id, type: 'BORROW', date: m(8), amount: 800000, note: '剩余本金' },
    ...[7, 6, 5, 4, 3, 2, 1, 0].map((i) => ({
      assetId: mortgage.id,
      type: 'REPAY' as const,
      date: m(i, 20),
      amount: 2600,
      note: '月供本金部分',
    })),
  ]

  const transactions: Transaction[] = txs.map((t) => ({ ...t, id: uid(), createdAt: Date.now() }))

  // 预置少量行情观测点,保证未联网时图表也有数据
  const prices: PriceHistory = {
    bitcoin: { [m(1, 22)]: 495000, [m(0, 6)]: 510000 },
    tether: { [m(0, 6)]: 7.18 },
    AAPL: { [m(0, 6)]: 1480 }, // 已折算 CNY
  }

  return { assets, transactions, prices }
}
