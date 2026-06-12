/**
 * 项目唯一调色板 — 与 Tailwind slate/sky/red/emerald/amber 系对齐。
 * ECharts、inline style、CSS 变量均从此取值;UI 优先用语义 class 常量。
 */
export const palette = {
  bg: '#060a13',
  surface: '#0f172a',
  surfaceBorder: '#334155',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  scrollbar: '#1e293b',
  white: '#ffffff',

  sky400: '#38bdf8',
  sky500: '#0ea5e9',
  sky600: '#0284c7',
  emerald400: '#34d399',
  red400: '#f87171',
  amber400: '#fbbf24',
  pink400: '#f472b6',
  violet400: '#a78bfa',
  orange400: '#fb923c',
  slate400: '#94a3b8',
} as const

/** 资产类别色(ECharts 圆点、饼图等) */
export const assetTypeHex = {
  cash: palette.sky400,
  wealth: palette.emerald400,
  stock: palette.pink400,
  fund: palette.violet400,
  crypto: palette.amber400,
  property: palette.orange400,
  debt: palette.red400,
  other: palette.slate400,
} as const

/** Tailwind 语义色 class(盈亏、状态、交互) */
export const color = {
  pnlUp: 'text-red-400',
  pnlDown: 'text-emerald-400',
  pnlFlat: 'text-slate-400',
  stale: 'text-amber-400',
  muted: 'text-slate-500',
  link: 'text-sky-400',
  error: 'text-red-400',
  danger: 'text-red-400/80',
  accent: 'text-sky-400',

  alertWarn: 'rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300',
  alertInfo: 'rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-300',
  btnDanger:
    'rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10',
} as const

/** AI 顾问洞察卡片边框/背景 */
export const insightLevelCls = {
  danger: 'border-red-500/30 bg-red-500/5',
  warn: 'border-amber-500/30 bg-amber-500/5',
  info: 'border-sky-500/30 bg-sky-500/5',
  good: 'border-emerald-500/30 bg-emerald-500/5',
} as const

/** 健康评分仪表盘颜色 */
export function healthScoreHex(score: number): string {
  if (score >= 85) return palette.emerald400
  if (score >= 70) return palette.sky400
  if (score >= 55) return palette.amber400
  return palette.red400
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

export function isUpdateStale(dateStr: string | undefined, thresholdDays = 30): boolean {
  if (!dateStr) return false
  const parsed = Date.parse(dateStr)
  if (Number.isNaN(parsed)) return false
  return Date.now() - parsed > thresholdDays * DAY_MS
}

/** 「更新于」列:超过一个月未更新时警示色 */
export function staleTextCls(dateStr: string | undefined, thresholdDays = 30): string {
  return isUpdateStale(dateStr, thresholdDays) ? color.stale : color.muted
}
