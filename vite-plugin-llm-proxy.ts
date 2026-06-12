import type { Connect } from 'vite'
import type { Plugin } from 'vite'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])
const PROXY_PREFIX = '/api/llm-proxy'

function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(baseUrl).hostname)
  } catch {
    return false
  }
}

const proxyMiddleware: Connect.NextHandleFunction = async (req, res, next) => {
  if (!req.url?.startsWith(PROXY_PREFIX)) {
    return next()
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-LLM-Base-URL')
    res.end()
    return
  }

  const targetBase = req.headers['x-llm-base-url']
  if (typeof targetBase !== 'string' || !targetBase) {
    res.statusCode = 400
    res.end('Missing X-LLM-Base-URL header')
    return
  }

  if (!isLocalBaseUrl(targetBase)) {
    res.statusCode = 403
    res.end('Proxy only allows local LLM base URLs')
    return
  }

  const path = req.url.slice(PROXY_PREFIX.length) || '/'
  const targetUrl = `${targetBase.replace(/\/$/, '')}${path}`

  try {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk as Buffer)
    }
    const body = Buffer.concat(chunks)

    const forwardHeaders: Record<string, string> = {
      'Content-Type': (req.headers['content-type'] as string) ?? 'application/json',
    }
    if (typeof req.headers.authorization === 'string') {
      forwardHeaders.Authorization = req.headers.authorization
    }

    const upstream = await fetch(targetUrl, {
      method: req.method ?? 'POST',
      headers: forwardHeaders,
      body: body.length ? body : undefined,
    })

    res.statusCode = upstream.status
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === 'transfer-encoding' || lower === 'content-length') return
      res.setHeader(key, value)
    })

    if (!upstream.body) {
      res.end()
      return
    }

    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  } catch (err) {
    res.statusCode = 502
    res.end(`LLM proxy error: ${(err as Error).message}`)
  }
}

export function llmProxyPlugin(): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      server.middlewares.use(proxyMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(proxyMiddleware)
    },
  }
}
