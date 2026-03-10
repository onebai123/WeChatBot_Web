/**
 * 日志系统 - 统一管理应用日志
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'
export type LogCategory = 'general' | 'event' | 'schedule'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: unknown
  category: LogCategory
}

// 最大日志条数
const MAX_LOGS = 200
const STORAGE_KEY = 'wechatbot-logs'

// 从 sessionStorage 恢复日志
function loadLogs(): LogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as LogEntry[]
  } catch { /* ignore */ }
  return []
}

// 防抖保存到 sessionStorage
let saveTimer: ReturnType<typeof setTimeout> | null = null
function persistLogs(): void {
  if (typeof window === 'undefined') return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
    } catch { /* storage full, ignore */ }
  }, 300)
}

// 日志存储
let logs: LogEntry[] = loadLogs()

// 日志监听器
const listeners: Set<(logs: LogEntry[]) => void> = new Set()

// 生成日志 ID
const generateId = () => `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

// 格式化时间
const formatTime = () => new Date().toLocaleString('zh-CN', { 
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3
})

// 控制台样式
const CONSOLE_STYLES: Record<LogLevel, string> = {
  info: 'color: #07C160; font-weight: bold;',
  warn: 'color: #ff9800; font-weight: bold;',
  error: 'color: #f44336; font-weight: bold;',
  debug: 'color: #9c27b0; font-weight: bold;',
}

// 模块前缀样式
const MODULE_STYLE = 'color: #2196f3; font-weight: bold;'

/**
 * 创建日志条目
 */
function createLog(level: LogLevel, module: string, message: string, data?: unknown, category: LogCategory = 'general'): LogEntry {
  const entry: LogEntry = {
    id: generateId(),
    timestamp: formatTime(),
    level,
    module,
    message,
    data,
    category,
  }

  // 添加到日志列表
  logs = [...logs.slice(-(MAX_LOGS - 1)), entry]
  persistLogs()

  // 控制台输出
  const prefix = `%c[${entry.timestamp}] %c[${module}]%c`
  const styles = [CONSOLE_STYLES[level], MODULE_STYLE, '']
  
  if (data !== undefined) {
    console[level === 'debug' ? 'log' : level](prefix, ...styles, message, data)
  } else {
    console[level === 'debug' ? 'log' : level](prefix, ...styles, message)
  }

  // 通知监听器
  listeners.forEach(listener => listener([...logs]))

  return entry
}

/**
 * 日志方法
 */
export const logger = {
  info: (module: string, message: string, data?: unknown) => createLog('info', module, message, data),
  warn: (module: string, message: string, data?: unknown) => createLog('warn', module, message, data),
  error: (module: string, message: string, data?: unknown) => createLog('error', module, message, data),
  debug: (module: string, message: string, data?: unknown) => createLog('debug', module, message, data),

  // 获取所有日志
  getLogs: () => [...logs],
  
  // 按分类获取日志
  getLogsByCategory: (category: LogCategory) => logs.filter(l => l.category === category),

  // 清空日志
  clear: () => {
    logs = []
    persistLogs()
    listeners.forEach(listener => listener([]))
  },
  
  // 按分类清空日志
  clearByCategory: (category: LogCategory) => {
    logs = logs.filter(l => l.category !== category)
    persistLogs()
    listeners.forEach(listener => listener([...logs]))
  },

  // 订阅日志更新
  subscribe: (listener: (logs: LogEntry[]) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  // 导出日志
  export: () => {
    return logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.module}] ${log.message}${log.data ? ' ' + JSON.stringify(log.data) : ''}`
    ).join('\n')
  },
}

// 模块专用日志器
export const createModuleLogger = (module: string, category: LogCategory = 'general') => ({
  info: (message: string, data?: unknown) => createLog('info', module, message, data, category),
  warn: (message: string, data?: unknown) => createLog('warn', module, message, data, category),
  error: (message: string, data?: unknown) => createLog('error', module, message, data, category),
  debug: (message: string, data?: unknown) => createLog('debug', module, message, data, category),
})

// 导出预定义模块日志器 - 通用日志
export const chatLog = createModuleLogger('Chat')
export const memoryLog = createModuleLogger('Memory')
export const apiLog = createModuleLogger('API')
export const visionLog = createModuleLogger('Vision')
export const searchLog = createModuleLogger('Search')

// 事件日志
export const eventLog = createModuleLogger('Event', 'event')
export const tickleLog = createModuleLogger('Tickle', 'event')
export const emojiLog = createModuleLogger('Emoji', 'event')

// 定时任务日志
export const scheduleLog = createModuleLogger('Schedule', 'schedule')
export const autoMsgLog = createModuleLogger('AutoMsg', 'schedule')
export const autoMemoryLog = createModuleLogger('AutoMemory', 'schedule')
