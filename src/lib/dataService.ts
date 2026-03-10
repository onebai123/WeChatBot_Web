/**
 * 统一数据服务
 * 管理所有应用数据的加载、保存、导入、导出
 */

import type { AppData, ImportResult, StorageStats } from '@/types/appData'
import { CURRENT_VERSION, STORAGE_KEY } from '@/types/appData'
import { DEFAULT_APP_DATA, createDefaultAppData } from './defaults'
import { validateAppData, isValidAppData } from './dataValidator'
import { migrate, needsMigration, hasLegacyData, migrateFromLegacyFormat, cleanupLegacyStorage } from './migrationService'

// ============ 核心方法 ============

/**
 * 从 localStorage 加载数据
 */
export function load(): AppData {
  if (typeof window === 'undefined') {
    return createDefaultAppData()
  }

  try {
    // 首先检查新格式数据
    const raw = localStorage.getItem(STORAGE_KEY)
    
    if (raw) {
      const parsed = JSON.parse(raw)
      
      // 检查是否需要迁移
      if (needsMigration(parsed.version)) {
        console.log('[DataService] 检测到旧版本数据，开始迁移')
        const migrated = migrate(parsed)
        save(migrated)
        return migrated
      }
      
      // 验证数据结构
      if (isValidAppData(parsed)) {
        return parsed
      } else {
        console.warn('[DataService] 数据验证失败，尝试修复')
        const migrated = migrate(parsed)
        save(migrated)
        return migrated
      }
    }
    
    // 检查是否有旧格式数据需要迁移
    if (hasLegacyData()) {
      console.log('[DataService] 检测到旧格式数据，开始迁移')
      const migrated = migrateFromLegacyFormat()
      save(migrated)
      cleanupLegacyStorage()
      return migrated
    }
    
    // 没有数据，返回默认值
    const defaultData = createDefaultAppData()
    save(defaultData)
    return defaultData
    
  } catch (error) {
    console.error('[DataService] 加载数据失败:', error)
    return createDefaultAppData()
  }
}

/**
 * 保存数据到 localStorage
 */
export function save(data: AppData): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const toSave: AppData = {
      ...data,
      lastUpdated: new Date().toISOString(),
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    return true
  } catch (error) {
    console.error('[DataService] 保存数据失败:', error)
    
    // 检查是否是配额超限
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[DataService] localStorage 配额已满，请导出数据后清理')
    }
    
    // 派发保存失败事件，UI 层可监听并通知用户
    window.dispatchEvent(new CustomEvent('save-error', { detail: { error } }))
    
    return false
  }
}

// ============ 导出功能 ============

/**
 * 导出数据为 JSON 字符串
 * @param includeApiKey 是否包含 API Key（默认不包含）
 */
export function exportToJson(includeApiKey: boolean = false): string {
  const data = load()
  
  const exportData: AppData = {
    ...data,
    version: CURRENT_VERSION,
    lastUpdated: new Date().toISOString(),
  }
  
  // 默认不导出 API Key
  if (!includeApiKey) {
    exportData.config = {
      ...exportData.config,
      api: {
        ...exportData.config.api,
        apiKey: '',
      },
      vision: {
        ...exportData.config.vision,
        apiKey: '',
      },
      onlineSearch: {
        ...exportData.config.onlineSearch,
        apiKey: '',
      },
    }
  }
  
  return JSON.stringify(exportData, null, 2)
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `wechatbot-backup-${date}.json`
}

/**
 * 触发文件下载
 */
export function downloadExport(includeApiKey: boolean = false): void {
  const json = exportToJson(includeApiKey)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = generateExportFilename()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============ 导入功能 ============

/**
 * 从 JSON 字符串导入数据
 */
export function importFromJson(json: string): ImportResult {
  try {
    // 解析 JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return { success: false, message: '无效的 JSON 格式', error: 'JSON_PARSE_ERROR' }
    }
    
    // 验证数据结构
    const validation = validateAppData(parsed)
    if (!validation.valid) {
      // 尝试迁移修复
      const migrated = migrate(parsed)
      const revalidation = validateAppData(migrated)
      
      if (!revalidation.valid) {
        return { 
          success: false, 
          message: `数据验证失败: ${revalidation.errors.slice(0, 3).join(', ')}`,
          error: 'VALIDATION_ERROR',
        }
      }
      
      // 迁移成功，保存数据
      save(migrated)
      return createImportResult(migrated, '数据已迁移并导入')
    }
    
    // 检查版本并迁移
    const data = parsed as AppData
    let finalData = data
    
    if (needsMigration(data.version)) {
      finalData = migrate(data)
    }
    
    // 保存数据
    save(finalData)
    
    return createImportResult(finalData, '导入成功')
    
  } catch (error) {
    console.error('[DataService] 导入失败:', error)
    return { 
      success: false, 
      message: '导入过程中发生错误',
      error: String(error),
    }
  }
}

/**
 * 创建导入结果
 */
function createImportResult(data: AppData, message: string): ImportResult {
  const messageCount = data.personas.reduce((sum, p) => sum + (p.messages?.length || 0), 0)
  
  return {
    success: true,
    message,
    stats: {
      personaCount: data.personas.length,
      messageCount,
      memoryCount: data.memories.core.length,
      emojiCount: data.customEmojis.length,
    },
  }
}

// ============ 存储统计 ============

/**
 * 获取存储统计信息
 */
export function getStorageStats(): StorageStats {
  const data = load()
  
  // 计算存储大小
  let totalSize = 0
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    totalSize = raw ? new Blob([raw]).size : 0
  } catch {
    totalSize = 0
  }
  
  // 计算消息总数
  const messageCount = data.personas.reduce((sum, p) => sum + (p.messages?.length || 0), 0)
  
  return {
    totalSize,
    personaCount: data.personas.length,
    messageCount,
    memoryCount: data.memories.core.length,
    emojiCount: data.customEmojis.length,
    version: data.version,
  }
}

/**
 * 格式化存储大小
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ============ 清除数据 ============

/**
 * 清除所有数据并重置为默认状态
 */
export function clearAll(): void {
  if (typeof window === 'undefined') return
  
  try {
    // 清除新格式数据
    localStorage.removeItem(STORAGE_KEY)
    
    // 清除旧格式数据
    cleanupLegacyStorage()
    
    // 保存默认数据
    save(createDefaultAppData())
    
    console.log('[DataService] 数据已清除')
  } catch (error) {
    console.error('[DataService] 清除数据失败:', error)
  }
}

// ============ 导出单例 ============

export const dataService = {
  load,
  save,
  exportToJson,
  generateExportFilename,
  downloadExport,
  importFromJson,
  getStorageStats,
  formatStorageSize,
  clearAll,
}

export default dataService
