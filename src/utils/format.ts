import { isUpdateStale, pnlTextCls, staleTextCls } from '../theme/colors'

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

/** 盈亏颜色 class */
export function pnlColor(n: number): string {
  return pnlTextCls(n)
}

export function fmtNum(n: number, maxDigits = 4): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: maxDigits })
}

/** 日期时间:MM/DD HH:mm:ss */
export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** 汇率输入展示:截断至最多 4 位小数,去掉尾随零 */
export function formatFxRate(n: number, digits = 4): string {
  return parseFloat(n.toFixed(digits)).toString()
}

const countryNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' })

/** ISO 3166-1 alpha-2 国家码 → 中文国名；未知为「未知」 */
export function fmtCountry(code: string): string {
  const raw = code?.trim()
  if (!raw || raw === '?') return '未知'
  const upper = raw.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return raw
  try {
    return countryNames.of(upper) ?? raw
  } catch {
    return raw
  }
}

export { isUpdateStale }

/** 「更新于」列文字颜色 */
export function staleUpdateCls(dateStr: string | undefined, thresholdDays = 30): string {
  return staleTextCls(dateStr, thresholdDays)
}
