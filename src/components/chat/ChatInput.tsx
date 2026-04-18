'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Smile, Image as ImageIcon, Mic, Hand, X, MicOff, Reply } from 'lucide-react'
import type { Message } from '@/types'
import { cn } from '@/lib/utils'
import { fileToBase64, compressImage } from '@/lib/vision'

// Web Speech API 类型声明
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

interface ChatInputProps {
  onSend: (message: string, imageBase64?: string) => void
  onSendVoice?: (audioBase64: string, duration: number) => void
  onTickle?: () => void
  disabled?: boolean
  visionEnabled?: boolean
  replyTo?: Message | null
  onCancelReply?: () => void
}

// 表情面板分类
const EMOJI_CATEGORIES = {
  '常用': ['😊', '😂', '🤣', '❤️', '😍', '😒', '👍', '😘', '🙄', '😁', '🤔', '😢', '😭', '😎', '🥺', '😳', '🤗', '😴', '🙃', '😇'],
  '表情': ['😀', '😃', '😄', '😆', '😅', '🤩', '🥰', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤭', '🤫', '🤐', '😐', '😑', '😶', '😏'],
  '动物': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐝'],
  '食物': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍔', '🍟', '🍕', '🌭', '🍿', '🍩', '🍪', '🎂', '🍰', '☕'],
  '手势': ['👋', '🤚', '✋', '🖐️', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '👏'],
}

// 图片表情分类（来自 public/emojis 目录）
const GIF_EMOJIS: Record<string, string[]> = {
  '开心': ['/emojis/happy/1.gif', '/emojis/happy/2.gif', '/emojis/happy/3.gif', '/emojis/happy/4.gif', '/emojis/happy/5.gif'],
  '喜欢': ['/emojis/loved/1.gif', '/emojis/loved/2.gif', '/emojis/loved/3.gif', '/emojis/loved/4.gif'],
  '伤心': ['/emojis/sad/1.gif', '/emojis/sad/2.gif'],
  '生气': ['/emojis/angry/1.gif', '/emojis/angry/2.gif'],
  '惊讶': ['/emojis/surprised/1.gif', '/emojis/surprised/2.gif'],
  '疲惫': ['/emojis/tired/1.gif', '/emojis/tired/2.gif', '/emojis/tired/3.gif', '/emojis/tired/4.gif'],
  '困惑': ['/emojis/confused/1.gif'],
  '闪躲': ['/emojis/evasive/1.gif'],
  '提醒': ['/emojis/reminded/1.gif', '/emojis/reminded/2.gif'],
}

export function ChatInput({ onSend, onSendVoice, onTickle, disabled, visionEnabled, replyTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [emojiCategory, setEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>('常用')
  const [gifCategory, setGifCategory] = useState<keyof typeof GIF_EMOJIS>('开心')
  const [emojiMode, setEmojiMode] = useState<'emoji' | 'gif'>('emoji')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  
  // 检测移动端
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingStartTimeRef = useRef<number>(0)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const insertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji)
    textareaRef.current?.focus()
  }

  const sendGifEmoji = (gifUrl: string) => {
    // 发送 gif 表情作为图片消息
    onSend(`[表情]`, gifUrl)
    setShowEmoji(false)
  }

  // 开始录音
  const startRecording = async () => {
    if (!onSendVoice) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      recordingStartTimeRef.current = Date.now()
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
        if (duration < 1) {
          // 录音太短，不发送
          stream.getTracks().forEach(track => track.stop())
          return
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          onSendVoice(base64, duration)
        }
        reader.readAsDataURL(audioBlob)
        
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      
      // 更新录音时长
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.round((Date.now() - recordingStartTimeRef.current) / 1000))
      }, 100)
      
    } catch (error) {
      console.error('无法访问麦克风:', error)
      alert('无法访问麦克风，请检查权限设置')
    }
  }
  
  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }
  
  // 取消录音
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      audioChunksRef.current = [] // 清空，不发送
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }

  // 旧的语音识别（保留作为备用）
  const toggleVoiceRecording = () => {
    if (onSendVoice) {
      // 使用新的录音功能
      if (isRecording) {
        stopRecording()
      } else {
        startRecording()
      }
      return
    }
    
    // 旧的语音识别逻辑（不再使用，但保留兼容）
    alert('请长按录音按钮发送语音')
  }

  const handleSend = () => {
    const trimmed = message.trim()
    if ((!trimmed && !imagePreview) || disabled) return
    onSend(trimmed || '请看这张图片', imagePreview || undefined)
    setMessage('')
    setImagePreview(null)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const base64 = await fileToBase64(file)
    const compressed = await compressImage(base64)
    setImagePreview(compressed)
    e.target.value = ''
  }

  const clearImage = () => setImagePreview(null)

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  return (
    <div
      className="bg-[var(--theme-header-bg)] border-t border-[var(--theme-border)] p-3 sm:p-4 lg:px-8 lg:py-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {/* 回复预览 */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-[var(--theme-border)]/30 rounded-lg border-l-2 border-[var(--theme-primary)]">
          <Reply className="w-4 h-4 text-[var(--theme-primary)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-[var(--theme-primary)]">
              {replyTo.inversion ? '你' : '对方'}
            </span>
            <p className="text-xs text-[var(--theme-text-muted)] truncate">{replyTo.text}</p>
          </div>
          <button onClick={onCancelReply} className="p-1 hover:bg-[var(--theme-border)]/50 rounded flex-shrink-0">
            <X className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
          </button>
        </div>
      )}

      {/* 图片预览 */}
      {imagePreview && (
        <div className="mb-2 relative inline-block">
          <img src={imagePreview} alt="预览" className="max-h-24 rounded-lg border" />
          <button
            onClick={clearImage}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 表情面板 */}
      {showEmoji && (
        <div className="mb-2 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-xl overflow-hidden">
          {/* 模式切换 */}
          <div className="flex border-b border-[var(--theme-border)]">
            <button
              onClick={() => setEmojiMode('emoji')}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                emojiMode === 'emoji' ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' : 'text-[var(--theme-text-secondary)]'
              )}
            >
              😊 Emoji
            </button>
            <button
              onClick={() => setEmojiMode('gif')}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                emojiMode === 'gif' ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' : 'text-[var(--theme-text-secondary)]'
              )}
            >
              🎬 表情包
            </button>
          </div>
          
          {emojiMode === 'emoji' ? (
            <>
              {/* Emoji 分类标签 */}
              <div className="flex border-b border-[var(--theme-border)] px-2 py-1 gap-1 overflow-x-auto">
                {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setEmojiCategory(cat as keyof typeof EMOJI_CATEGORIES)}
                    className={cn(
                      'px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
                      emojiCategory === cat
                        ? 'bg-[var(--theme-primary)] text-white'
                        : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Emoji 网格 */}
              <div className="grid grid-cols-8 gap-1 p-2 max-h-32 overflow-y-auto">
                {EMOJI_CATEGORIES[emojiCategory].map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => insertEmoji(emoji)}
                    className="w-8 h-8 text-xl hover:bg-[var(--theme-border)]/50 rounded flex items-center justify-center transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* GIF 分类标签 */}
              <div className="flex border-b border-[var(--theme-border)] px-2 py-1 gap-1 overflow-x-auto">
                {Object.keys(GIF_EMOJIS).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setGifCategory(cat as keyof typeof GIF_EMOJIS)}
                    className={cn(
                      'px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
                      gifCategory === cat
                        ? 'bg-[var(--theme-primary)] text-white'
                        : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* GIF 网格 */}
              <div className="grid grid-cols-4 gap-2 p-2 max-h-40 overflow-y-auto">
                {GIF_EMOJIS[gifCategory].map((gif, i) => (
                  <button
                    key={i}
                    onClick={() => sendGifEmoji(gif)}
                    className="hover:scale-105 transition-transform rounded overflow-hidden"
                  >
                    <img src={gif} alt="表情" className="w-full h-16 object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 工具栏：表情 → 图片 → 语音 → 拍一拍 */}
      <div className="flex items-center gap-4 sm:gap-5 mb-2 sm:mb-3">
        {/* 表情 */}
        <button 
          onClick={() => setShowEmoji(!showEmoji)}
          className={cn(
            'p-1.5 sm:p-2 rounded-lg transition-colors',
            showEmoji ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' : 'hover:bg-[var(--theme-border)]/50'
          )} 
          title="表情"
        >
          <Smile className={cn('w-5 h-5 sm:w-6 sm:h-6', !showEmoji && 'text-[var(--theme-text-muted)]')} />
        </button>

        {/* 图片 - 始终显示 */}
        <button
          onClick={() => imageInputRef.current?.click()}
          className="p-1.5 sm:p-2 hover:bg-[var(--theme-border)]/50 rounded-lg transition-colors"
          title="发送图片"
        >
          <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--theme-text-muted)]" />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* 语音 */}
        {isRecording ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-lg animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full animate-ping" />
            <span className="text-sm font-medium">{recordingDuration}&quot;</span>
            <button onClick={stopRecording} className="hover:bg-white/20 rounded p-1" title="发送">
              <Mic className="w-5 h-5" />
            </button>
            <button onClick={cancelRecording} className="hover:bg-white/20 rounded p-1" title="取消">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={toggleVoiceRecording}
            className="p-1.5 sm:p-2 hover:bg-[var(--theme-border)]/50 rounded-lg transition-colors"
            title="点击录音"
          >
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--theme-text-muted)]" />
          </button>
        )}

        {/* 拍一拍 */}
        {onTickle && (
          <button
            onClick={() => onTickle()}
            className="p-1.5 sm:p-2 hover:bg-[var(--theme-border)]/50 rounded-lg transition-colors"
            title="拍一拍"
          >
            <Hand className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--theme-text-muted)]" />
          </button>
        )}
      </div>

      {/* 输入框 */}
      <div className="flex items-start gap-2">
        <div
          className="flex-1 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] overflow-hidden"
          style={{ borderRadius: 'var(--theme-radius-input)' }}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={disabled}
            className={cn(
              'w-full px-3 py-2 sm:px-4 sm:py-2 resize-none outline-none text-sm sm:text-base bg-transparent',
              'text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)]',
              'h-10 sm:min-h-[4.5rem] sm:h-auto',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            rows={1}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={(!message.trim() && !imagePreview) || disabled}
          className={cn(
            'px-3 sm:px-4 flex items-center justify-center gap-1 transition-all flex-shrink-0 self-stretch',
            (message.trim() || imagePreview) && !disabled
              ? 'bg-[var(--theme-send-button)] text-[var(--theme-send-button-text)] hover:opacity-90'
              : 'bg-[var(--theme-border)] text-[var(--theme-text-muted)] cursor-not-allowed'
          )}
          style={{ borderRadius: 'var(--theme-radius-button)' }}
        >
          <Send className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">发送</span>
        </button>
      </div>
    </div>
  )
}
