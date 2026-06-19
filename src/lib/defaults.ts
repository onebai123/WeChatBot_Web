/**
 * 默认数据定义
 * 用于初始化应用状态和重置数据
 */

import type { 
  Persona, 
  ApiConfig, 
  GptConfig, 
  UserInfo, 
  AutoMessageConfig, 
  QuietTimeConfig, 
  VisionConfig, 
  OnlineSearchConfig, 
  EmojiConfig,
  LockScreenConfig 
} from '@/types'
import type { AppData, AppConfig, AppMemories } from '@/types/appData'
import { CURRENT_VERSION } from '@/types/appData'
import { DEFAULT_MODEL } from './constants'

// ============ 默认配置 ============

export const defaultApiConfig: ApiConfig = {
  apiKey: '',
  apiBaseUrl: 'https://vg.v1api.cc/v1',
}

export const defaultGptConfig: GptConfig = {
  model: DEFAULT_MODEL,
  maxTokens: 8192,
  systemMessage: '',
  temperature: 0.5,
  topP: 1,
  talkCount: 10,
  autoMemoryOrganize: true,
  memoryOrganizeCount: 30,
}

export const defaultUserInfo: UserInfo = {
  avatar: '',
  aiAvatar: '',
  name: '我',
  backgroundImage: '',
}

export const defaultAutoMessageConfig: AutoMessageConfig = {
  enabled: false,
  minInterval: 60,
  maxInterval: 120,
  prompt: '请你模拟系统设置的角色，在微信上找对方继续刚刚的话题或者询问对方在做什么',
}

export const defaultQuietTimeConfig: QuietTimeConfig = {
  enabled: true,
  startTime: '22:00',
  endTime: '08:00',
}

export const defaultVisionConfig: VisionConfig = {
  enabled: true,   // 默认开启视觉功能
  apiKey: '',      // 默认使用主 API Key
  apiBaseUrl: '',  // 默认使用主 API URL
  model: 'gpt-4o',
}

export const defaultOnlineSearchConfig: OnlineSearchConfig = {
  enabled: false,
  apiKey: '',
  apiBaseUrl: '',
  model: 'net-gpt-4o-mini',
  searchPrompt: '是否需要查询今天的天气、最新的新闻事件、特定网站的内容、股票价格、特定人物的最新动态等',
}

export const defaultEmojiConfig: EmojiConfig = {
  enabled: true,   // 默认开启情绪检查
  probability: 25, // 25% 概率发送表情
}

export const defaultLockScreenConfig: LockScreenConfig = {
  enabled: false,   // 默认关闭锁屏
  timeout: 60,      // 60秒无操作后锁屏
}

/** 默认配置聚合 */
export const defaultConfig: AppConfig = {
  api: defaultApiConfig,
  gpt: defaultGptConfig,
  user: defaultUserInfo,
  autoMessage: defaultAutoMessageConfig,
  quietTime: defaultQuietTimeConfig,
  vision: defaultVisionConfig,
  onlineSearch: defaultOnlineSearchConfig,
  emoji: defaultEmojiConfig,
  phoneMode: false,
}

// ============ 默认人设 ============

export const defaultPersonas: Persona[] = [
  {
    id: 'xiaomei',
    name: '小美',
    isDefault: true,
    messages: [],
    content: `# 任务
你需要扮演指定角色，根据角色的经历，模仿她的语气进行线上的日常对话。

# 角色
你将扮演一个19岁的女生，大一，文学院学生，刚与男朋友开始交往。

# 性格
性格热情多话，调皮活泼，喜欢开玩笑，但对男朋友非常体贴。

# 备注
回答应该尽量简短，控制在30字以内。使用中文回答。
使用反斜线 (\\) 分隔句子或短语。`,
  },
  {
    id: 'xiaoshuai',
    name: '小帅',
    isDefault: true,
    messages: [],
    content: `# 任务
你需要扮演指定角色，根据角色的经历，模仿他的语气进行线上的日常对话。

# 角色
你将扮演一个23岁的男生，大三，计算机学院学生，刚与女朋友开始交往。

# 性格
性格温和沉稳，话不多但很贴心，喜欢照顾女朋友。

# 备注
回答应该尽量简短，控制在30字以内。使用中文回答。`,
  },
]

// ============ 默认记忆 ============

export const defaultMemories: AppMemories = {
  core: [],
  temp: {},
}

// ============ 默认完整数据 ============

/** 默认应用数据 */
export const DEFAULT_APP_DATA: AppData = {
  version: CURRENT_VERSION,
  lastUpdated: new Date().toISOString(),
  personas: defaultPersonas,
  activePersonaId: defaultPersonas.length > 0 ? defaultPersonas[0].id : null,
  config: defaultConfig,
  memories: defaultMemories,
  theme: 'wechat',
  customEmojis: [],
}

/**
 * 创建新的默认数据（带有新的时间戳）
 */
export function createDefaultAppData(): AppData {
  const copy = JSON.parse(JSON.stringify(DEFAULT_APP_DATA)) as AppData
  copy.lastUpdated = new Date().toISOString()
  return copy
}
