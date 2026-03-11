'use client'

import { useState } from 'react'
import { X, FileJson, FileText, Check, Key } from 'lucide-react'
import { usePersonaStore } from '@/store/personaStore'
import { downloadExport, getStorageStats, formatStorageSize } from '@/lib/dataService'

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const { personas } = usePersonaStore()
  const [includeApiKey, setIncludeApiKey] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const stats = getStorageStats()

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleExport = async () => {
    await downloadExport(includeApiKey)
    showMessage('success', '数据已导出')
  }

  // 导出人设为 Markdown
  const handleExportPersonasMd = () => {
    personas.forEach((persona) => {
      const blob = new Blob([persona.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${persona.name}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
    showMessage('success', `已导出 ${personas.length} 个人设文件`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative bg-[var(--theme-chat-bg)] rounded-xl shadow-xl w-[450px] max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border)]">
          <h2 className="text-lg font-semibold text-[var(--theme-text-primary)]">导出数据</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--theme-border)]/50 rounded">
            <X className="w-5 h-5 text-[var(--theme-text-secondary)]" />
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mx-6 mt-4 px-3 py-2 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 存储统计 */}
          <div className="p-4 rounded-lg bg-[var(--theme-sidebar-bg)] space-y-2">
            <div className="text-sm font-medium text-[var(--theme-text-primary)]">数据统计</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--theme-text-secondary)]">
              <div>人设数量: {stats.personaCount}</div>
              <div>消息数量: {stats.messageCount}</div>
              <div>记忆数量: {stats.memoryCount}</div>
              <div>表情数量: {stats.emojiCount}</div>
              <div>存储大小: {formatStorageSize(stats.totalSize)}</div>
              <div>数据版本: {stats.version}</div>
            </div>
          </div>

          {/* API Key 选项 */}
          <button
            onClick={() => setIncludeApiKey(!includeApiKey)}
            className={`w-full p-3 rounded-lg border text-left transition-all ${
              includeApiKey ? 'border-amber-400 bg-amber-50' : 'border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="font-medium text-sm text-[var(--theme-text-primary)]">包含 API Key</div>
                  <div className="text-xs text-[var(--theme-text-muted)]">导出时包含敏感密钥信息</div>
                </div>
              </div>
              {includeApiKey && <Check className="w-5 h-5 text-amber-600" />}
            </div>
          </button>

          {/* 提示 */}
          <div className="p-3 rounded-lg bg-blue-50 text-xs text-blue-700">
            <strong>提示：</strong>导出为 JSON 格式，包含所有人设、消息、配置和记忆数据。
            {!includeApiKey && ' API Key 默认不导出。'}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-[var(--theme-border)] flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm hover:opacity-90 transition-colors flex items-center justify-center gap-2"
          >
            <FileJson className="w-4 h-4" />
            导出 JSON
          </button>
          <button
            onClick={handleExportPersonasMd}
            className="px-4 py-2 border border-[var(--theme-border)] rounded-lg text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 transition-colors flex items-center gap-1"
            title="导出人设为 .md 文件"
          >
            <FileText className="w-4 h-4" />
            导出人设 MD
          </button>
        </div>
      </div>
    </div>
  )
}
