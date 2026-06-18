/**
 * PanassetLite Analytics — 阿里云函数计算 FC 3.0 + OSS
 *
 * 路由：/hit /leave /stats /debug/geoip / /dashboard
 */

const { randomUUID } = require('crypto')
const {
  parseUA,
  recordNewVisit,
  removeSession,
  buildStatsResponse,
  resolveCountry,
  resolveCountryDebug,
} = require('./stats-core')
const { createStore } = require('./storage-oss')
const { DASHBOARD_HTML } = require('./dashboard')
const { getHeader, resolveRequest, firstQueryValue } = require('./http-req')

const DEFAULT_ORIGIN = 'https://kuka36.github.io'

function allowedOrigins() {
  const raw = process.env.ALLOWED_ORIGIN || DEFAULT_ORIGIN
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function corsHeaders(origin) {
  const allowed = allowedOrigins()
  const match = allowed.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': match,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function respond(statusCode, body, extraHeaders = {}) {
  const isString = typeof body === 'string'
  return {
    statusCode,
    headers: {
      'Content-Type': isString && statusCode !== 204 ? 'text/plain; charset=utf-8' : 'application/json',
      ...extraHeaders,
    },
    body: isString ? body : JSON.stringify(body),
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return respond(status, data, {
    'Content-Type': 'application/json',
    ...extraHeaders,
  })
}

exports.handler = async (event, context) => {
  const { method, path, query, headers, userAgent, sourceIp } = resolveRequest(event)
  const origin = getHeader(headers, 'origin')
  const cors = corsHeaders(origin)

  if (firstQueryValue(query, 'debug') === 'path') {
    return json({ method, path, query, sourceIp }, 200, cors)
  }

  if (method === 'OPTIONS') {
    return respond(204, '', cors)
  }

  if (path === '/debug/geoip') {
    try {
      const debug = await resolveCountryDebug(headers, getHeader, sourceIp)
      return json(debug, 200, cors)
    } catch (err) {
      console.error('/debug/geoip failed:', err)
      return json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        500,
        cors,
      )
    }
  }

  if (path === '/hit') {
    const debug = firstQueryValue(query, 'debug') === '1'
    try {
      const store = createStore(context)
      const sid = firstQueryValue(query, 'sid') || randomUUID()
      const pagePath = firstQueryValue(query, 'p') || '/'
      const ref = firstQueryValue(query, 'r') || ''
      const country = await resolveCountry(headers, getHeader, sourceIp)
      const ts = Date.now()
      const { device, browser, os } = parseUA(userAgent)
      const isNew = firstQueryValue(query, 'new') === '1'

      if (isNew) {
        await recordNewVisit(store, sid, { sid, path: pagePath, ref, country, device, browser, os, ts })
      }

      if (debug) {
        const geoDebug = await resolveCountryDebug(headers, getHeader, sourceIp)
        return json({ sid, ok: true, country, ...geoDebug }, 200, cors)
      }
      return json({ sid, ok: true }, 200, cors)
    } catch (err) {
      console.error('/hit failed:', err)
      const body = debug
        ? { ok: false, error: err instanceof Error ? err.message : String(err) }
        : { ok: false }
      return json(body, 200, cors)
    }
  }

  if (path === '/leave') {
    const sid = firstQueryValue(query, 'sid')
    if (sid) {
      try {
        const store = createStore(context)
        await removeSession(store, sid)
      } catch (err) {
        console.error('/leave failed:', err)
      }
    }
    return respond(200, 'ok', cors)
  }

  if (path === '/stats') {
    try {
      const store = createStore(context)
      const bundle = await store.loadBundle()
      return json(buildStatsResponse(bundle), 200, cors)
    } catch (err) {
      console.error('/stats failed:', err)
      return json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        503,
        cors,
      )
    }
  }

  if (path === '/' || path === '/dashboard') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: DASHBOARD_HTML,
    }
  }

  return json({ ok: false, error: 'Not Found', path, method }, 404, cors)
}
