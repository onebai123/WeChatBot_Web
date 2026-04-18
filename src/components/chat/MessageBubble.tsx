'use client'

import { useState, useRef } from 'react'
import { User, MoreHorizontal, RotateCcw, Bot, Play, Pause, Reply, Copy, Check } from 'lucide-react'
import type { Message } from '@/types'
import { cn } from '@/lib/utils'
import { usePersonaStore } from '@/store/personaStore'
import { useConfigStore } from '@/store/configStore'
import { useThemeStore } from '@/store/themeStore'
import { useBlobUrl } from '@/hooks/useBlobUrl'

// 语音消息组件
function VoiceMessage({ audio, duration, isUser }: { audio: string; duration: number; isUser: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }
  
  const handleEnded = () => setIsPlaying(false)
  
  // 根据时长计算宽度（2秒=80px，60秒=200px）
  const width = Math.min(200, Math.max(80, 80 + (duration - 2) * 3))
  
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer',
        isUser
          ? 'bg-[var(--theme-bubble-user)] text-[var(--theme-bubble-user-text)]'
          : 'bg-[var(--theme-bubble-ai)] text-[var(--theme-bubble-ai-text)]'
      )}
      style={{ width }}
      onClick={togglePlay}
    >
      <audio ref={audioRef} src={audio} onEnded={handleEnded} />
      {isPlaying ? (
        <Pause className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Play className="w-4 h-4 flex-shrink-0" />
      )}
      {/* 语音波形动画 */}
      <div className="flex-1 flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'w-0.5 rounded-full transition-all',
              isPlaying ? 'animate-pulse' : '',
              isUser ? 'bg-white/60' : 'bg-black/30'
            )}
            style={{ height: `${8 + Math.random() * 8}px` }}
          />
        ))}
      </div>
      <span className="text-xs opacity-70">{duration}&quot;</span>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  personaId: string
  onTickle?: (target: 'ai' | 'user') => void
  onClearMemory?: () => void
  onReply?: (message: Message) => void
  searchQuery?: string
  isSearchMatch?: boolean
}

export function MessageBubble({ message, personaId, onTickle, onClearMemory, onReply, searchQuery, isSearchMatch }: MessageBubbleProps) {
  const { recallMessage, personas } = usePersonaStore()
  const { userInfo } = useConfigStore()
  const { theme } = useThemeStore()
  const [showMenu, setShowMenu] = useState(false)
  const isUser = message.inversion
  const showArrow = theme.style.bubbleArrow

  // 解析 blob 引用（IndexedDB 存储的图片/语音/头像）
  const resolvedImage = useBlobUrl(message.image)
  const resolvedAudio = useBlobUrl(message.audio)
  
  // 获取当前人设
  const persona = personas.find(p => p.id === personaId)
  const resolvedPersonaAvatar = useBlobUrl(persona?.avatar)
  const resolvedUserAvatar = useBlobUrl(userInfo.avatar)

  // 处理记忆整理分隔线
  if (message.isMemoryDivider) {
    return (
      <div className="w-full my-4 px-4">
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--theme-text-muted)]">
          <div className="flex-1 h-px bg-[var(--theme-border)]" />
          <span className="px-3 py-1 bg-[var(--theme-sidebar-bg)] rounded-full whitespace-nowrap">
            📝 记忆已整理 · {message.dateTime}
          </span>
          <div className="flex-1 h-px bg-[var(--theme-border)]" />
        </div>
        <p className="text-center text-xs text-[var(--theme-text-muted)] mt-1">{message.text}</p>
      </div>
    )
  }

  // 处理拍一拍消息
  if (message.isTickle) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-[var(--theme-text-muted)] bg-[var(--theme-sidebar-bg)] px-3 py-1 rounded-full">
          👉 {message.text}
        </span>
      </div>
    )
  }

  // 处理撤回消息
  if (message.isRecalled) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-[var(--theme-text-muted)]">{isUser ? '你' : '对方'}撤回了一条消息</span>
      </div>
    )
  }

  // 处理加载状态
  if (message.loading) {
    return (
      <div className="flex items-start gap-3 px-4 py-2 message-bubble">
        <div 
          className="w-[42px] h-[42px] bg-[var(--theme-avatar-ai)] flex items-center justify-center flex-shrink-0"
          style={{ borderRadius: 'var(--theme-radius-avatar)' }}
        >
          {resolvedPersonaAvatar ? (
            <img src={resolvedPersonaAvatar} alt="ai-avatar" className="w-full h-full object-cover" style={{ borderRadius: 'var(--theme-radius-avatar)' }} />
          ) : (
            <span className="text-white font-medium text-lg">{persona?.name?.[0] || '?'}</span>
          )}
        </div>
        <div 
          className="max-w-[70%] bg-[var(--theme-bubble-ai)] px-4 py-3"
          style={{ borderRadius: 'var(--theme-radius-bubble)' }}
        >
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-[var(--theme-text-muted)] rounded-full typing-dot" />
            <div className="w-2 h-2 bg-[var(--theme-text-muted)] rounded-full typing-dot" />
            <div className="w-2 h-2 bg-[var(--theme-text-muted)] rounded-full typing-dot" />
          </div>
        </div>
      </div>
    )
  }

  const [copied, setCopied] = useState(false)

  const handleRecall = () => {
    if (isUser) {
      recallMessage(personaId, message.id)
    }
    setShowMenu(false)
  }

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    setShowMenu(false)
  }

  const handleReply = () => {
    onReply?.(message)
    setShowMenu(false)
  }

  // 高亮搜索匹配文本
  const highlightText = (text: string) => {
    if (!searchQuery) return text
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5">{part}</mark> : part
    )
  }

  // 解析消息，处理换行符 \
  const renderText = (text: string) => {
    const parts = text.split(/\\+n?/)
    return parts.map((part, index) => (
      <span key={index}>
        {highlightText(part.trim())}
        {index < parts.length - 1 && <br />}
      </span>
    ))
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-3 py-1.5 message-bubble group transition-colors',
        isUser ? 'flex-row-reverse' : 'flex-row',
        isSearchMatch && 'bg-yellow-100/50 dark:bg-yellow-900/20'
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          'w-[42px] h-[42px] flex items-center justify-center flex-shrink-0 overflow-hidden',
          isUser ? 'bg-[var(--theme-avatar-user)]' : 'bg-[var(--theme-avatar-ai)]',
          onTickle && 'cursor-pointer active:scale-95 transition-transform'
        )}
        style={{ borderRadius: 'var(--theme-radius-avatar)' }}
        onClick={() => onTickle?.(isUser ? 'user' : 'ai')}
        title={isUser ? '拍自己' : '拍一拍'}
      >
        {isUser ? (
          resolvedUserAvatar ? (
            <img src={resolvedUserAvatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-white" />
          )
        ) : resolvedPersonaAvatar ? (
          <img src={resolvedPersonaAvatar} alt="ai-avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-medium text-lg">{persona?.name?.[0] || '?'}</span>
        )}
      </div>

      {/* 消息内容 */}
      <div className="relative max-w-[70%]">
        {/* 引用回复气泡 */}
        {message.replyTo && (
          <div className={cn(
            'mb-1 px-3 py-1.5 rounded-lg text-xs border-l-2 cursor-pointer hover:opacity-80',
            'bg-[var(--theme-border)]/30 border-[var(--theme-text-muted)]/50 text-[var(--theme-text-muted)]'
          )}>
            <span className="font-medium text-[var(--theme-text-secondary)]">
              {message.replyTo.isUser ? '你' : persona?.name || 'AI'}
            </span>
            <p className="truncate mt-0.5">{message.replyTo.text}</p>
          </div>
        )}
        {/* 语音消息 */}
        {resolvedAudio ? (
          <VoiceMessage audio={resolvedAudio} duration={message.audioDuration || 0} isUser={isUser} />
        ) : /* 纯图片消息 - 不显示气泡背景 */
        resolvedImage && (!message.text || message.text === '[表情]' || message.text === '请看这张图片') ? (
          <img 
            src={resolvedImage} 
            alt="图片" 
            className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(resolvedImage, '_blank')}
          />
        ) : (
          <div
            className={cn(
              'px-3 py-2 relative',
              isUser
                ? 'bg-[var(--theme-bubble-user)] text-[var(--theme-bubble-user-text)]'
                : 'bg-[var(--theme-bubble-ai)] text-[var(--theme-bubble-ai-text)]'
            )}
            style={{ borderRadius: 'var(--theme-radius-bubble)' }}
          >
            {/* 气泡小三角 */}
            {showArrow && (
              <div
                className="absolute top-3 w-0 h-0"
                style={{
                  borderWidth: '6px',
                  borderStyle: 'solid',
                  borderColor: 'transparent',
                  ...(isUser
                    ? { right: -12, borderLeftColor: 'var(--theme-bubble-user)' }
                    : { left: -12, borderRightColor: 'var(--theme-bubble-ai)' })
                }}
              />
            )}
            {/* 图片+文字消息 */}
            {resolvedImage && (
              <div className="mb-2">
                <img 
                  src={resolvedImage} 
                  alt="图片" 
                  className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(resolvedImage, '_blank')}
                />
              </div>
            )}
            {/* 文字消息 */}
            {message.text && message.text !== '[表情]' && message.text !== '请看这张图片' && (
              <div className="text-[17px] leading-[1.4] whitespace-pre-wrap break-words">
                {renderText(message.text)}
              </div>
            )}
            {/* API 错误提示 */}
            {message.error && onClearMemory && (
              <div className="mt-2 pt-2 border-t border-black/5">
                <button
                  onClick={onClearMemory}
                  className="text-xs text-black/30 hover:text-black/50 underline underline-offset-2"
                >
                  报错无法解决？点击清理记忆
                </button>
              </div>
            )}
          </div>
        )}

        {/* 操作菜单 */}
        <div className={cn(
          'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? '-left-8' : '-right-8'
        )}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-[var(--theme-border)]/50 rounded"
          >
            <MoreHorizontal className="w-4 h-4 text-[var(--theme-text-muted)]" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className={cn(
                'absolute top-full mt-1 bg-[var(--theme-chat-bg)] rounded-lg shadow-lg border border-[var(--theme-border)] py-1 z-20 min-w-[100px]',
                isUser ? 'right-0' : 'left-0'
              )}>
                {onReply && (
                  <button
                    onClick={handleReply}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 w-full"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    回复
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 w-full"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '已复制' : '复制'}
                </button>
                {isUser && (
                  <button
                    onClick={handleRecall}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 w-full"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    撤回
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* 时间戳 - 默认隐藏，hover 显示 */}
        <div className={cn(
          'text-[11px] text-[var(--theme-text-muted)] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'text-right' : 'text-left'
        )}>
          {message.dateTime}
        </div>
      </div>
    </div>
  )
}
