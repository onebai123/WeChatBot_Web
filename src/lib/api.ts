/** 构建 API URL，自动补全 /v1 路径 */
function buildApiUrl(apiBaseUrl: string): string {
  let baseUrl = apiBaseUrl || 'https://api.openai.com/v1'
  baseUrl = baseUrl.replace(/\/$/, '') // 去掉末尾斜杠
  // 如果没有 /v1 结尾，自动补全
  if (!baseUrl.endsWith('/v1')) {
    baseUrl = `${baseUrl}/v1`
  }
  return `${baseUrl}/chat/completions`
}

interface ChatMessage {
  role: string
  content: string
}

interface SendChatParams {
  messages: ChatMessage[]
  model: string
  maxTokens: number
  temperature: number
  apiKey: string
  apiBaseUrl: string
}

interface ChatResponse {
  content: string
  error?: string
}

export async function sendChatMessage(params: SendChatParams): Promise<ChatResponse> {
  const { messages, model, maxTokens, temperature, apiKey, apiBaseUrl } = params

  if (!apiKey) {
    throw new Error('请先配置 API Key')
  }

  const url = buildApiUrl(apiBaseUrl)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `请求失败: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  return { content }
}

/** 空回复错误（用于触发重试） */
export class EmptyResponseError extends Error {
  constructor() {
    super('流式响应返回空内容')
    this.name = 'EmptyResponseError'
  }
}

/** 流式请求（可选） */
export async function* streamChatMessage(params: SendChatParams): AsyncGenerator<string> {
  const { messages, model, maxTokens, temperature, apiKey, apiBaseUrl } = params

  if (!apiKey) {
    throw new Error('请先配置 API Key')
  }

  const url = buildApiUrl(apiBaseUrl)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `请求失败: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

  const decoder = new TextDecoder()
  let buffer = ''
  let hasContent = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const json = trimmed.slice(6)
        const parsed = JSON.parse(json)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          hasContent = true
          yield content
        }
      } catch {
        // 忽略解析错误的行
      }
    }
  }

  if (!hasContent) {
    throw new EmptyResponseError()
  }
}
