import { sendChatMessage } from './api'
import type { TempMemoryLog, CoreMemory } from '@/types'

interface OrganizeMemoryParams {
  messages: Array<{ role: string; content: string; dateTime?: string }>
  roleName: string
  apiKey: string
  apiBaseUrl: string
  model: string
}

interface OrganizeMemoryResult {
  summary: string
  importance: number
  category: CoreMemory['category']
}

/**
 * 记忆整理 - 调用 AI 总结对话内容并评估重要度
 * Args: messages-对话消息, roleName-角色名, apiKey/apiBaseUrl/model-API配置
 * Returns: { summary, importance, category }
 */
export async function organizeMemory(params: OrganizeMemoryParams): Promise<OrganizeMemoryResult> {
  const { messages, roleName, apiKey, apiBaseUrl, model } = params

  if (messages.length === 0) {
    return { summary: '', importance: 3, category: 'other' }
  }

  // 构建对话文本（与原版格式一致）
  const dialogueText = messages
    .map((m) => `${m.dateTime ? m.dateTime + ' | ' : ''}[${m.role === 'user' ? '用户' : roleName}] ${m.content}`)
    .join('\n')

  // --- 第一步：生成摘要（与原版提示词一致） ---
  const currentDate = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const summaryPrompt = `当前日期：${currentDate}\n请以${roleName}的视角，用中文总结以下对话，提取重要信息总结为一段话作为记忆片段（直接回复一段话）。注意：必须使用具体日期（如"3月11日"），禁止使用"今天""昨天"等相对时间：\n${dialogueText}`

  const summaryResponse = await sendChatMessage({
    messages: [{ role: 'user', content: summaryPrompt }],
    model,
    maxTokens: 500,
    temperature: 0.7,
    apiKey,
    apiBaseUrl,
  })

  // 清洗摘要（与原版清洗逻辑一致）
  const summary = summaryResponse.content
    .replace(/\*{0,2}(重要度|摘要)\*{0,2}[\s:]*\d*[\.]?\d*[\s\\]*/g, '')
    .replace(/## 记忆片段.*/g, '')
    .replace(/[{}"]/g, '')
    .trim()

  if (!summary) {
    return { summary: '', importance: 3, category: 'other' }
  }

  // --- 第二步：评估重要性（独立 API 调用，与原版一致） ---
  const importancePrompt = `为以下记忆的重要性评分（1-5，直接回复数字）：\n${summary}`

  let importance = 3
  try {
    const importanceResponse = await sendChatMessage({
      messages: [{ role: 'user', content: importancePrompt }],
      model,
      maxTokens: 10,
      temperature: 0.3,
      apiKey,
      apiBaseUrl,
    })
    const importanceMatch = importanceResponse.content.match(/[1-5]/)
    if (importanceMatch) {
      importance = parseInt(importanceMatch[0])
    }
  } catch {
    // 评分失败使用默认值
  }

  // --- 第三步：分类（web 版扩展） ---
  let category: CoreMemory['category'] = 'other'
  try {
    const categoryPrompt = `将以下记忆分类，直接回复一个分类名：
user_info - 用户个人信息（姓名、职业、年龄等）
preference - 用户喜好偏好（喜欢的事物、习惯等）
event - 发生的事件（约会、活动等）
other - 其他
记忆内容：${summary}`
    const categoryResponse = await sendChatMessage({
      messages: [{ role: 'user', content: categoryPrompt }],
      model,
      maxTokens: 10,
      temperature: 0.3,
      apiKey,
      apiBaseUrl,
    })
    const cat = categoryResponse.content.trim().toLowerCase()
    if (['user_info', 'event', 'preference', 'other'].includes(cat)) {
      category = cat as CoreMemory['category']
    }
  } catch {
    // 分类失败使用默认值
  }

  return { summary, importance, category }
}

/**
 * 简单记忆整理（仅返回摘要字符串，兼容旧接口）
 */
export async function organizeMemorySimple(params: OrganizeMemoryParams): Promise<string> {
  const result = await organizeMemory(params)
  return result.summary
}

/**
 * 从临时记忆日志生成核心记忆
 */
export async function generateCoreMemoryFromLogs(
  logs: TempMemoryLog[],
  params: { roleName: string; apiKey: string; apiBaseUrl: string; model: string }
): Promise<OrganizeMemoryResult> {
  const messages = logs.map((log) => ({
    role: log.role === 'user' ? 'user' : 'assistant',
    content: log.content,
    dateTime: log.timestamp,
  }))
  return organizeMemory({ ...params, messages })
}

/**
 * 生成拍一拍回应
 * Args: roleName-角色名, apiKey/apiBaseUrl/model-API配置
 * Returns: string-AI的拍一拍回应
 */
export async function generateTickleResponse(params: {
  roleName: string
  personaContent: string
  apiKey: string
  apiBaseUrl: string
  model: string
}): Promise<string> {
  const { roleName, personaContent, apiKey, apiBaseUrl, model } = params

  const reactions = [
    '疑惑反问', '撒娇', '假装生气', '害羞', '开心',
    '调皮回拍', '装傻', '惊讶', '傲娇', '关心对方'
  ]
  const randomReaction = reactions[Math.floor(Math.random() * reactions.length)]

  const prompt = `用户拍了拍你！用${randomReaction}的语气回应，直接说话，不要加引号。1-2句话，可加emoji。`

  // 使用人设提示词作为 system prompt
  const systemPrompt = personaContent 
    ? `${personaContent}\n\n[当前场景：用户拍了拍你，请保持角色性格回应]`
    : `你是${roleName}，保持角色性格，自然活泼地回应`

  const response = await sendChatMessage({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    model,
    maxTokens: 100,
    temperature: 1.0,
    apiKey,
    apiBaseUrl,
  })

  return response.content.trim()
}

/**
 * 检查是否需要自动记忆整理
 * Args: messageCount-当前消息数, threshold-触发阈值(默认20)
 * Returns: boolean-是否需要整理
 */
export function shouldAutoOrganize(messageCount: number, threshold = 20): boolean {
  return messageCount > 0 && messageCount % threshold === 0
}
