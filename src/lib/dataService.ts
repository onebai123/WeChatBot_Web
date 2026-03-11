/**
 * 统一数据服务
 * 管理所有应用数据的加载、保存、导入、导出
 */

import type { AppData, ImportResult, StorageStats } from '@/types/appData'
import { CURRENT_VERSION, STORAGE_KEY } from '@/types/appData'
import { DEFAULT_APP_DATA, createDefaultAppData } from './defaults'
import { validateAppData, isValidAppData } from './dataValidator'
import { migrate, needsMigration, hasLegacyData, migrateFromLegacyFormat, cleanupLegacyStorage } from './migrationService'
import { saveBlobSync, isBase64Data, isBlobRef, getBlob, clearAllBlobs } from './blobStore'

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

    // 将 base64 大数据转存到 IndexedDB，localStorage 只保存引用
    // saveBlobSync 同步返回确定性 key（同一份数据永远同一个 key），IndexedDB 后台写入
    if (toSave.personas) {
      toSave.personas = toSave.personas.map(persona => {
        const p = { ...persona }
        if (isBase64Data(p.avatar)) {
          p.avatar = saveBlobSync(p.avatar!)
        }
        p.messages = p.messages.map(msg => {
          if (isBase64Data(msg.image) || isBase64Data(msg.audio)) {
            const cleaned = { ...msg }
            if (isBase64Data(cleaned.image)) {
              cleaned.image = saveBlobSync(cleaned.image!)
            }
            if (isBase64Data(cleaned.audio)) {
              cleaned.audio = saveBlobSync(cleaned.audio!)
            }
            return cleaned
          }
          return msg
        })
        return p
      })
    }

    // 处理 config 中的 base64（背景图、头像）
    const ui = toSave.config?.user
    if (ui) {
      if (isBase64Data(ui.backgroundImage)) {
        ui.backgroundImage = saveBlobSync(ui.backgroundImage!)
      }
      if (isBase64Data(ui.avatar)) {
        ui.avatar = saveBlobSync(ui.avatar)
      }
      if (isBase64Data(ui.aiAvatar)) {
        ui.aiAvatar = saveBlobSync(ui.aiAvatar)
      }
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
export async function exportToJson(includeApiKey: boolean = false): Promise<string> {
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
  
  // 还原 blob 引用为 base64（导出包含完整图片/语音）
  await resolveBlobRefs(exportData)
  
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
export async function downloadExport(includeApiKey: boolean = false): Promise<void> {
  const json = await exportToJson(includeApiKey)
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
    
    // 清除 IndexedDB blob 数据
    clearAllBlobs().catch(() => {})
    
    // 保存默认数据
    save(createDefaultAppData())
    
    console.log('[DataService] 数据已清除')
  } catch (error) {
    console.error('[DataService] 清除数据失败:', error)
  }
}

// ============ 导出单例 ============

/**
 * 还原 AppData 中所有 blob 引用为 base64 数据
 */
export async function resolveBlobRefs(data: AppData): Promise<void> {
  const tasks: Promise<void>[] = []

  // 还原消息中的 blob 引用
  for (const persona of data.personas) {
    // persona 头像
    if (isBlobRef(persona.avatar)) {
      const ref = persona.avatar!
      tasks.push(getBlob(ref).then(val => { if (val) persona.avatar = val }))
    }
    for (const msg of persona.messages) {
      if (isBlobRef(msg.image)) {
        const ref = msg.image!
        tasks.push(getBlob(ref).then(val => { if (val) msg.image = val }))
      }
      if (isBlobRef(msg.audio)) {
        const ref = msg.audio!
        tasks.push(getBlob(ref).then(val => { if (val) msg.audio = val }))
      }
    }
  }

  // 还原 config 中的 blob 引用（背景图、头像）
  const ui = data.config?.user
  if (ui) {
    if (isBlobRef(ui.backgroundImage)) {
      const ref = ui.backgroundImage!
      tasks.push(getBlob(ref).then(val => { if (val) ui.backgroundImage = val }))
    }
    if (isBlobRef(ui.avatar)) {
      const ref = ui.avatar
      tasks.push(getBlob(ref).then(val => { if (val) ui.avatar = val }))
    }
    if (isBlobRef(ui.aiAvatar)) {
      const ref = ui.aiAvatar
      tasks.push(getBlob(ref).then(val => { if (val) ui.aiAvatar = val }))
    }
  }

  await Promise.all(tasks)
}

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
