/**
 * 兼容 FC 3.0 事件函数与 HTTP 函数多种入参格式
 */

function getHeader(headers, name) {
  if (!headers) return ''
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : ''
}

function parseEvent(event) {
  if (Buffer.isBuffer(event)) {
    try {
      return JSON.parse(event.toString('utf8'))
    } catch {
      return {}
    }
  }
  if (typeof event === 'string') {
    try {
      return JSON.parse(event)
    } catch {
      return {}
    }
  }
  return event || {}
}

function normalizePath(raw) {
  if (raw == null || raw === '') return '/'
  let path = String(raw).split('?')[0]
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path || '/'
}

function pathFromUrl(url) {
  if (typeof url !== 'string' || !url) return ''
  const start = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]
  return normalizePath(start)
}

function parseQueryFromUrl(url) {
  if (typeof url !== 'string' || !url.includes('?')) return {}
  const qs = url.includes('://') ? new URL(url).search.slice(1) : url.split('?').slice(1).join('?')
  return Object.fromEntries(new URLSearchParams(qs))
}

function normalizeQuery(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) out[key] = value[0] ?? ''
    else if (value != null) out[key] = String(value)
    else out[key] = ''
  }
  return out
}

/** @returns {{ method: string, path: string, query: Record<string, string>, headers: Record<string, string>, userAgent: string }} */
function resolveRequest(event) {
  const req = parseEvent(event)
  const headers = req.headers || {}

  const method = (
    req.requestContext?.http?.method ||
    req.method ||
    req.httpMethod ||
    'GET'
  ).toUpperCase()

  const pathCandidates = [
    req.requestContext?.http?.path,
    req.rawPath,
    req.path,
    typeof req.url === 'string' ? pathFromUrl(req.url) : '',
    getHeader(headers, 'x-fc-request-path'),
    getHeader(headers, 'x-forwarded-uri'),
  ]
  let path = '/'
  for (const candidate of pathCandidates) {
    const normalized = normalizePath(candidate)
    if (normalized !== '/') {
      path = normalized
      break
    }
  }
  if (path === '/') {
    for (const candidate of pathCandidates) {
      const normalized = normalizePath(candidate)
      if (normalized) {
        path = normalized
        break
      }
    }
  }

  const query = {
    ...parseQueryFromUrl(typeof req.url === 'string' ? req.url : ''),
    ...normalizeQuery(req.queryParameters),
    ...normalizeQuery(req.queries),
    ...normalizeQuery(req.query),
  }

  const userAgent =
    req.requestContext?.http?.userAgent ||
    getHeader(headers, 'user-agent') ||
    ''

  return { method, path, query, headers, userAgent }
}

function firstQueryValue(query, key) {
  const value = query[key]
  return value == null ? '' : String(value)
}

module.exports = {
  getHeader,
  parseEvent,
  resolveRequest,
  firstQueryValue,
}
