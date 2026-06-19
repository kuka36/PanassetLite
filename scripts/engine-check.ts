// 临时自检脚本:npx tsx scripts/engine-check.ts
import { PortfolioEngine } from '../src/engine/portfolio'
import { xirr } from '../src/engine/xirr'
import { buildDemoData } from '../src/demoData'
import { DEFAULT_SETTINGS } from '../src/types'

// localStorage shim(demoData 经由 storage.ts 引入 today/uid,不触发 localStorage,但保险起见)
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}`, extra ?? '')
  }
}

// 1. XIRR:一年前投 100,今天值 110 → 约 10%
const r1 = xirr([
  { date: '2025-06-12', amount: -100 },
  { date: '2026-06-12', amount: 110 },
])
check('xirr 单笔一年 10%', r1 != null && Math.abs(r1 - 0.1) < 0.005, r1)

// 2. XIRR 无解情形返回 null
check('xirr 同向现金流返回 null', xirr([
  { date: '2025-01-01', amount: -100 },
  { date: '2025-06-01', amount: -50 },
]) === null)

const demo = buildDemoData()
const engine = new PortfolioEngine(demo.assets, demo.transactions, demo.prices, DEFAULT_SETTINGS)
const summary = engine.summary()

// 3. 总量合理性
check('总资产 > 0', summary.totalAssetsCNY > 100000, summary.totalAssetsCNY)
check('负债在 75-80 万之间(80万 - 还款)', summary.totalDebtCNY > 750000 && summary.totalDebtCNY < 800000, summary.totalDebtCNY)
check('净资产 = 总资产 - 负债', Math.abs(summary.netWorthCNY - (summary.totalAssetsCNY - summary.totalDebtCNY)) < 0.01)

// 4. 银行卡:60000+12000-8000 后估值 65200
const bank = summary.snapshots.find((s) => s.asset.name.includes('招商'))!
check('银行卡市值=最后估值 65200', Math.abs(bank.valueCNY - 65200) < 0.01, bank.valueCNY)

// 5. 余额宝区间年化约 1.5%(最近两次估值 30150→30224, 2个月)
const yuebao = summary.snapshots.find((s) => s.asset.name === '余额宝')!
check('余额宝近期年化在 1%-2%', yuebao.recentAnnualized != null && yuebao.recentAnnualized > 0.01 && yuebao.recentAnnualized < 0.02, yuebao.recentAnnualized)

const yuebaoLedger = engine.txLedger(yuebao.asset)
const latestValRow = yuebaoLedger.find((r) => r.tx.type === 'VALUATION')!
check(
  '余额宝最新估值行近期年化与 snapshot 一致',
  latestValRow.intervalAnnualized != null &&
    yuebao.recentAnnualized != null &&
    Math.abs(latestValRow.intervalAnnualized - yuebao.recentAnnualized) < 0.001,
  { row: latestValRow.intervalAnnualized, snap: yuebao.recentAnnualized },
)
const oldestRow = yuebaoLedger[yuebaoLedger.length - 1]
check(
  '余额宝首笔 DEPOSIT 无区间年化',
  oldestRow.tx.type === 'DEPOSIT' &&
    oldestRow.intervalGainNative == null &&
    oldestRow.intervalAnnualized == null,
  oldestRow,
)
const chronological = [...yuebaoLedger].reverse()
const valAfterDeposit = chronological.find((r, i) => {
  const prev = chronological[i - 1]
  return r.tx.type === 'VALUATION' && prev?.tx.type === 'DEPOSIT'
})
check(
  '余额宝首次估值相对存入有正区间变化',
  valAfterDeposit != null &&
    valAfterDeposit.intervalGainNative != null &&
    valAfterDeposit.intervalGainNative > 0,
  valAfterDeposit?.intervalGainNative,
)

// 6. 稳健理财年化约 3.4%
const w2 = summary.snapshots.find((s) => s.asset.name.includes('安鑫'))!
check('稳健理财近期年化在 3%-4%', w2.recentAnnualized != null && w2.recentAnnualized > 0.03 && w2.recentAnnualized < 0.04, w2.recentAnnualized)

// 7. 茅台:100股,最后估值 158500,投入 145000 → 盈亏 +13500
const moutai = summary.snapshots.find((s) => s.asset.name === '贵州茅台')!
check('茅台持有 100 股', moutai.quantity === 100, moutai.quantity)
check('茅台盈亏 +13500', Math.abs(moutai.totalPnlCNY - 13500) < 1, moutai.totalPnlCNY)
check('茅台 XIRR 为正', moutai.xirr != null && moutai.xirr > 0, moutai.xirr)

// 8. 宁德时代浮亏
const catl = summary.snapshots.find((s) => s.asset.name === '宁德时代')!
check('宁德时代浮亏', catl.totalPnlCNY < 0, catl.totalPnlCNY)

// 9. BTC 用行情缓存定价:0.08 × 510000 = 40800
const btc = summary.snapshots.find((s) => s.asset.name === '比特币')!
check('BTC 市值 = 0.08 × 510000', Math.abs(btc.valueCNY - 40800) < 1, btc.valueCNY)

// 10. AAPL(USD):行情缓存 1480 CNY/股 × 20
const aapl = summary.snapshots.find((s) => s.asset.symbol === 'AAPL')!
check('AAPL 市值 = 20 × 1480 CNY', Math.abs(aapl.valueCNY - 29600) < 1, aapl.valueCNY)

// 11. 净值历史:单调时间、首尾覆盖
const h = summary.history
check('历史序列非空且按日排列', h.length > 200 && h[0].date < h[h.length - 1].date, h.length)
check('历史最后一天净值与当前一致', Math.abs(h[h.length - 1].netWorth - summary.netWorthCNY) < 1, {
  hist: h[h.length - 1].netWorth,
  now: summary.netWorthCNY,
})

console.log(failures === 0 ? '\n全部通过 ✔' : `\n${failures} 项失败 ✘`)
process.exit(failures === 0 ? 0 : 1)
