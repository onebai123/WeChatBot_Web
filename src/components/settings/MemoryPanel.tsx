'use client'

import { useState, useMemo } from 'react'
import { X, Brain, Trash2, Edit3, Check, Star, Clock, Tag, Filter, ChevronLeft } from 'lucide-react'
import { useMemoryStore } from '@/store/memoryStore'
import { usePersonaStore } from '@/store/personaStore'
import { cn } from '@/lib/utils'
import type { CoreMemoryV2 } from '@/types/appData'

interface MemoryPanelProps {
  open: boolean
  onClose: () => void
}

const CATEGORY_MAP: Record<CoreMemoryV2['category'], { label: string; emoji: string; color: string }> = {
  user_info: { label: '用户信息', emoji: '👤', color: 'bg-blue-500' },
  event: { label: '事件', emoji: '📅', color: 'bg-green-500' },
  preference: { label: '偏好', emoji: '❤️', color: 'bg-pink-500' },
  other: { label: '其他', emoji: '📝', color: 'bg-gray-500' },
}

const ALL_CATEGORIES: Array<CoreMemoryV2['category'] | 'all'> = ['all', 'user_info', 'event', 'preference', 'other']

export function MemoryPanel({ open, onClose }: MemoryPanelProps) {
  const { coreMemories, updateCoreMemory, deleteCoreMemory, calculateScore, getTempLogs } = useMemoryStore()
  const { activePersonaId, personas } = usePersonaStore()

  const [filterCategory, setFilterCategory] = useState<CoreMemoryV2['category'] | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editImportance, setEditImportance] = useState(3)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const personaName = personas.find(p => p.id === activePersonaId)?.name || 'AI'

  const personaMemories = useMemo(() => {
    if (!activePersonaId) return []
    return coreMemories
      .filter(m => m.personaId === activePersonaId)
      .sort((a, b) => calculateScore(b) - calculateScore(a))
  }, [coreMemories, activePersonaId, calculateScore])

  const filteredMemories = useMemo(() => {
    if (filterCategory === 'all') return personaMemories
    return personaMemories.filter(m => m.category === filterCategory)
  }, [personaMemories, filterCategory])

  const tempLogCount = activePersonaId ? getTempLogs(activePersonaId).length : 0

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: personaMemories.length }
    for (const m of personaMemories) {
      counts[m.category] = (counts[m.category] || 0) + 1
    }
    return counts
  }, [personaMemories])

  const startEdit = (memory: CoreMemoryV2) => {
    setEditingId(memory.id)
    setEditContent(memory.content)
    setEditImportance(memory.importance)
  }

  const saveEdit = () => {
    if (editingId && editContent.trim()) {
      updateCoreMemory(editingId, { content: editContent.trim(), importance: editImportance })
      setEditingId(null)
    }
  }

  const confirmDelete = (id: string) => {
    deleteCoreMemory(id)
    setDeleteConfirmId(null)
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    } catch {
      return iso
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--theme-chat-bg)] w-full h-full sm:w-full sm:max-w-2xl sm:h-[600px] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-[var(--theme-header-bg)] border-b border-[var(--theme-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="sm:hidden p-1">
              <ChevronLeft className="w-5 h-5 text-[var(--theme-text-primary)]" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center shadow-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--theme-text-primary)]">{personaName} 的记忆</h3>
              <p className="text-xs text-[var(--theme-text-muted)]">
                核心记忆 {personaMemories.length} 条 · 临时记忆 {tempLogCount} 条
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hidden sm:block p-2 hover:bg-black/5 rounded-xl transition-colors">
            <X className="w-5 h-5 text-[var(--theme-text-muted)]" />
          </button>
        </div>

        {/* 分类筛选 */}
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--theme-border)] flex-shrink-0 overflow-x-auto">
          <div className="flex gap-2">
            {ALL_CATEGORIES.map(cat => {
              const isAll = cat === 'all'
              const info = isAll ? { label: '全部', emoji: '📋', color: 'bg-[var(--theme-primary)]' } : CATEGORY_MAP[cat]
              const count = categoryCounts[cat] || 0
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    filterCategory === cat
                      ? 'bg-[var(--theme-primary)] text-white shadow-sm'
                      : 'bg-[var(--theme-border)]/50 text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]'
                  )}
                >
                  <span>{info.emoji}</span>
                  <span>{info.label}</span>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px]',
                    filterCategory === cat ? 'bg-white/20' : 'bg-[var(--theme-border)]'
                  )}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 记忆列表 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-0">
          {filteredMemories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--theme-text-muted)]">
              <Brain className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">暂无{filterCategory === 'all' ? '' : CATEGORY_MAP[filterCategory as CoreMemoryV2['category']].label}记忆</p>
              <p className="text-xs mt-1">对话后 AI 会自动生成核心记忆</p>
            </div>
          ) : (
            filteredMemories.map(memory => {
              const catInfo = CATEGORY_MAP[memory.category]
              const score = calculateScore(memory)
              const isEditing = editingId === memory.id
              const isDeleting = deleteConfirmId === memory.id

              return (
                <div
                  key={memory.id}
                  className={cn(
                    'bg-[var(--theme-input-bg)] rounded-xl border border-[var(--theme-border)] overflow-hidden transition-all',
                    isEditing && 'ring-2 ring-[var(--theme-primary)]/30'
                  )}
                >
                  {/* 记忆内容 */}
                  <div className="p-4">
                    {isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--theme-chat-bg)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--theme-text-primary)] outline-none focus:border-[var(--theme-primary)] resize-none"
                        rows={3}
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm text-[var(--theme-text-primary)] leading-relaxed">{memory.content}</p>
                    )}
                  </div>

                  {/* 底部信息栏 */}
                  <div className="px-4 py-2.5 bg-[var(--theme-border)]/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs text-[var(--theme-text-muted)] flex-wrap min-w-0">
                      {/* 分类标签 */}
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px]', catInfo.color)}>
                        {catInfo.emoji} {catInfo.label}
                      </span>
                      {/* 重要度 */}
                      {isEditing ? (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(v => (
                            <button
                              key={v}
                              onClick={() => setEditImportance(v)}
                              className="p-0.5"
                            >
                              <Star className={cn('w-3.5 h-3.5', v <= editImportance ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {memory.importance}
                        </span>
                      )}
                      {/* 时间 */}
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {formatTime(memory.createdAt)}
                      </span>
                      {/* 评分 */}
                      <span className={cn('font-mono', score >= 0 ? 'text-green-500' : 'text-red-400')}>
                        {score >= 0 ? '+' : ''}{score.toFixed(1)}
                      </span>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="保存"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)] rounded-lg transition-colors"
                            title="取消"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : isDeleting ? (
                        <>
                          <button
                            onClick={() => confirmDelete(memory.id)}
                            className="px-2 py-1 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                          >
                            确认删除
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)] rounded-lg transition-colors"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(memory)}
                            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(memory.id)}
                            className="p-1.5 text-[var(--theme-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
