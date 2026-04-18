/** 消息类型 */
export interface Message {
  id: string
  text: string
  inversion: boolean  // true=用户消息, false=AI消息
  dateTime: string
  loading?: boolean
  error?: boolean
  isRecalled?: boolean      // 撤回标记
  isTickle?: boolean        // 拍一拍标记
  isMemoryDivider?: boolean // 记忆整理分隔线
  organized?: boolean       // 已整理标记
  image?: string            // 图片 base64
  audio?: string            // 语音 base64
  audioDuration?: number    // 语音时长（秒）
  replyTo?: {               // 引用回复
    id: string
    text: string
    isUser: boolean
  }
}

/** 会话类型 */
export interface Chat {
  uuid: number
  title: string
  messages: Message[]
  isEdit?: boolean
  personaId?: string  // 绑定的人设ID
}

/** 人设类型（人设 = 聊天对象，包含消息记录） */
export interface Persona {
  pinned?: boolean        // 是否置顶
  id: string
  name: string
  avatar?: string
  content: string           // 人设提示词
  isDefault?: boolean
  messages: Message[]       // 聊天记录
  lastMessageTime?: string  // 最后消息时间（用于排序）
  createdAt?: string        // 创建时间
}

/** GPT 配置 */
export interface GptConfig {
  model: string
  maxTokens: number
  systemMessage: string
  temperature: number
  topP: number
  talkCount: number  // 上下文轮数
  autoMemoryOrganize: boolean
  memoryOrganizeCount: number  // 记忆整理阈值（每多少条消息触发）
}

/** API 配置 */
export interface ApiConfig {
  apiKey: string
  apiBaseUrl: string
}

/** 用户信息 */
export interface UserInfo {
  avatar: string       // 用户头像（base64 或 URL）
  aiAvatar: string     // AI头像（base64 或 URL）
  name: string         // 用户昵称
  backgroundImage?: string  // 聊天背景图
}

/** 主动消息配置 */
export interface AutoMessageConfig {
  enabled: boolean           // 是否启用
  minInterval: number        // 最小间隔（分钟）
  maxInterval: number        // 最大间隔（分钟）
  prompt: string             // 触发提示词
}

/** 安静时间配置 */
export interface QuietTimeConfig {
  enabled: boolean
  startTime: string  // "22:00"
  endTime: string    // "08:00"
}

/** 视觉模型配置（图片识别） */
export interface VisionConfig {
  enabled: boolean
  apiKey: string
  apiBaseUrl: string
  model: string  // gpt-4o / moonshot-v1-vision
}

/** 联网搜索配置 */
export interface OnlineSearchConfig {
  enabled: boolean
  apiKey: string
  apiBaseUrl: string
  model: string
  searchPrompt: string  // 检测是否需要搜索的提示词
}

/** 核心记忆条目 */
export interface CoreMemory {
  id: string
  chatId: number        // 关联的会话ID
  content: string       // 记忆内容/摘要
  importance: number    // 1-5 重要度
  createdAt: string
  category: 'user_info' | 'event' | 'preference' | 'other'
}

/** 临时记忆（对话日志） */
export interface TempMemoryLog {
  timestamp: string     // 时间戳
  role: 'user' | 'ai'   // 发言者
  content: string       // 消息内容
}

/** 临时记忆存储 */
export interface TempMemory {
  chatId: number
  logs: TempMemoryLog[]
  lastUpdated: string
}

/** 表情配置 */
export interface EmojiConfig {
  enabled: boolean
  probability: number  // 发送概率 0-100
}

/** 锁屏配置 */
export interface LockScreenConfig {
  enabled: boolean      // 是否启用锁屏
  timeout: number       // 无操作超时时间（秒）
}

/** 表情收藏项 */
export interface EmojiItem {
  id: string
  name: string           // 表情名称
  url: string            // base64 或 URL
  category: string       // 情绪分类: happy, sad, angry, love 等
  createdAt: string
}

/** 表情分类 */
export type EmojiCategory = 'happy' | 'sad' | 'angry' | 'love' | 'surprise' | 'thinking' | 'greeting' | 'other'

/** 表情分类配置 */
export const EMOJI_CATEGORIES: { key: EmojiCategory; label: string; emoji: string }[] = [
  { key: 'happy', label: '开心', emoji: '😊' },
  { key: 'sad', label: '悲伤', emoji: '😢' },
  { key: 'angry', label: '生气', emoji: '😠' },
  { key: 'love', label: '爱心', emoji: '❤️' },
  { key: 'surprise', label: '惊讶', emoji: '😮' },
  { key: 'thinking', label: '思考', emoji: '🤔' },
  { key: 'greeting', label: '打招呼', emoji: '👋' },
  { key: 'other', label: '其他', emoji: '😎' },
]
