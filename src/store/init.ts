/**
 * Store 初始化模块
 * 负责从 DataService 加载数据并同步到各个 Store
 */

import { dataService } from '@/lib/dataService'
import type { AppData } from '@/types/appData'
import { usePersonaStore } from './personaStore'
import { useConfigStore } from './configStore'
import { useMemoryStore } from './memoryStore'
import { useThemeStore } from './themeStore'
import { useEmojiStore } from './emojiStore'

let initialized = false
let unsubscribers: (() => void)[] = []

/** 从 DataService 加载数据并初始化所有 Store */
export function initializeStores(): void {
  if (initialized) return
  
  const data = dataService.load()
  syncToStores(data)
  initialized = true
  
  console.log('[StoreInit] Stores 初始化完成')
}

/** 将 AppData 同步到各个 Store */
function syncToStores(data: AppData): void {
  usePersonaStore.getState().setPersonas(data.personas)
  
  // 确保 activeId 指向存在的人设，否则选择第一个
  let activeId = data.activePersonaId
  const personaExists = activeId && data.personas.some(p => p.id === activeId)
  if (!personaExists && data.personas.length > 0) {
    activeId = data.personas[0].id
    console.log('[StoreInit] 自动选择第一个人设:', activeId)
  }
  usePersonaStore.getState().setActivePersonaId(activeId)
  
  useConfigStore.getState().setConfig(data.config)
  useMemoryStore.getState().setMemories(data.memories)
  useThemeStore.getState().setCurrentTheme(data.theme)
  useEmojiStore.getState().setEmojis(data.customEmojis)
}

/** 从各个 Store 收集数据 */
export function collectFromStores(): AppData {
  const personaState = usePersonaStore.getState()
  const configState = useConfigStore.getState()
  const memoryState = useMemoryStore.getState()
  const themeState = useThemeStore.getState()
  const emojiState = useEmojiStore.getState()
  
  return {
    version: '2.0.0',
    lastUpdated: new Date().toISOString(),
    personas: personaState.personas,
    activePersonaId: personaState.activePersonaId,
    config: {
      api: configState.apiConfig,
      gpt: configState.gptConfig,
      user: configState.userInfo,
      autoMessage: configState.autoMessageConfig,
      quietTime: configState.quietTimeConfig,
      vision: configState.visionConfig,
      onlineSearch: configState.onlineSearchConfig,
      emoji: configState.emojiConfig,
      phoneMode: configState.phoneMode,
    },
    memories: {
      core: memoryState.coreMemories,
      temp: memoryState.tempMemories,
    },
    theme: themeState.currentTheme,
    customEmojis: emojiState.emojis,
  }
}


/** 保存当前 Store 数据到 DataService */
export function saveToDataService(): void {
  const data = collectFromStores()
  dataService.save(data)
}

/** 立即保存（跳过防抖），供关键操作后调用 */
export function flushSave(): void {
  saveToDataService()
}

/** 设置自动保存（订阅 Store 变化） */
export function setupAutoSave(): void {
  // 清理之前的订阅
  unsubscribers.forEach((unsub) => unsub())
  unsubscribers = []

  // 防抖保存
  let saveTimeout: NodeJS.Timeout | null = null
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => saveToDataService(), 500)
  }

  // 订阅各个 Store 的变化
  unsubscribers.push(
    usePersonaStore.subscribe(debouncedSave),
    useConfigStore.subscribe(debouncedSave),
    useMemoryStore.subscribe(debouncedSave),
    useThemeStore.subscribe(debouncedSave),
    useEmojiStore.subscribe(debouncedSave),
  )

  // 页面关闭/刷新/切后台时立即保存，防止防抖期间数据丢失
  const immediateSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveToDataService()
  }
  const handleVisibilityChange = () => {
    if (document.hidden) immediateSave()
  }
  window.addEventListener('beforeunload', immediateSave)
  window.addEventListener('pagehide', immediateSave)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  unsubscribers.push(
    () => window.removeEventListener('beforeunload', immediateSave),
    () => window.removeEventListener('pagehide', immediateSave),
    () => document.removeEventListener('visibilitychange', handleVisibilityChange),
  )

  console.log('[StoreInit] 自动保存已设置')
}

/** 清理订阅 */
export function cleanup(): void {
  unsubscribers.forEach((unsub) => unsub())
  unsubscribers = []
  initialized = false
}

/** 重新加载数据 */
export function reloadStores(): void {
  const data = dataService.load()
  syncToStores(data)
  console.log('[StoreInit] Stores 已重新加载')
}

export const storeInit = {
  initializeStores,
  setupAutoSave,
  saveToDataService,
  flushSave,
  collectFromStores,
  cleanup,
  reloadStores,
}

export default storeInit
