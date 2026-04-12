/**
 * 表情模块 - AI 表情回复处理
 */

import { sendChatMessage } from './api'
import type { EmojiItem, EmojiCategory } from '@/types'

// 常用表情映射
const EMOJI_MAP: Record<string, string> = {
  // 情绪
  happy: '😊',
  sad: '😢',
  angry: '😠',
  love: '❤️',
  laugh: '😂',
  cry: '😭',
  shy: '😳',
  think: '🤔',
  cool: '😎',
  sleep: '😴',
  surprise: '😮',
  
  // 动作
  wave: '👋',
  ok: '👌',
  thumbup: '👍',
  clap: '👏',
  hug: '🤗',
  kiss: '😘',
  
  // 物品
  heart: '💕',
  star: '⭐',
  fire: '🔥',
  gift: '🎁',
  coffee: '☕',
  food: '🍔',
  
  // 天气/自然
  sun: '☀️',
  moon: '🌙',
  rain: '🌧️',
  snow: '❄️',
  flower: '🌸',
}

/**
 * 解析 AI 回复中的表情标记
 * 格式: [emoji:xxx] 或直接的 emoji
 */
export function parseEmojis(text: string): { cleanText: string; emojis: string[] } {
  const emojis: string[] = []
  
  // 匹配 [emoji:xxx] 格式
  let cleanText = text.replace(/\[emoji:(\w+)\]/g, (_, name) => {
    const emoji = EMOJI_MAP[name.toLowerCase()]
    if (emoji) {
      emojis.push(emoji)
      return emoji
    }
    return ''
  })
  
  return { cleanText: cleanText.trim(), emojis }
}

/**
 * 根据概率决定是否发送表情
 */
export function shouldSendEmoji(probability: number): boolean {
  return Math.random() * 100 < probability
}

/**
 * 分析文本情绪，推荐表情
 */
export function suggestEmoji(text: string): string | null {
  const lowerText = text.toLowerCase()
  
  // 简单的关键词匹配
  if (/开心|高兴|哈哈|嘻嘻/.test(lowerText)) return '😊'
  if (/难过|伤心|呜呜/.test(lowerText)) return '😢'
  if (/生气|愤怒/.test(lowerText)) return '😠'
  if (/爱|喜欢|❤/.test(lowerText)) return '❤️'
  if (/困|睡|晚安/.test(lowerText)) return '😴'
  if (/害羞|脸红/.test(lowerText)) return '😳'
  if (/谢谢|感谢/.test(lowerText)) return '🙏'
  if (/加油|棒|厉害/.test(lowerText)) return '💪'
  
  return null
}

/**
 * 获取随机表情
 */
export function getRandomEmoji(): string {
  const emojis = Object.values(EMOJI_MAP)
  return emojis[Math.floor(Math.random() * emojis.length)]
}

/**
 * 在消息末尾添加表情
 */
export function appendEmoji(text: string, emoji: string): string {
  return `${text} ${emoji}`
}

/**
 * AI 情绪检测 - 分析消息情绪并返回对应的表情分类
 * 用于从收藏的表情中选择合适的表情发送
 */
export async function detectEmotion(
  text: string,
  availableCategories: string[],
  config: { apiKey: string; apiBaseUrl: string; model: string }
): Promise<string | null> {
  if (!text || availableCategories.length === 0) return null

  const prompt = `请判断以下消息表达的情绪，并仅回复一个词语的情绪分类：
${text}
可选的分类有：${availableCategories.join(', ')}
请直接回复分类名称，不要包含其他内容。若对话未包含明显情绪，请回复"none"。`

  try {
    const response = await sendChatMessage({
      messages: [{ role: 'user', content: prompt }],
      model: config.model,
      maxTokens: 50,
      temperature: 0.3,
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl,
    })

    const result = response.content.trim().toLowerCase()
    
    // 验证是否为有效分类
    if (result === 'none') return null
    
    // 精确匹配
    if (availableCategories.includes(result)) return result
    
    // 模糊匹配
    for (const category of availableCategories) {
      if (category.includes(result) || result.includes(category)) {
        return category
      }
    }
    
    return null
  } catch (error) {
    console.error('情绪检测失败:', error)
    return null
  }
}

/**
 * 根据概率和情绪决定是否发送收藏的表情
 */
export async function shouldSendCollectedEmoji(
  text: string,
  probability: number,
  emojis: EmojiItem[],
  config: { apiKey: string; apiBaseUrl: string; model: string }
): Promise<EmojiItem | null> {
  // 概率检查
  const roll = Math.random() * 100
  if (roll >= probability) {
    console.log(`[Emoji] 收藏表情概率未命中: roll=${roll.toFixed(1)} >= ${probability}`)
    return null
  }
  console.log(`[Emoji] 收藏表情概率命中: roll=${roll.toFixed(1)} < ${probability}，检测情绪...`)
  
  // 获取所有可用分类
  const categories = Array.from(new Set(emojis.map((e) => e.category)))
  if (categories.length === 0) {
    console.log('[Emoji] 收藏表情无可用分类')
    return null
  }
  
  // AI 检测情绪
  const emotion = await detectEmotion(text, categories, config)
  if (!emotion) {
    console.log('[Emoji] 收藏表情情绪未匹配')
    return null
  }
  
  // 从对应分类中随机选择表情
  const matchingEmojis = emojis.filter((e) => e.category === emotion)
  if (matchingEmojis.length === 0) {
    console.log(`[Emoji] 收藏表情分类 ${emotion} 下无可用表情`)
    return null
  }
  
  const selected = matchingEmojis[Math.floor(Math.random() * matchingEmojis.length)]
  console.log(`[Emoji] 选中收藏表情: emotion=${emotion}, url=${selected.url}`)
  return selected
}

// 静态表情图配置（来自 public/emojis 目录）
const GIF_EMOJI_MAP: Record<string, string[]> = {
  happy: ['/emojis/happy/1.gif', '/emojis/happy/2.gif', '/emojis/happy/3.gif', '/emojis/happy/4.gif', '/emojis/happy/5.gif'],
  loved: ['/emojis/loved/1.gif', '/emojis/loved/2.gif', '/emojis/loved/3.gif', '/emojis/loved/4.gif'],
  sad: ['/emojis/sad/1.gif', '/emojis/sad/2.gif'],
  angry: ['/emojis/angry/1.gif', '/emojis/angry/2.gif'],
  surprised: ['/emojis/surprised/1.gif', '/emojis/surprised/2.gif'],
  tired: ['/emojis/tired/1.gif', '/emojis/tired/2.gif', '/emojis/tired/3.gif', '/emojis/tired/4.gif'],
  confused: ['/emojis/confused/1.gif'],
  evasive: ['/emojis/evasive/1.gif'],
  reminded: ['/emojis/reminded/1.gif', '/emojis/reminded/2.gif'],
}

/**
 * 根据 AI 回复内容，决定是否发送 GIF 表情
 * Returns: GIF URL 或 null
 */
export async function shouldSendGifEmoji(
  text: string,
  probability: number,
  config: { apiKey: string; apiBaseUrl: string; model: string }
): Promise<string | null> {
  // 概率检查
  const roll = Math.random() * 100
  if (roll >= probability) {
    console.log(`[GIF] 概率未命中: roll=${roll.toFixed(1)} >= ${probability}`)
    return null
  }
  console.log(`[GIF] 概率命中: roll=${roll.toFixed(1)} < ${probability}，检测情绪...`)
  
  const categories = Object.keys(GIF_EMOJI_MAP)
  
  // AI 检测情绪
  const emotion = await detectEmotion(text, categories, config)
  if (!emotion || !GIF_EMOJI_MAP[emotion]) {
    console.log(`[GIF] 情绪未匹配: emotion=${emotion || 'null'}`)
    return null
  }
  
  // 随机选择一个表情
  const gifs = GIF_EMOJI_MAP[emotion]
  const selected = gifs[Math.floor(Math.random() * gifs.length)]
  console.log(`[GIF] 选中表情: emotion=${emotion}, gif=${selected}`)
  return selected
}
