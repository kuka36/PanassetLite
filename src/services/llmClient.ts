const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])
const PROXY_PREFIX = '/api/llm-proxy'

export function isLocalLlmBaseUrl(baseUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(baseUrl).hostname)
  } catch {
    return false
  }
}

/** 本地 LLM 在浏览器直连会触发 CORS,开发/预览时改走 Vite 同源代理。 */
export function shouldUseLlmProxy(baseUrl: string): boolean {
  if (!isLocalLlmBaseUrl(baseUrl)) return false
  if (typeof window === 'undefined') return false
  return LOCAL_HOSTS.has(window.location.hostname)
}

export function resolveLlmEndpoint(baseUrl: string): { url: string; proxyBase?: string } {
  const normalized = baseUrl.replace(/\/$/, '')
  if (shouldUseLlmProxy(normalized)) {
    return {
      url: `${PROXY_PREFIX}/chat/completions`,
      proxyBase: normalized,
    }
  }
  return { url: `${normalized}/chat/completions` }
}

function buildLlmRequestInit(
  baseUrl: string,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
): { url: string; init: RequestInit } {
  const { url, proxyBase } = resolveLlmEndpoint(baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (proxyBase) {
    headers['X-LLM-Base-URL'] = proxyBase
  }
  return {
    url,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    },
  }
}

async function llmFetch(
  baseUrl: string,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const { url, init } = buildLlmRequestInit(baseUrl, apiKey, body, signal)
  try {
    return await fetch(url, init)
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    if (shouldUseLlmProxy(baseUrl)) {
      throw new Error(
        `无法连接本地 LLM (${baseUrl})。请确认 LM Studio / Ollama 等服务已启动,且 Vite 开发服务器正在运行。`,
      )
    }
    throw new Error(
      `LLM 请求失败: ${(err as Error).message}。若使用本地模型,请将 Base URL 设为 http://127.0.0.1:端口/v1 并通过 npm run dev 访问应用。`,
    )
  }
}

export async function postChatCompletions(
  baseUrl: string,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return llmFetch(baseUrl, apiKey, body, signal)
}

function parseSsePayload(payload: string): string {
  if (payload === '[DONE]') return ''
  const json = JSON.parse(payload) as {
    error?: { message?: string }
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
  }
  const err = json.error?.message
  if (err) throw new Error(err)
  return json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? ''
}

/** 读取 OpenAI 兼容 SSE 流;不支持流式时回退解析整段 JSON。 */
export async function readChatCompletionStream(
  response: Response,
  onDelta: (chunk: string, accumulated: string) => void,
): Promise<string> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LLM 接口请求失败 (${response.status}): ${text.slice(0, 200)}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) throw new Error('LLM 返回内容为空')
    onDelta(content, content)
    return content
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('LLM 响应不支持流式读取')

  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let lineEnd = buffer.indexOf('\n')
    while (lineEnd !== -1) {
      const rawLine = buffer.slice(0, lineEnd)
      buffer = buffer.slice(lineEnd + 1)
      lineEnd = buffer.indexOf('\n')

      const line = rawLine.trimEnd()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trimStart()
      if (!payload || payload === '[DONE]') continue

      try {
        const delta = parseSsePayload(payload)
        if (delta) {
          accumulated += delta
          onDelta(delta, accumulated)
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }

  if (!accumulated.trim()) throw new Error('LLM 返回内容为空')
  return accumulated
}
