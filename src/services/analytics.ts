/**
 * PanassetLite 访问统计（Cloudflare Worker）
 * 仅上报页面路径、来源、设备 UA；不上传资产数据。
 */

const WORKER = 'https://panassetlite-analytics.panassetlite.workers.dev'
const SID_KEY = '__pa_sid'
const NEW_KEY = '__pa_new'

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

function hit(isNew: boolean) {
  const url =
    WORKER +
    '/hit?sid=' +
    encodeURIComponent(getSid()) +
    '&p=' +
    encodeURIComponent(pagePath()) +
    '&r=' +
    encodeURIComponent(document.referrer) +
    (isNew ? '&new=1' : '')
  fetch(url).catch(() => {})
}

function leave() {
  navigator.sendBeacon(WORKER + '/leave?sid=' + encodeURIComponent(getSid()))
}

/** 页面切换时上报当前虚拟路径（SPA 无路由 URL 变化） */
export function reportPageView(page: string, isNew = false) {
  currentPage = page
  hit(isNew)
}

/** 应用启动：本会话首次计为访问，页面切换时由 reportPageView 续期会话 */
export function initAnalytics(initialPage: string) {
  currentPage = initialPage
  hit(isFirstHitInSession())
  window.addEventListener('pagehide', leave)
}
