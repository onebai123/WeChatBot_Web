/**
 * 消息解析器 - 处理 AI 回复中的特殊指令和分段消息
 * 支持: [tickle], [tickle_self], [recall], \ 分隔符
 */

export interface ParsedSegment {
  type: 'text' | 'tickle' | 'tickle_self' | 'recall'
  content: string
}

/**
 * 解析 AI 回复，提取特殊指令和分段消息
 * Args: rawText-原始AI回复文本
 * Returns: ParsedSegment[]-解析后的消息段数组
 */
export function parseAIResponse(rawText: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  
  // 按 \ 或 \\ 分隔消息段
  const parts = rawText.split(/\\+n?/).map((s) => s.trim()).filter(Boolean)
  
  for (const part of parts) {
    // 检查 [tickle] 指令
    if (part.includes('[tickle]')) {
      segments.push({ type: 'tickle', content: '' })
      const textPart = part.replace(/\[tickle\]/g, '').trim()
      if (textPart) {
        segments.push({ type: 'text', content: textPart })
      }
      continue
    }
    
    // 检查 [tickle_self] 指令
    if (part.includes('[tickle_self]')) {
      segments.push({ type: 'tickle_self', content: '' })
      const textPart = part.replace(/\[tickle_self\]/g, '').trim()
      if (textPart) {
        segments.push({ type: 'text', content: textPart })
      }
      continue
    }
    
    // 检查 [recall] 指令
    if (part.includes('[recall]')) {
      segments.push({ type: 'recall', content: '' })
      const textPart = part.replace(/\[recall\]/g, '').trim()
      if (textPart) {
        segments.push({ type: 'text', content: textPart })
      }
      continue
    }
    
    // 普通文本
    if (part) {
      segments.push({ type: 'text', content: part })
    }
  }
  
  return segments
}

/**
 * 计算打字延迟时间（模拟真实打字速度）
 * Args: text-消息文本, avgSpeed-平均每字时间(ms)
 * Returns: number-延迟毫秒数
 */
export function calculateTypingDelay(text: string, avgSpeed = 80): number {
  const baseDelay = text.length * avgSpeed
  const randomFactor = 0.8 + Math.random() * 0.4 // 0.8~1.2 随机波动
  return Math.min(Math.max(baseDelay * randomFactor, 500), 3000) // 限制在 500ms~3000ms
}

/**
 * 清理消息文本，移除特殊指令标记
 * Args: text-原始文本
 * Returns: string-清理后的纯文本
 */
export function cleanMessageText(text: string): string {
  return text
    .replace(/\[tickle\]/g, '')
    .replace(/\[tickle_self\]/g, '')
    .replace(/\[recall\]/g, '')
    .replace(/\\+n?/g, ' ')
    .trim()
}

/**
 * 检查消息是否包含特殊指令
 * Args: text-消息文本
 * Returns: { hasTickle, hasTickleSelf, hasRecall }
 */
export function detectSpecialCommands(text: string): {
  hasTickle: boolean
  hasTickleSelf: boolean
  hasRecall: boolean
} {
  return {
    hasTickle: text.includes('[tickle]'),
    hasTickleSelf: text.includes('[tickle_self]'),
    hasRecall: text.includes('[recall]'),
  }
}
