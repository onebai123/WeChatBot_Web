'use client'

import { useState } from 'react'
import { Settings, User, ChevronDown, ChevronLeft, Upload, Download, Palette, MoreHorizontal, FileText, Lock, HelpCircle, Eraser, Trash2, RotateCcw, MessageSquareX, Smartphone, Monitor, Check, Brain, Search, FileDown } from 'lucide-react'
import { usePersonaStore } from '@/store/personaStore'
import { useConfigStore } from '@/store/configStore'
import { useThemeStore } from '@/store/themeStore'
import { themes } from '@/themes'
import { Avatar } from '@/components/common/Avatar'
import { MODEL_OPTIONS, getModelDisplayText } from '@/lib/constants'

interface ChatHeaderProps {
  title: string
  onOpenPersona: () => void
  onOpenSettings: () => void
  onOpenImport?: () => void
  onOpenExport?: () => void
  onOrganizeMemory?: () => void
  onOpenMemory?: () => void
  onOpenSearch?: () => void
  onExportChat?: (format: 'txt' | 'md') => void
  onClearScreen?: () => void
  onClearTempMemory?: () => void
  onClearCoreMemory?: () => void
  onReset?: () => void
  onOpenLogs?: () => void
  onLock?: () => void
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export function ChatHeader({
  title,
  onOpenPersona,
  onOpenSettings,
  onOpenImport,
  onOpenExport,
  onOrganizeMemory,
  onOpenMemory,
  onOpenSearch,
  onExportChat,
  onClearScreen,
  onClearTempMemory,
  onClearCoreMemory,
  onReset,
  onOpenLogs,
  onLock,
  onMenuClick,
  showMenuButton,
}: ChatHeaderProps) {
  const { personas, activePersonaId } = usePersonaStore()
  const { gptConfig, userInfo } = useConfigStore()
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showClearMenu, setShowClearMenu] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const { theme, setTheme } = useThemeStore()
  const { phoneMode, setPhoneMode } = useConfigStore()

  const hasClearOptions = onClearScreen || onClearTempMemory || onClearCoreMemory || onReset

  const activePersona = personas.find((p) => p.id === activePersonaId)
  const displayTitle = activePersona?.name || title

  return (
    <header className="bg-[var(--theme-header-bg)] border-b border-[var(--theme-border)] flex-shrink-0 z-10">
      {/* 手机端布局 - 标题居中 (< 640px) */}
      <div className="flex sm:hidden items-center h-12 px-3 relative">
        {/* 左侧返回按钮 */}
        {showMenuButton && (
          <button onClick={onMenuClick} className="absolute left-2 p-1">
            <ChevronLeft className="w-6 h-6 text-[var(--theme-text-primary)]" />
          </button>
        )}
        
        {/* 居中标题 */}
        <div className="flex-1 text-center">
          <h1 className="font-medium text-[var(--theme-text-primary)] text-[17px] truncate px-10">{displayTitle}</h1>
        </div>
        
        {/* 右侧更多按钮 */}
        <button onClick={() => setShowMore(!showMore)} className="absolute right-2 p-1">
          <MoreHorizontal className="w-6 h-6 text-[var(--theme-text-primary)]" />
        </button>

        {/* 更多菜单 - 图标块网格 */}
        {showMore && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowMore(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--theme-chat-bg)] rounded-t-2xl p-4 pb-8 animate-slide-up">
              <div className="w-10 h-1 bg-[var(--theme-border)] rounded-full mx-auto mb-4" />
              <div className="grid grid-cols-4 gap-4">
                {/* 1. 教程 */}
                <button onClick={() => { window.open('https://ai.feishu.cn/wiki/DDh6waPHoiHd7WkvQqOclLNUn34', '_blank'); setShowMore(false); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                    <HelpCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-[var(--theme-text-secondary)]">教程</span>
                </button>
                {/* 2. 人设 */}
                <button onClick={() => { onOpenPersona(); setShowMore(false); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-[var(--theme-text-secondary)]">人设</span>
                </button>
                {/* 3. 导入 */}
                {onOpenImport && (
                  <button onClick={() => { onOpenImport(); setShowMore(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-[var(--theme-text-secondary)]">导入</span>
                  </button>
                )}
                {/* 4. 设置 */}
                <button onClick={() => { onOpenSettings(); setShowMore(false); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                  <div className="w-12 h-12 rounded-xl bg-[var(--theme-text-muted)] flex items-center justify-center">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-[var(--theme-text-secondary)]">设置</span>
                </button>
                {/* 5. 主题 */}
                <button onClick={() => { setShowThemeMenu(true); setShowMore(false); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                    <Palette className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-[var(--theme-text-secondary)]">主题</span>
                </button>
                {/* 6. 搜索 */}
                {onOpenSearch && (
                  <button onClick={() => { onOpenSearch(); setShowMore(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-[var(--theme-text-secondary)]">搜索</span>
                  </button>
                )}
                {/* 7. 导出聊天 */}
                {onExportChat && (
                  <button onClick={() => { setShowExportMenu(true); setShowMore(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                    <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center">
                      <FileDown className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-[var(--theme-text-secondary)]">导出</span>
                  </button>
                )}
                {/* 8. 记忆 */}
                {onOpenMemory && (
                  <button onClick={() => { onOpenMemory(); setShowMore(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                    <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-[var(--theme-text-secondary)]">记忆</span>
                  </button>
                )}
                {/* 7. 清理 */}
                {hasClearOptions && (
                  <button onClick={() => { setShowClearMenu(true); setShowMore(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                    <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                      <Eraser className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-[var(--theme-text-secondary)]">清理</span>
                  </button>
                )}
                {/* 7. 日志 */}
                {onOpenLogs && (
                  <button onClick={() => { onOpenLogs(); setShowMore(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                    <div className="w-12 h-12 rounded-xl bg-slate-500 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-[var(--theme-text-secondary)]">日志</span>
                  </button>
                )}
                {/* 7. 锁屏 */}
                {onLock && (
                  <button onClick={() => { onLock(); setShowMore(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[var(--theme-border)]/50 active:bg-[var(--theme-border)]">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-[var(--theme-text-secondary)]">锁屏</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* PC端布局 */}
      <div className="hidden sm:flex items-center justify-between px-4 py-3">
        {/* 左侧：头像 + 标题 */}
        <div className="flex items-center gap-3">
          <Avatar 
            name={activePersona?.name || '?'} 
            size="lg" 
            src={activePersona?.avatar} 
          />
          <div>
            <h1 className="font-medium text-[var(--theme-text-primary)]">{displayTitle}</h1>
            <button onClick={onOpenPersona}
              className="text-xs text-[var(--theme-primary)] hover:underline">点击选择人设</button>
          </div>
        </div>

        {/* 右侧：工具按钮 */}
        <div className="flex items-center gap-0.5">
          {onOpenImport && (
            <button onClick={onOpenImport} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
              <Upload className="w-4 h-4 text-[var(--theme-text-secondary)]" />
              <span className="text-[10px] text-[var(--theme-text-muted)]">导入</span>
            </button>
          )}
          {onOpenSearch && (
            <button onClick={onOpenSearch} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
              <Search className="w-4 h-4 text-cyan-500" />
              <span className="text-[10px] text-[var(--theme-text-muted)]">搜索</span>
            </button>
          )}
          {onExportChat && (
            <button onClick={() => setShowExportMenu(true)} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
              <FileDown className="w-4 h-4 text-teal-500" />
              <span className="text-[10px] text-[var(--theme-text-muted)]">导出</span>
            </button>
          )}
          {onOpenMemory && (
            <button onClick={onOpenMemory} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="text-[10px] text-[var(--theme-text-muted)]">记忆</span>
            </button>
          )}
          <button onClick={() => setShowThemeMenu(true)} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
            <Palette className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] text-[var(--theme-text-muted)]">主题</span>
          </button>
          {hasClearOptions && (
            <div className="relative">  
              <button onClick={() => setShowClearMenu(!showClearMenu)} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
                <Eraser className="w-4 h-4 text-red-500" />
                <span className="text-[10px] text-[var(--theme-text-muted)]">清理</span>
              </button>
            </div>
          )}
          {onOpenLogs && (
            <button onClick={onOpenLogs} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
              <FileText className="w-4 h-4 text-[var(--theme-text-secondary)]" />
              <span className="text-[10px] text-[var(--theme-text-muted)]">日志</span>
            </button>
          )}
          {onLock && (
            <button onClick={onLock} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
              <Lock className="w-4 h-4 text-[var(--theme-text-secondary)]" />
              <span className="text-[10px] text-[var(--theme-text-muted)]">锁屏</span>
            </button>
          )}
          <button 
            onClick={() => window.open('https://ai.feishu.cn/wiki/DDh6waPHoiHd7WkvQqOclLNUn34', '_blank')}
            className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded"
          >
            <HelpCircle className="w-4 h-4 text-[var(--theme-text-secondary)]" />
            <span className="text-[10px] text-[var(--theme-text-muted)]">教程</span>
          </button>

          {/* 模型选择器 */}
          <div className="relative mx-1">
            <button onClick={() => setShowModelSelect(!showModelSelect)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 rounded">
              <span className="text-xs max-w-[100px] truncate">{getModelDisplayText(gptConfig.model)}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showModelSelect && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModelSelect(false)} />
                <div className="absolute right-0 top-full mt-1 bg-[var(--theme-chat-bg)] rounded shadow-lg border border-[var(--theme-border)] py-1 min-w-[200px] max-h-[300px] overflow-y-auto z-50">
                  {MODEL_OPTIONS.map((m) => (
                    <button key={m.value} onClick={() => {
                      useConfigStore.getState().setGptConfig({ model: m.value })
                      setShowModelSelect(false)
                    }} className={`w-full px-3 py-1.5 text-xs text-left text-[var(--theme-text-primary)] hover:bg-[var(--theme-border)]/50 ${gptConfig.model === m.value ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' : ''}`}>{m.text}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={onOpenSettings} className="flex flex-col items-center px-2 py-1 hover:bg-[var(--theme-border)]/50 rounded">
            <Settings className="w-4 h-4 text-[var(--theme-text-secondary)]" />
            <span className="text-[10px] text-[var(--theme-text-muted)]">设置</span>
          </button>
        </div>
      </div>

      {/* 清理菜单弹窗 */}
      {showClearMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowClearMenu(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--theme-chat-bg)] rounded-2xl p-5 w-[280px] shadow-xl border border-[var(--theme-border)]">
            <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-4 text-center">清理选项</h3>
            <div className="space-y-2">
              {onClearScreen && (
                <button
                  onClick={() => { onClearScreen(); setShowClearMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                    <MessageSquareX className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-[var(--theme-text-primary)]">清屏</div>
                    <div className="text-xs text-[var(--theme-text-muted)]">清除当前聊天记录</div>
                  </div>
                </button>
              )}
              {onClearTempMemory && (
                <button
                  onClick={() => { onClearTempMemory(); setShowClearMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
                    <Eraser className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-[var(--theme-text-primary)]">清理临时记忆</div>
                    <div className="text-xs text-[var(--theme-text-muted)]">清除对话日志缓存</div>
                  </div>
                </button>
              )}
              {onClearCoreMemory && (
                <button
                  onClick={() => { onClearCoreMemory(); setShowClearMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-[var(--theme-text-primary)]">清理核心记忆</div>
                    <div className="text-xs text-[var(--theme-text-muted)]">清除 AI 长期记忆</div>
                  </div>
                </button>
              )}
              {onReset && (
                <button
                  onClick={() => { onReset(); setShowClearMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-red-500">初始化</div>
                    <div className="text-xs text-[var(--theme-text-muted)]">重置所有数据</div>
                  </div>
                </button>
              )}
            </div>
            <button
              onClick={() => setShowClearMenu(false)}
              className="w-full mt-4 py-2 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </>
      )}

      {/* 主题切换弹窗 */}
      {showThemeMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowThemeMenu(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--theme-chat-bg)] rounded-2xl p-5 w-[320px] shadow-xl border border-[var(--theme-border)]">
            <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-4 text-center">主题设置</h3>
            
            {/* 手机模式开关 */}
            <div className="flex items-center justify-between p-3 bg-[var(--theme-sidebar-bg)] rounded-xl mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[var(--theme-primary)]" />
                <span className="text-sm text-[var(--theme-text-primary)]">手机模式</span>
              </div>
              <button
                onClick={() => setPhoneMode(!phoneMode)}
                className={`w-12 h-6 rounded-full transition-colors ${phoneMode ? 'bg-[var(--theme-primary)]' : 'bg-[var(--theme-border)]'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${phoneMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            
            {/* 主题列表 */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(themes).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => { setTheme(key); setShowThemeMenu(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    theme.name === t.name ? 'bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]' : 'hover:bg-[var(--theme-border)]/50'
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: t.colors.primary }}
                  >
                    <Palette className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-[var(--theme-text-primary)] flex-1 text-left">{t.name}</span>
                  {theme.name === t.name && <Check className="w-4 h-4 text-[var(--theme-primary)]" />}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowThemeMenu(false)}
              className="w-full mt-4 py-2 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </>
      )}
      {/* 导出聊天格式选择弹窗 */}
      {showExportMenu && onExportChat && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowExportMenu(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--theme-chat-bg)] rounded-2xl p-5 w-[280px] shadow-xl border border-[var(--theme-border)]">
            <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-4 text-center">导出聊天记录</h3>
            <div className="space-y-2">
              <button
                onClick={() => { onExportChat('txt'); setShowExportMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--theme-text-primary)]">纯文本 (.txt)</div>
                  <div className="text-xs text-[var(--theme-text-muted)]">简洁格式，方便阅读</div>
                </div>
              </button>
              <button
                onClick={() => { onExportChat('md'); setShowExportMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                  <FileDown className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--theme-text-primary)]">Markdown (.md)</div>
                  <div className="text-xs text-[var(--theme-text-muted)]">富格式，支持引用和粗体</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowExportMenu(false)}
              className="w-full mt-4 py-2 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </>
      )}
    </header>
  )
}
