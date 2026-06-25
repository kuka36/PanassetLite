const DAY_MS = 86400_000

/** 本地日历 YYYY-MM-DD */
export function formatDateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 本地日 00:00:00.000 */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 本地日 23:59:59.999 */
export function endOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** 旧 YYYY-MM-DD → 本地 12:00（迁移用，避免时区日界漂移） */
export function migrateDateToOccurredAt(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime()
}

/** 行情日 YYYY-MM-DD → 该日 23:59:59.999 本地 ms */
export function endOfDayFromDateKey(date: string): number {
  return migrateDateToOccurredAt(date) + 12 * 3600_000 - 1
}

/** datetime-local 值 → ms；非法时返回 null */
export function parseDatetimeLocal(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** ms → datetime-local 输入值（秒精度） */
export function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 两时刻间隔天数（浮点），不足 1 天返回小数 */
export function daysBetween(a: number, b: number): number {
  return Math.abs(b - a) / DAY_MS
}

export function todayEndMs(): number {
  return endOfDay(Date.now())
}

export function todayStartMs(): number {
  return startOfDay(Date.now())
}
