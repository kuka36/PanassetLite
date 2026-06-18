/**
 * 访问统计核心逻辑（与存储无关）
 */

const RECENT_MAX = 200
const SESSION_TTL_MS = 300_000
const TREND_DAYS = 30

function parseUA(ua = '') {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua)
  const isTablet = /iPad|Tablet/i.test(ua)
  const device = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop'

  let browser = 'Other'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'

  let os = 'Other'
  if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) os = 'macOS'
  else if (/iPhone/i.test(ua)) os = 'iOS'
  else if (/iPad/i.test(ua)) os = 'iPadOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Linux/i.test(ua)) os = 'Linux'

  return { device, browser, os }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function emptyBundle() {
  return { total: 0, days: {}, sessions: {}, recent: [] }
}

function normalizeBundle(raw) {
  if (!raw || typeof raw !== 'object') return emptyBundle()
  return {
    total: raw.total || 0,
    days: raw.days || {},
    sessions: raw.sessions || {},
    recent: Array.isArray(raw.recent) ? raw.recent : [],
  }
}

function pruneSessions(raw, cutoff = Date.now() - SESSION_TTL_MS) {
  for (const sid of Object.keys(raw)) {
    if (!raw[sid]?.ts || raw[sid].ts < cutoff) delete raw[sid]
  }
  return raw
}

function pruneOldDays(days) {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - TREND_DAYS)
  const min = cutoff.toISOString().slice(0, 10)
  for (const date of Object.keys(days)) {
    if (date < min) delete days[date]
  }
  return days
}

function isPrivateIp(ip) {
  if (!ip) return true
  const trimmed = ip.trim()
  if (trimmed === '127.0.0.1' || trimmed === '::1') return true
  if (trimmed.startsWith('10.')) return true
  if (trimmed.startsWith('192.168.')) return true
  if (trimmed.startsWith('172.')) {
    const second = Number.parseInt(trimmed.split('.')[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  return false
}

/** @param {Record<string, string>} headers */
function clientIp(headers, getHeader, sourceIp = '') {
  const fromFc = sourceIp?.trim()
  if (fromFc && !isPrivateIp(fromFc)) return fromFc

  const forwarded = getHeader(headers, 'x-forwarded-for')
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim()
    if (ip && !isPrivateIp(ip)) return ip
  }
  for (const name of [
    'x-real-ip',
    'x-client-ip',
    'ali-real-client-ip',
    'cf-connecting-ip',
  ]) {
    const ip = getHeader(headers, name)?.trim()
    if (ip && !isPrivateIp(ip)) return ip
  }
  return null
}

/** @param {Record<string, string>} headers */
function countryFromHeaders(headers, getHeader) {
  for (const name of [
    'cf-ipcountry',
    'ali-ip-country',
    'x-vercel-ip-country',
    'x-client-ip-country',
    'ali-cdn-real-country',
  ]) {
    const val = getHeader(headers, name)
    if (val && /^[A-Za-z]{2}$/.test(val)) return val.toUpperCase()
  }
  return null
}

/** CDN 地域头；否则按 IP 依次尝试多个 geo 服务（FC 大陆节点优先 http ip-api） */
async function lookupCountryByIp(ip) {
  const providers = [
    {
      name: 'ip-api',
      url: `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`,
      pick: (data) => (data.status === 'success' ? data.countryCode : null),
    },
    {
      name: 'ipwho',
      url: `https://ipwho.is/${encodeURIComponent(ip)}`,
      pick: (data) => (data.success ? data.country_code : null),
    },
    {
      name: 'ip-sb',
      url: `https://api.ip.sb/geoip/${encodeURIComponent(ip)}`,
      pick: (data) => data.country_code || null,
    },
  ]

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, { signal: AbortSignal.timeout(2500) })
      if (!res.ok) continue
      const data = await res.json()
      const code = provider.pick(data)
      if (code && /^[A-Za-z]{2}$/.test(code)) {
        return { country: code.toUpperCase(), provider: provider.name }
      }
    } catch (err) {
      console.error(`geo ${provider.name} failed:`, err)
    }
  }
  return null
}

/** @param {Record<string, string>} headers */
async function resolveCountry(headers, getHeader, sourceIp = '') {
  const fromHeaders = countryFromHeaders(headers, getHeader)
  if (fromHeaders) return fromHeaders

  const ip = clientIp(headers, getHeader, sourceIp)
  if (!ip) return '?'

  const geo = await lookupCountryByIp(ip)
  return geo?.country || '?'
}

/** 诊断：FC sourceIp、解析 IP、CDN 头、geo 提供商 */
async function resolveCountryDebug(headers, getHeader, sourceIp = '') {
  const countryHeader = countryFromHeaders(headers, getHeader)
  const ip = clientIp(headers, getHeader, sourceIp)
  const ipHeaders = {}
  for (const name of [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'ali-real-client-ip',
    'cf-ipcountry',
    'ali-ip-country',
    'x-client-ip-country',
    'ali-cdn-real-country',
  ]) {
    const val = getHeader(headers, name)
    if (val) ipHeaders[name] = val
  }

  if (countryHeader) {
    return {
      country: countryHeader,
      source: 'header',
      sourceIp: sourceIp || null,
      clientIp: ip,
      ipHeaders,
      geo: null,
    }
  }

  if (!ip) {
    return {
      country: '?',
      source: 'none',
      sourceIp: sourceIp || null,
      clientIp: null,
      ipHeaders,
      geo: null,
      reason: 'no_public_ip',
    }
  }

  const geo = await lookupCountryByIp(ip)
  return {
    country: geo?.country || '?',
    source: geo ? 'geo' : 'none',
    sourceIp: sourceIp || null,
    clientIp: ip,
    ipHeaders,
    geo,
    reason: geo ? undefined : 'geo_lookup_failed',
  }
}

/** @param {{ loadBundle: () => Promise<object>, saveBundle: (b: object) => Promise<void> }} store */
async function recordNewVisit(store, sid, data) {
  const bundle = normalizeBundle(await store.loadBundle())
  pruneSessions(bundle.sessions)
  bundle.sessions[sid] = data
  bundle.recent.unshift(data)
  if (bundle.recent.length > RECENT_MAX) bundle.recent.length = RECENT_MAX
  bundle.total += 1
  const day = todayKey()
  bundle.days[day] = (bundle.days[day] || 0) + 1
  pruneOldDays(bundle.days)
  await store.saveBundle(bundle)
}

/** @param {{ loadBundle: () => Promise<object>, saveBundle: (b: object) => Promise<void> }} store */
async function removeSession(store, sid) {
  const bundle = normalizeBundle(await store.loadBundle())
  if (!bundle.sessions[sid]) return
  delete bundle.sessions[sid]
  await store.saveBundle(bundle)
}

function buildStatsResponse(bundle) {
  const data = normalizeBundle(bundle)
  const activeSessions = Object.values(pruneSessions({ ...data.sessions }))
  const recentHits = [...data.recent].sort((a, b) => b.ts - a.ts)

  const since24h = Date.now() - 86400_000
  const daily = recentHits.filter((h) => h.ts > since24h)

  const countBy = (arr, key) =>
    arr.reduce((acc, h) => {
      acc[h[key]] = (acc[h[key]] || 0) + 1
      return acc
    }, {})

  const now = new Date()
  const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - (TREND_DAYS - 1 - i))
    const date = d.toISOString().slice(0, 10)
    return { date, count: data.days[date] || 0 }
  })

  return {
    activeCount: activeSessions.length,
    activeSessions,
    totalVisits: data.total,
    todayVisits: data.days[todayKey()] || 0,
    last24hCount: daily.length,
    trend,
    byPage: countBy(daily, 'path'),
    byDevice: countBy(daily, 'device'),
    byBrowser: countBy(daily, 'browser'),
    byOS: countBy(daily, 'os'),
    byCountry: countBy(daily, 'country'),
    recentHits: recentHits.slice(0, 50),
  }
}

module.exports = {
  parseUA,
  emptyBundle,
  normalizeBundle,
  recordNewVisit,
  removeSession,
  buildStatsResponse,
  resolveCountry,
  resolveCountryDebug,
}
