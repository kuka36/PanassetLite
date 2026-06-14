/**
 * PanassetLite 访问统计（Cloudflare Worker）
 * 仅上报页面路径、来源、设备 UA；不上传资产数据。
 */

const WORKER = 'https://panassetlite-analytics.panassetlite.workers.dev'
const SID_KEY = '__pa_sid'
const HEARTBEAT_MS = 120_000

let currentPage = ''

function getSid(): string {
  let sid = localStorage.getItem(SID_KEY)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(SID_KEY, sid)
  }
  return sid
}

function pagePath(): string {
  const base = location.pathname.replace(/\/$/, '') || '/'
  return currentPage ? `${base}#/${currentPage}` : location.pathname + location.hash
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

/** 应用启动：首次访问 + 心跳 + 离线 */
export function initAnalytics(initialPage: string) {
  currentPage = initialPage
  hit(true)
  setInterval(() => hit(false), HEARTBEAT_MS)
  window.addEventListener('pagehide', leave)
}
