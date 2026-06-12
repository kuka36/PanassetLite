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

export async function postChatCompletions(
  baseUrl: string,
  apiKey: string,
  body: unknown,
): Promise<Response> {
  const { url, proxyBase } = resolveLlmEndpoint(baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (proxyBase) {
    headers['X-LLM-Base-URL'] = proxyBase
  }

  try {
    return await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (err) {
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
