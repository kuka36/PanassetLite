/**
 * PanassetLite 访问统计
 * 默认走阿里云 FC；可通过环境变量配置主/备端点。
 * 仅上报页面路径、来源、设备 UA；不上传资产数据。
 */

const CF_FALLBACK = 'https://panassetlite-analytics.panassetlite.workers.dev'
const SID_KEY = '__pa_sid'
const NEW_KEY = '__pa_new'

function analyticsEndpoints(): string[] {
  const primary = import.meta.env.VITE_ANALYTICS_URL as string | undefined
  const fallback = import.meta.env.VITE_ANALYTICS_FALLBACK as string | undefined
  const urls = [primary, fallback].filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  )
  if (urls.length > 0) return urls.map((url) => url.replace(/\/$/, ''))
  return [CF_FALLBACK]
}

let currentPage = ''

function getSid(): string {
  let sid = localStorage.getItem(SID_KEY)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(SID_KEY, sid)
  }
  return sid
}

/** 与 Vite base 对齐的逻辑路径，如 /PanassetLite/dashboard（非 hash，非真实 URL） */
function pagePath(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  if (!currentPage) return base || '/'
  return base ? `${base}/${currentPage}` : `/${currentPage}`
}

function isFirstHitInSession(): boolean {
  try {
    if (sessionStorage.getItem(NEW_KEY)) return false
    sessionStorage.setItem(NEW_KEY, '1')
    return true
  } catch {
    return false
  }
}

function hitQuery(isNew: boolean): string {
  return (
    'sid=' +
    encodeURIComponent(getSid()) +
    '&p=' +
    encodeURIComponent(pagePath()) +
    '&r=' +
    encodeURIComponent(document.referrer) +
    (isNew ? '&new=1' : '')
  )
}

function hit(isNew: boolean) {
  const qs = hitQuery(isNew)
  for (const base of analyticsEndpoints()) {
    fetch(`${base}/hit?${qs}`).catch(() => {})
  }
}

function leave() {
  const qs = 'sid=' + encodeURIComponent(getSid())
  for (const base of analyticsEndpoints()) {
    navigator.sendBeacon(`${base}/leave?${qs}`)
  }
}

/** 页面切换时更新本地路径（统计仅在会话首次访问时上报） */
export function reportPageView(page: string) {
  currentPage = page
}

/** 应用启动：本会话首次访问上报一次 */
export function initAnalytics(initialPage: string) {
  currentPage = initialPage
  hit(isFirstHitInSession())
  window.addEventListener('pagehide', leave)
}
