/**
 * 项目唯一调色板 — 浅色主题，与 Tailwind slate/blue/red/green/amber 系对齐。
 * ECharts、inline style、CSS 变量均从此取值；UI 优先用语义 class 常量。
 */
export const palette = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceBorder: '#f1f5f9',
  text: '#334155',
  textTitle: '#1e293b',
  textMuted: '#64748b',
  scrollbar: '#cbd5e1',
  white: '#ffffff',

  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  indigo600: '#4f46e5',
  green600: '#16a34a',
  red500: '#ef4444',
  red600: '#dc2626',
  amber500: '#f59e0b',
  emerald400: '#34d399',
  pink400: '#f472b6',
  violet400: '#a78bfa',
  orange400: '#fb923c',
  slate400: '#94a3b8',
} as const

/** 资产类别色(ECharts 圆点、饼图等) */
export const assetTypeHex = {
  cash: palette.blue500,
  wealth: palette.green600,
  stock: palette.pink400,
  fund: palette.violet400,
  crypto: palette.amber500,
  property: palette.orange400,
  debt: palette.red500,
  other: palette.slate400,
} as const

/** Tailwind 语义色 class(盈亏、状态、交互) */
export const color = {
  pnlUp: 'text-red-600',
  pnlDown: 'text-green-600',
  pnlFlat: 'text-slate-500',
  stale: 'text-amber-600',
  muted: 'text-slate-500',
  link: 'text-blue-600',
  error: 'text-red-600',
  danger: 'text-red-600',
  accent: 'text-blue-600',
  ai: 'text-indigo-600',

  alertWarn:
    'rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700',
  alertInfo:
    'rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700',
  btnDanger:
    'rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600 transition-all duration-200 hover:bg-red-50 active:scale-95',
} as const

/** AI 顾问洞察卡片边框/背景 */
export const insightLevelCls = {
  danger: 'border-red-100 bg-red-50',
  warn: 'border-amber-100 bg-amber-50',
  info: 'border-blue-100 bg-blue-50',
  good: 'border-green-100 bg-green-50',
} as const

/** 健康评分仪表盘颜色 */
export function healthScoreHex(score: number): string {
  if (score >= 85) return palette.green600
  if (score >= 70) return palette.blue600
  if (score >= 55) return palette.amber500
  return palette.red500
}

/** hex → rgba,供 ECharts 渐变 */
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const DAY_MS = 86_400_000

/** 盈亏文字色(中国习惯:红涨绿跌) */
export function pnlTextCls(n: number): string {
  if (n > 0.0001) return color.pnlUp
  if (n < -0.0001) return color.pnlDown
  return color.pnlFlat
}

export function isUpdateStale(date: string | number | undefined, thresholdDays = 30): boolean {
  if (date == null) return false
  const parsed = typeof date === 'number' ? date : Date.parse(date)
  if (Number.isNaN(parsed)) return false
  return Date.now() - parsed > thresholdDays * DAY_MS
}

/** 「最近记录」列:超过一个月未更新时警示色 */
export function staleTextCls(date: string | number | undefined, thresholdDays = 30): string {
  return isUpdateStale(date, thresholdDays) ? color.stale : color.muted
}
