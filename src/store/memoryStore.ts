import { create } from 'zustand'
import type { AppMemories, CoreMemoryV2, TempMemoryV2 } from '@/types/appData'

const MAX_CORE_MEMORIES = 50
const MAX_TEMP_LOGS = 60

import type { TempMemoryLog } from '@/types'

interface MemoryState {
  // 核心记忆
  coreMemories: CoreMemoryV2[]
  // 临时记忆（对话日志）
  tempMemories: Record<string, TempMemoryV2>  // personaId -> TempMemory
  
  // 核心记忆操作
  addCoreMemory: (memory: Omit<CoreMemoryV2, 'id' | 'createdAt'>) => string
  updateCoreMemory: (id: string, update: Partial<CoreMemoryV2>) => void
  deleteCoreMemory: (id: string) => void
  getCoreMemoriesByPersonaId: (personaId: string) => CoreMemoryV2[]
  getCoreMemoriesByCategory: (category: CoreMemoryV2['category']) => CoreMemoryV2[]
  getTopCoreMemories: (personaId: string, limit?: number) => CoreMemoryV2[]
  cleanupCoreMemories: (personaId: string) => void
  
  // 临时记忆操作
  addTempLog: (personaId: string, log: Omit<TempMemoryLog, 'timestamp'>) => void
  getTempLogs: (personaId: string) => TempMemoryLog[]
  deleteTempLog: (personaId: string, index: number) => void
  clearTempLogs: (personaId: string) => void
  
  // 评分计算
  calculateScore: (memory: CoreMemoryV2) => number
  
  // 数据同步
  setMemories: (memories: AppMemories) => void
}

const generateId = () => `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

/** 计算记忆评分: score = 0.6 * importance - 0.4 * hours_since_created */
const calcScore = (memory: CoreMemoryV2): number => {
  const hoursSinceCreated = (Date.now() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60)
  return 0.6 * memory.importance - 0.4 * hoursSinceCreated
}

export const useMemoryStore = create<MemoryState>()((set, get) => ({
  coreMemories: [],
  tempMemories: {},

  addCoreMemory: (memory) => {
    const id = generateId()
    const newMemory: CoreMemoryV2 = { ...memory, id, createdAt: new Date().toISOString() }
    set((state) => ({ coreMemories: [...state.coreMemories, newMemory] }))
    get().cleanupCoreMemories(memory.personaId)
    return id
  },

  updateCoreMemory: (id, update) => {
    set((state) => ({
      coreMemories: state.coreMemories.map((m) => m.id === id ? { ...m, ...update } : m),
    }))
  },

  deleteCoreMemory: (id) => {
    set((state) => ({ coreMemories: state.coreMemories.filter((m) => m.id !== id) }))
  },

  getCoreMemoriesByPersonaId: (personaId) => get().coreMemories.filter((m) => m.personaId === personaId),

  getCoreMemoriesByCategory: (category) => get().coreMemories.filter((m) => m.category === category),

  getTopCoreMemories: (personaId, limit = MAX_CORE_MEMORIES) => {
    const memories = get().coreMemories.filter((m) => m.personaId === personaId)
    return [...memories].sort((a, b) => calcScore(b) - calcScore(a)).slice(0, limit)
  },

  cleanupCoreMemories: (personaId) => {
    set((state) => {
      const personaMemories = state.coreMemories.filter((m) => m.personaId === personaId)
      const otherMemories = state.coreMemories.filter((m) => m.personaId !== personaId)
      if (personaMemories.length <= MAX_CORE_MEMORIES) return state
      const sorted = [...personaMemories].sort((a, b) => calcScore(b) - calcScore(a))
      return { coreMemories: [...otherMemories, ...sorted.slice(0, MAX_CORE_MEMORIES)] }
    })
  },

  addTempLog: (personaId, log) => {
    const timestamp = new Date().toLocaleString('zh-CN')
    const newLog = { ...log, timestamp }
    set((state) => {
      const existing = state.tempMemories[personaId] || { personaId, logs: [], lastUpdated: '' }
      const logs = [...existing.logs, newLog].slice(-MAX_TEMP_LOGS)
      return {
        tempMemories: {
          ...state.tempMemories,
          [personaId]: { personaId, logs, lastUpdated: new Date().toISOString() }
        }
      }
    })
  },

  getTempLogs: (personaId) => get().tempMemories[personaId]?.logs || [],

  deleteTempLog: (personaId, index) => {
    set((state) => {
      const existing = state.tempMemories[personaId]
      if (!existing) return state
      const logs = existing.logs.filter((_, i) => i !== index)
      return {
        tempMemories: {
          ...state.tempMemories,
          [personaId]: { ...existing, logs, lastUpdated: new Date().toISOString() }
        }
      }
    })
  },

  clearTempLogs: (personaId) => {
    set((state) => {
      const { [personaId]: _, ...rest } = state.tempMemories
      return { tempMemories: rest }
    })
  },

  calculateScore: calcScore,

  // 数据同步
  setMemories: (memories) => set({
    coreMemories: memories.core,
    tempMemories: memories.temp,
  }),
}))
