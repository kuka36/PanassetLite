/** 金额格式化:¥1,234,567 */
export function fmtMoney(n: number, digits = 0): string {
  return `¥${n.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

/** 紧凑金额:1.23 万 / 123.4 万 / 1.2 亿 */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)} 亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)} 万`
  return `${sign}${abs.toFixed(0)}`
}

/** 百分比:+12.3% */
export function fmtPct(n: number, digits = 1, signed = true): string {
  const v = (n * 100).toFixed(digits)
  return `${signed && n > 0 ? '+' : ''}${v}%`
}

/** 盈亏颜色(中国习惯:红涨绿跌) */
export function pnlColor(n: number): string {
  if (n > 0.0001) return 'text-red-400'
  if (n < -0.0001) return 'text-emerald-400'
  return 'text-slate-400'
}

export function fmtNum(n: number, maxDigits = 4): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: maxDigits })
}
