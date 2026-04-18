'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useConfigStore } from '@/store/configStore'
import { usePersonaStore } from '@/store/personaStore'
import { useMemoryStore } from '@/store/memoryStore'
import { useThemeStore } from '@/store/themeStore'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ChatHeader } from './ChatHeader'
import { PersonaDrawer } from '../persona/PersonaDrawer'
import { SettingsModal } from '../settings/SettingsModal'
import { ImportModal } from '../settings/ImportModal'
import { ExportModal } from '../settings/ExportModal'
import { LogViewer } from '../settings/LogViewer'
import { MemoryPanel } from '../settings/MemoryPanel'
import { streamChatMessage } from '@/lib/api'
import { generateTickleResponse, organizeMemory, shouldAutoOrganize } from '@/lib/memory'
import { recognizeImage } from '@/lib/vision'
import { transcribeAudio } from '@/lib/speech'
import { processWithSearch } from '@/lib/onlineSearch'
import { useBlobUrl } from '@/hooks/useBlobUrl'
import { autoMessageTimer, generateAutoMessage, isInQuietTime } from '@/lib/autoMessage'
import { shouldSendEmoji, suggestEmoji, appendEmoji, shouldSendGifEmoji } from '@/lib/emoji'
import { chatLog, memoryLog, autoMsgLog, apiLog, tickleLog, emojiLog, autoMemoryLog } from '@/lib/logger'
import { flushSave } from '@/store/init'
import { Github, MessageCircle, Rocket, Search, X, ChevronUp, ChevronDown } from 'lucide-react'

interface ChatContainerProps {
  onMenuClick?: () => void
  showMenuButton?: boolean
  onLock?: () => void
}

export function ChatContainer({ onMenuClick, showMenuButton, onLock }: ChatContainerProps) {
  const { 
    gptConfig, apiConfig, userInfo,
    autoMessageConfig, quietTimeConfig, visionConfig, onlineSearchConfig, emojiConfig,
    setAutoMessageConfig
  } = useConfigStore()
  const resolvedBgImage = useBlobUrl(userInfo.backgroundImage)
  const { 
    personas, activePersonaId, setActive,
    addMessage, updateMessage, recallMessage, clearMessages 
  } = usePersonaStore()
  const { addTempLog, getTempLogs, addCoreMemory, clearTempLogs, getTopCoreMemories, getCoreMemoriesByPersonaId, deleteCoreMemory } = useMemoryStore()
  
  const [loading, setLoading] = useState(false)
  const [showPersona, setShowPersona] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<'api' | 'profile' | 'smart' | 'theme' | undefined>(undefined)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [replyingTo, setReplyingTo] = useState<import('@/types').Message | null>(null)
  const [showClearMenu, setShowClearMenu] = useState(false)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [showHelp, setShowHelp] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastOrganizedCountRef = useRef<number>(0)
  const hasSentInSessionRef = useRef(false)

  // 自动选择第一个人设
  useEffect(() => {
    if (!activePersonaId && personas.length > 0) {
      setActive(personas[0].id)
    }
  }, [activePersonaId, personas, setActive])

  // 人设 = 会话，直接从当前人设获取消息
  const currentPersona = personas.find(p => p.id === activePersonaId)
  const messages = currentPersona?.messages || []

  // 初始化/切换人设时重置记忆整理计数
  useEffect(() => {
    lastOrganizedCountRef.current = messages.length
    hasSentInSessionRef.current = false
  }, [activePersonaId])

  // 监听保存失败事件
  useEffect(() => {
    const handleSaveError = () => {
      showToast('⚠️ 数据保存失败，请导出备份后清理空间')
    }
    window.addEventListener('save-error', handleSaveError)
    return () => window.removeEventListener('save-error', handleSaveError)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // 判断是否需要显示时间分隔（间隔超过5分钟）
  const shouldShowTimeDivider = (prevTime?: string, currTime?: string): boolean => {
    if (!prevTime || !currTime) return true
    try {
      const prev = new Date(prevTime).getTime()
      const curr = new Date(currTime).getTime()
      return Math.abs(curr - prev) > 5 * 60 * 1000 // 5分钟
    } catch {
      return true
    }
  }

  // 格式化时间分隔显示
  const formatTimeDivider = (dateTime?: string): string => {
    if (!dateTime) return ''
    try {
      const date = new Date(dateTime)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      
      const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      
      if (messageDate.getTime() === today.getTime()) {
        return time
      } else if (messageDate.getTime() === yesterday.getTime()) {
        return `昨天 ${time}`
      } else {
        return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + ' ' + time
      }
    } catch {
      return dateTime
    }
  }

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 快捷指令处理
  const handleCommand = (cmd: string): boolean => {
    const commands: Record<string, () => void> = {
      // 清理类
      '/cl': () => { clearTempLogs(activePersonaId!); showToast('已清理临时记忆') },
      '/清理临时': () => { clearTempLogs(activePersonaId!); showToast('已清理临时记忆') },
      '/清屏': () => { clearMessages(activePersonaId!); showToast('已清屏') },
      '/cls': () => { clearMessages(activePersonaId!); showToast('已清屏') },
      '/清理核心': () => { 
        const memories = getCoreMemoriesByPersonaId(activePersonaId!)
        memories.forEach(m => deleteCoreMemory(m.id))
        showToast(`已清理 ${memories.length} 条核心记忆`) 
      },
      
      // 主动消息
      '/ea': () => { setAutoMessageConfig({ enabled: true }); showToast('已开启主动消息') },
      '/开启主动': () => { setAutoMessageConfig({ enabled: true }); showToast('已开启主动消息') },
      '/da': () => { setAutoMessageConfig({ enabled: false }); showToast('已关闭主动消息') },
      '/关闭主动': () => { setAutoMessageConfig({ enabled: false }); showToast('已关闭主动消息') },
      
      // 界面
      '/设置': () => setShowSettings(true),
      '/set': () => setShowSettings(true),
      '/人设': () => setShowPersona(true),
      '/p': () => setShowPersona(true),
      '/导入': () => setShowImport(true),
      '/导出': () => setShowExport(true),
      '/日志': () => setShowLogs(true),
      '/log': () => setShowLogs(true),
      
      // 主题
      '/手机模式': () => { useConfigStore.getState().setPhoneMode(true); showToast('已切换手机模式') },
      '/电脑模式': () => { useConfigStore.getState().setPhoneMode(false); showToast('已切换电脑模式') },
      '/微信': () => { useThemeStore.getState().setTheme('wechat'); showToast('已切换微信主题') },
      '/qq': () => { useThemeStore.getState().setTheme('qq'); showToast('已切换QQ主题') },
      '/imessage': () => { useThemeStore.getState().setTheme('imessage'); showToast('已切换iMessage主题') },
      '/discord': () => { useThemeStore.getState().setTheme('discord'); showToast('已切换Discord主题') },
      '/telegram': () => { useThemeStore.getState().setTheme('telegram'); showToast('已切换Telegram主题') },
      
      // 帮助
      '/help': () => showHelpDialog(),
      '/帮助': () => showHelpDialog(),
      '/h': () => showHelpDialog(),
    }
    
    const handler = commands[cmd]
    if (handler) {
      handler()
      return true
    }
    return false
  }
  
  // 帮助弹窗
  const showHelpDialog = () => {
    setShowHelp(true)
  }

  const handleSend = async (text: string, imageBase64?: string) => {
    if (!activePersonaId) return
    hasSentInSessionRef.current = true

    // 快捷指令处理
    const cmd = text.trim().toLowerCase()
    if (cmd.startsWith('/')) {
      const handled = handleCommand(cmd)
      if (handled) return
    }

    // 检查 API Key，未配置时弹出设置并强制打开 API 标签页
    if (!apiConfig.apiKey) {
      setSettingsDefaultTab('api')
      setShowSettings(true)
      showToast('请先配置 API Key')
      return
    }

    // 重置主动消息定时器
    if (autoMessageConfig.enabled) {
      autoMessageTimer.reset(autoMessageConfig.minInterval, autoMessageConfig.maxInterval)
      autoMsgLog.debug('定时器已重置')
    }

    // 添加用户消息
    const userText = imageBase64 ? (text || '请看这张图片') : text
    chatLog.info(`发送消息: ${userText.slice(0, 50)}${userText.length > 50 ? '...' : ''}`)
    addMessage(activePersonaId, {
      text: userText,
      inversion: true,
      dateTime: new Date().toLocaleString('zh-CN'),
      error: false,
      image: imageBase64,
      ...(replyingTo ? { replyTo: { id: replyingTo.id, text: replyingTo.text?.slice(0, 100) || '', isUser: replyingTo.inversion } } : {}),
    })
    setReplyingTo(null)

    // 记录临时记忆 - 用户消息
    addTempLog(activePersonaId, { role: 'user', content: userText })
    memoryLog.debug('记录临时记忆 - 用户消息')

    // 添加AI占位消息
    addMessage(activePersonaId, {
      text: '',
      inversion: false,
      dateTime: new Date().toLocaleString('zh-CN'),
      loading: true,
      error: false,
    })

    setLoading(true)

    // 获取当前人设
    const persona = personas.find(p => p.id === activePersonaId)
    const roleName = persona?.name || 'AI'

    // 构建系统消息（包含核心记忆）
    let systemMessage = persona?.content || gptConfig.systemMessage
    const coreMemories = getTopCoreMemories(activePersonaId)
    if (coreMemories.length > 0) {
      const memoryText = coreMemories.map(m => {
        const date = new Date(m.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        return `## 记忆片段 [${date}]\n**重要度**: ${m.importance}\n**摘要**: ${m.content}`
      }).join('\n\n')
      systemMessage = `${systemMessage}\n\n${memoryText}`
      memoryLog.info(`加载 ${coreMemories.length} 条核心记忆到系统提示词`)
    }

    // 构建消息历史（过滤掉记忆整理通知和拍一拍等系统消息）
    const contextMessages = messages
      .filter((m) => !m.isTickle && !m.text.startsWith('📝 记忆已整理'))
      .slice(-gptConfig.talkCount * 2)
      .map((m) => ({
        role: m.inversion ? 'user' : 'assistant',
        content: m.text,
      }))

    try {
      let userContent = text
      
      // 图片识别（仅对真正的 base64 图片，排除表情路径如 /emojis/xxx.gif）
      const isRealImage = imageBase64 && imageBase64.startsWith('data:')
      if (isRealImage && visionConfig.enabled) {
        showToast('正在识别图片...')
        const imageDescription = await recognizeImage({
          imageBase64,
          apiKey: visionConfig.apiKey || apiConfig.apiKey,
          apiBaseUrl: visionConfig.apiBaseUrl || apiConfig.apiBaseUrl,
          model: visionConfig.model,
          prompt: text || '请描述这张图片的内容',
        })
        userContent = `[用户发送了一张图片，图片内容: ${imageDescription}]\n用户说: ${text}`
      }

      // 联网搜索
      if (onlineSearchConfig.enabled && !imageBase64) {
        const searchResult = await processWithSearch({
          userMessage: text,
          searchConfig: onlineSearchConfig,
          mainConfig: { apiKey: apiConfig.apiKey, apiBaseUrl: apiConfig.apiBaseUrl, model: gptConfig.model },
        })
        if (searchResult.needSearch && searchResult.searchResult) {
          userContent = `${text}\n\n[联网搜索参考信息: ${searchResult.searchResult}]`
        }
      }

      // 获取最新的消息列表和最后一条消息ID（用于流式更新）
      const latestPersona = usePersonaStore.getState().personas.find(p => p.id === activePersonaId)
      const latestMessages = latestPersona?.messages || []
      const lastMsgId = latestMessages[latestMessages.length - 1]?.id

      // 流式请求
      apiLog.info(`调用 API: ${gptConfig.model}`, { url: apiConfig.apiBaseUrl })
      let responseText = ''
      const stream = streamChatMessage({
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          ...contextMessages,
          { role: 'user', content: userContent },
        ],
        model: gptConfig.model,
        maxTokens: gptConfig.maxTokens,
        temperature: gptConfig.temperature,
        apiKey: apiConfig.apiKey,
        apiBaseUrl: apiConfig.apiBaseUrl,
      })

      // 逐步接收流式内容
      for await (const chunk of stream) {
        responseText += chunk
        updateMessage(activePersonaId, lastMsgId || '', {
          text: responseText,
          loading: true,
        })
      }
      apiLog.info(`收到回复: ${responseText.length} 字符`)

      // 检查是否有 [tickle] 指令
      if (responseText.includes('[tickle]')) {
        responseText = responseText.replace(/\[tickle\]/g, '')
        addMessage(activePersonaId, {
          text: `${roleName} 拍了拍你`,
          inversion: false,
          dateTime: new Date().toLocaleString('zh-CN'),
          isTickle: true,
        })
      }

      // 检查是否有 [tickle_self] 指令
      if (responseText.includes('[tickle_self]')) {
        responseText = responseText.replace(/\[tickle_self\]/g, '')
        addMessage(activePersonaId, {
          text: `${roleName} 拍了拍自己`,
          inversion: false,
          dateTime: new Date().toLocaleString('zh-CN'),
          isTickle: true,
        })
      }

      // 检查是否有 [recall] 指令 - 撤回上一条
      if (responseText.includes('[recall]')) {
        responseText = responseText.replace(/\[recall\]/g, '')
        // 撤回最后一条AI消息
        const aiMessages = latestMessages.filter((m: { inversion?: boolean; isTickle?: boolean }) => !m.inversion && !m.isTickle)
        if (aiMessages.length > 1) {
          const toRecall = aiMessages[aiMessages.length - 2]
          if (toRecall) {
            recallMessage(activePersonaId!, toRecall.id)
          }
        }
      }

      // 处理分隔的多条消息：支持 \\ 或 换行符
      const messageParts = responseText.trim()
        .split(/\\+n?|\n{2,}/)  // 支持 \\ 或 \n 或 双换行
        .map(s => s.trim().replace(/\n/g, ' '))  // 单换行替换为空格
        .filter(Boolean)
      
      if (messageParts.length > 1) {
        // 多条消息：更新第一条，然后逐个添加后续消息
        let firstText = messageParts[0]
        if (emojiConfig.enabled && shouldSendEmoji(emojiConfig.probability)) {
          const emoji = suggestEmoji(firstText)
          if (emoji) firstText = appendEmoji(firstText, emoji)
        }
        
        updateMessage(activePersonaId, lastMsgId || '', {
          text: firstText,
          loading: false,
          dateTime: new Date().toLocaleString('zh-CN'),
        })
        
        // 延迟添加后续消息，模拟打字效果
        for (let i = 1; i < messageParts.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500))
          let partText = messageParts[i]
          // 最后一条消息可能加表情
          if (i === messageParts.length - 1 && emojiConfig.enabled && shouldSendEmoji(emojiConfig.probability)) {
            const emoji = suggestEmoji(partText)
            if (emoji) partText = appendEmoji(partText, emoji)
          }
          addMessage(activePersonaId, {
            text: partText,
            inversion: false,
            dateTime: new Date().toLocaleString('zh-CN'),
          })
        }
        
        // 记录临时记忆 - 合并所有消息
        addTempLog(activePersonaId, { role: 'ai', content: messageParts.join(' ') })
      } else {
        // 单条消息：原有逻辑
        let finalText = responseText.trim()
        if (emojiConfig.enabled && shouldSendEmoji(emojiConfig.probability)) {
          const emoji = suggestEmoji(finalText)
          if (emoji) {
            finalText = appendEmoji(finalText, emoji)
          }
        }

        updateMessage(activePersonaId, lastMsgId || '', {
          text: finalText,
          loading: false,
          dateTime: new Date().toLocaleString('zh-CN'),
        })

        // 记录临时记忆 - AI 回复
        addTempLog(activePersonaId, { role: 'ai', content: finalText })
      }
      memoryLog.debug('记录临时记忆 - AI 回复')
      chatLog.info('对话完成')

      // AI 自动发送 GIF 表情（根据概率和情绪）
      if (emojiConfig.enabled && apiConfig.apiKey) {
        try {
          const gifUrl = await shouldSendGifEmoji(
            responseText,
            emojiConfig.probability,
            { apiKey: apiConfig.apiKey, apiBaseUrl: apiConfig.apiBaseUrl, model: gptConfig.model }
          )
          if (gifUrl) {
            emojiLog.info(`自动发送 GIF 表情`, { url: gifUrl })
            await new Promise(resolve => setTimeout(resolve, 500))
            addMessage(activePersonaId, {
              text: '[表情]',
              inversion: false,
              dateTime: new Date().toLocaleString('zh-CN'),
              image: gifUrl,
            })
          }
        } catch (e) {
          emojiLog.error('发送表情失败', { error: e instanceof Error ? e.message : String(e) })
        }
      }

      // 更新会话标题（如果是第一条消息）
      if (messages.length === 0) {
        // 人设名称不需要更新
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '发送失败'
      apiLog.error('API 调用失败', { error: errorMessage })
      const errPersona = usePersonaStore.getState().personas.find(p => p.id === activePersonaId)
      const errMessages = errPersona?.messages || []
      const errLastMsgId = errMessages[errMessages.length - 1]?.id
      updateMessage(activePersonaId, errLastMsgId || '', {
        text: errorMessage,
        loading: false,
        error: true,
      })
    } finally {
      setLoading(false)
      // 对话完成后立即保存，防止防抖期间刷新导致消息丢失
      flushSave()
    }
  }

  // 拍一拍功能 - 触发 AI 回应
  const handleTickle = async (target: 'ai' | 'user' = 'ai') => {
    if (!activePersonaId || loading) return

    const persona = personas.find(p => p.id === activePersonaId)
    const roleName = persona?.name || 'AI'
    const userName = userInfo.name || '我'

    // 添加拍一拍消息
    const tickleText = target === 'ai' 
      ? `你 拍了拍 ${roleName}`
      : `你 拍了拍 自己`
    
    tickleLog.info(`拍一拍: ${tickleText}`)
    addMessage(activePersonaId, {
      text: tickleText,
      inversion: false,
      dateTime: new Date().toLocaleString('zh-CN'),
      isTickle: true,
    })

    showToast('👉 拍一拍')

    // 触发 AI 回应
    if (apiConfig.apiKey) {
      try {
        const response = await generateTickleResponse({
          roleName,
          personaContent: persona?.content || '',
          apiKey: apiConfig.apiKey,
          apiBaseUrl: apiConfig.apiBaseUrl,
          model: gptConfig.model,
        })

        if (response) {
          tickleLog.info(`AI 回应拍一拍: ${response.slice(0, 60)}`)
          let text = response
          // 处理 AI 回拍
          if (text.includes('[tickle]')) {
            text = text.replace(/\[tickle\]/g, '').trim()
            tickleLog.info(`AI 回拍了你`)
            addMessage(activePersonaId, {
              text: `${roleName} 拍了拍你`,
              inversion: false,
              dateTime: new Date().toLocaleString('zh-CN'),
              isTickle: true,
            })
          }
          // 处理换行分隔，拆分成多条消息
          if (text) {
            const parts = text.split(/\\+n?/).map(s => s.trim()).filter(Boolean)
            for (const part of parts) {
              addMessage(activePersonaId, {
                text: part,
                inversion: false,
                dateTime: new Date().toLocaleString('zh-CN'),
              })
            }
          }
        }
      } catch (e) {
        tickleLog.error('拍一拍回应失败', { error: e instanceof Error ? e.message : String(e) })
      }
      flushSave()
    }
  }

  // 发送语音消息 - 转写后发送给 AI
  const handleSendVoice = async (audioBase64: string, duration: number) => {
    if (!activePersonaId) return
    
    // 先添加语音消息到界面
    addMessage(activePersonaId, {
      text: '[语音消息]',
      inversion: true,
      dateTime: new Date().toLocaleString('zh-CN'),
      audio: audioBase64,
      audioDuration: duration,
    })
    
    chatLog.info(`发送语音消息: ${duration}秒`)
    
    // 调用 Whisper API 转写语音
    if (apiConfig.apiKey) {
      try {
        showToast('正在识别语音...')
        const transcribedText = await transcribeAudio({
          audioBase64,
          apiKey: apiConfig.apiKey,
          apiBaseUrl: apiConfig.apiBaseUrl,
        })
        
        if (transcribedText) {
          chatLog.info(`语音转写: ${transcribedText}`)
          // 更新语音消息显示转写文本
          const latestPersona = usePersonaStore.getState().personas.find(p => p.id === activePersonaId)
          const latestMessages = latestPersona?.messages || []
          const voiceMsgId = latestMessages[latestMessages.length - 1]?.id
          if (voiceMsgId) {
            updateMessage(activePersonaId, voiceMsgId, { text: transcribedText })
          }
          // 发送转写文本给 AI
          await handleSend(transcribedText)
        }
      } catch (error) {
        console.error('语音转写失败:', error)
        showToast('语音识别失败')
      }
    }
  }

  // 手动记忆整理
  const handleOrganizeMemory = async () => {
    if (!activePersonaId || loading) return
    if (!apiConfig.apiKey) {
      showToast('请先配置 API Key')
      return
    }

    const tempLogs = getTempLogs(activePersonaId)

    if (tempLogs.length < 5) {
      showToast('消息太少，无需整理')
      return
    }

    showToast('正在整理记忆...')
    memoryLog.info(`开始记忆整理, 临时记忆条数: ${tempLogs.length}`)

    try {
      const persona = personas.find(p => p.id === activePersonaId)
      const roleName = persona?.name || 'AI'

      const result = await organizeMemory({
        messages: tempLogs.map((log) => ({
          role: log.role === 'user' ? 'user' : 'assistant',
          content: log.content,
          dateTime: log.timestamp,
        })),
        roleName,
        apiKey: apiConfig.apiKey,
        apiBaseUrl: apiConfig.apiBaseUrl,
        model: gptConfig.model,
      })

      // 保存到核心记忆
      if (result.summary) {
        addCoreMemory({
          personaId: activePersonaId,
          content: result.summary,
          importance: result.importance,
          category: result.category,
        })
        memoryLog.info(`保存核心记忆, 重要度: ${result.importance}, 分类: ${result.category}`)
      }

      // 清空临时记忆
      clearTempLogs(activePersonaId)
      memoryLog.debug('临时记忆已清空')

      // 添加记忆分隔线
      addMessage(activePersonaId, {
        text: `📝 记忆已整理: ${result.summary.slice(0, 100)}...`,
        inversion: false,
        dateTime: new Date().toLocaleString('zh-CN'),
        isMemoryDivider: true,
      })

      showToast('记忆整理完成')
      // 立即保存，避免防抖期间用户刷新导致数据丢失
      flushSave()
    } catch (e) {
      console.error('记忆整理失败:', e)
      showToast('记忆整理失败')
    }
  }

  // 清屏 - 清除聊天记录
  const handleClearScreen = () => {
    if (!activePersonaId) return
    if (confirm('确定要清除当前聊天记录吗？')) {
      clearMessages(activePersonaId)
      showToast('聊天记录已清除')
    }
  }

  // 清理临时记忆
  const handleClearTempMemory = () => {
    if (!activePersonaId) return
    if (confirm('确定要清理临时记忆吗？这将清除对话日志缓存。')) {
      clearTempLogs(activePersonaId)
      showToast('临时记忆已清理')
    }
  }

  // 清理核心记忆
  const handleClearCoreMemory = () => {
    if (!activePersonaId) return
    const memories = getCoreMemoriesByPersonaId(activePersonaId)
    if (memories.length === 0) {
      showToast('暂无核心记忆')
      return
    }
    if (confirm(`确定要清理 ${memories.length} 条核心记忆吗？此操作不可恢复！`)) {
      memories.forEach(m => deleteCoreMemory(m.id))
      showToast('核心记忆已清理')
    }
  }

  // 导出聊天记录
  const handleExportChat = (format: 'txt' | 'md') => {
    if (!activePersonaId) return
    const persona = personas.find(p => p.id === activePersonaId)
    const name = persona?.name || 'AI'
    const userName = userInfo.name || '我'
    const validMessages = messages.filter(m => !m.isRecalled && !m.loading)
    if (validMessages.length === 0) {
      showToast('暂无聊天记录')
      return
    }
    const lines: string[] = []
    if (format === 'md') {
      lines.push(`# ${userName} 与 ${name} 的聊天记录\n`)
      lines.push(`> 导出时间: ${new Date().toLocaleString('zh-CN')}\n`)
      lines.push(`> 消息数: ${validMessages.length}\n`)
      lines.push('---\n')
    }
    for (const m of validMessages) {
      if (m.isMemoryDivider) {
        lines.push(format === 'md' ? `\n---\n*📝 记忆已整理 · ${m.dateTime}*\n` : `\n--- 记忆已整理 · ${m.dateTime} ---\n`)
        continue
      }
      if (m.isTickle) {
        lines.push(format === 'md' ? `\n*👉 ${m.text}*\n` : `[拍一拍] ${m.text}\n`)
        continue
      }
      const sender = m.inversion ? userName : name
      const time = m.dateTime || ''
      const replyPrefix = m.replyTo ? `[回复: ${m.replyTo.text?.slice(0, 30)}...] ` : ''
      if (format === 'md') {
        lines.push(`**${sender}** *(${time})*`)
        if (m.replyTo) lines.push(`> ${m.replyTo.text?.slice(0, 80)}`)
        lines.push(`${m.text || '[图片/语音]'}\n`)
      } else {
        lines.push(`${time} | ${sender}: ${replyPrefix}${m.text || '[图片/语音]'}`)
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat_${name}_${new Date().toISOString().slice(0, 10)}.${format}`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`已导出为 ${format.toUpperCase()}`)
  }

  // 初始化 - 重置所有数据
  const handleReset = () => {
    if (confirm('⚠️ 确定要初始化吗？\n\n这将清除当前角色的所有数据：\n- 聊天记录\n- 临时记忆\n- 核心记忆\n\n此操作不可恢复！')) {
      if (!activePersonaId) return
      clearMessages(activePersonaId)
      clearTempLogs(activePersonaId)
      const memories = getCoreMemoriesByPersonaId(activePersonaId)
      memories.forEach(m => deleteCoreMemory(m.id))
      showToast('已初始化')
    }
  }

  // 自动记忆整理检查（阈值来自设置 memoryOrganizeCount）
  // 在 loading 结束后检查，避免 loading=true 时 handleOrganizeMemory 被静默跳过
  useEffect(() => {
    // 用户未发送消息前，仅跟踪消息数（store 加载/水合导致的变化）
    if (!hasSentInSessionRef.current) {
      lastOrganizedCountRef.current = messages.length
      return
    }
    // loading 中不检查，等 loading 结束再触发
    if (loading) return
    if (!gptConfig.autoMemoryOrganize || messages.length < 5) return
    const threshold = gptConfig.memoryOrganizeCount || 30
    const lastCount = lastOrganizedCountRef.current
    // 跨过阈值即触发（而非精确取模，避免 AI 一次回复多条消息时跳过）
    if (Math.floor(messages.length / threshold) > Math.floor(lastCount / threshold)) {
      autoMemoryLog.info(`触发自动记忆整理, 消息数: ${messages.length}, 阈值: ${threshold}, 上次: ${lastCount}`)
      lastOrganizedCountRef.current = messages.length
      handleOrganizeMemory()
    }
  }, [messages.length, loading])

  // 主动消息功能
  const handleAutoMessage = useCallback(async () => {
    if (!activePersonaId || loading || !apiConfig.apiKey) return
    
    // 检查安静时间
    if (quietTimeConfig.enabled && isInQuietTime(quietTimeConfig.startTime, quietTimeConfig.endTime)) {
      autoMsgLog.debug('当前处于安静时间，跳过主动消息')
      return
    }

    autoMsgLog.info('触发主动消息')
    const persona = personas.find(p => p.id === activePersonaId)
    const roleName = persona?.name || 'AI'
    const systemPrompt = persona?.content || gptConfig.systemMessage

    try {
      const recentMessages = messages.slice(-10).map(m => ({
        role: m.inversion ? 'user' : 'assistant',
        content: m.text,
      }))

      const autoMsg = await generateAutoMessage({
        roleName,
        recentMessages,
        prompt: autoMessageConfig.prompt,
        apiKey: apiConfig.apiKey,
        apiBaseUrl: apiConfig.apiBaseUrl,
        model: gptConfig.model,
        systemPrompt,
      })

      if (autoMsg) {
        addMessage(activePersonaId, {
          text: autoMsg,
          inversion: false,
          dateTime: new Date().toLocaleString('zh-CN'),
        })
        showToast('💬 主动消息')
      }
    } catch (e) {
      console.error('主动消息生成失败:', e)
    }
  }, [activePersonaId, loading, apiConfig, quietTimeConfig, autoMessageConfig, gptConfig, messages, personas, addMessage])

  // 启动/停止主动消息定时器
  useEffect(() => {
    if (autoMessageConfig.enabled && apiConfig.apiKey && activePersonaId) {
      autoMessageTimer.start(autoMessageConfig.minInterval, autoMessageConfig.maxInterval, handleAutoMessage)
    } else {
      autoMessageTimer.stop()
    }
    return () => autoMessageTimer.stop()
  }, [autoMessageConfig.enabled, autoMessageConfig.minInterval, autoMessageConfig.maxInterval, apiConfig.apiKey, activePersonaId, handleAutoMessage])

  // 如果没有当前人设，尝试自动选择第一个
  if (!currentPersona) {
    if (personas.length > 0) {
      // 有人设但没选中，自动选择第一个
      setActive(personas[0].id)
    }
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--theme-chat-bg)]">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--theme-chat-bg)] relative min-h-0">
      <ChatHeader
        title={currentPersona.name}
        onOpenPersona={() => setShowPersona(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenImport={() => setShowImport(true)}
        onOpenExport={() => setShowExport(true)}
        onOrganizeMemory={handleOrganizeMemory}
        onClearScreen={handleClearScreen}
        onClearTempMemory={handleClearTempMemory}
        onClearCoreMemory={handleClearCoreMemory}
        onReset={handleReset}
        onOpenMemory={() => setShowMemory(true)}
        onOpenSearch={() => setShowSearch(s => !s)}
        onExportChat={handleExportChat}
        onOpenLogs={() => setShowLogs(true)}
        onLock={onLock}
        onMenuClick={onMenuClick}
        showMenuButton={showMenuButton}
      />

      {/* 搜索栏 */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--theme-sidebar-bg)] border-b border-[var(--theme-border)] flex-shrink-0">
          <Search className="w-4 h-4 text-[var(--theme-text-muted)] flex-shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentMatchIndex(0); }}
            placeholder="搜索聊天记录..."
            className="flex-1 bg-transparent text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const matches = messages.filter(m => !m.isRecalled && !m.isTickle && !m.isMemoryDivider && m.text && searchQuery && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
                if (matches.length > 0) {
                  const next = (currentMatchIndex + 1) % matches.length
                  setCurrentMatchIndex(next)
                  messageRefs.current[matches[next].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              } else if (e.key === 'Escape') {
                setShowSearch(false); setSearchQuery('');
              }
            }}
          />
          {searchQuery && (() => {
            const matchCount = messages.filter(m => !m.isRecalled && !m.isTickle && !m.isMemoryDivider && m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())).length
            return (
              <span className="text-xs text-[var(--theme-text-muted)] whitespace-nowrap">
                {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : '无结果'}
              </span>
            )
          })()}
          <div className="flex items-center gap-0.5">
            <button onClick={() => {
              const matches = messages.filter(m => !m.isRecalled && !m.isTickle && !m.isMemoryDivider && m.text && searchQuery && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
              if (matches.length > 0) {
                const prev = (currentMatchIndex - 1 + matches.length) % matches.length
                setCurrentMatchIndex(prev)
                messageRefs.current[matches[prev].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }} className="p-1 hover:bg-[var(--theme-border)]/50 rounded">
              <ChevronUp className="w-4 h-4 text-[var(--theme-text-secondary)]" />
            </button>
            <button onClick={() => {
              const matches = messages.filter(m => !m.isRecalled && !m.isTickle && !m.isMemoryDivider && m.text && searchQuery && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
              if (matches.length > 0) {
                const next = (currentMatchIndex + 1) % matches.length
                setCurrentMatchIndex(next)
                messageRefs.current[matches[next].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }} className="p-1 hover:bg-[var(--theme-border)]/50 rounded">
              <ChevronDown className="w-4 h-4 text-[var(--theme-text-secondary)]" />
            </button>
          </div>
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 hover:bg-[var(--theme-border)]/50 rounded">
            <X className="w-4 h-4 text-[var(--theme-text-muted)]" />
          </button>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/70 text-white rounded-lg text-sm">
          {toast}
        </div>
      )}

      {/* 消息列表 */}
      <div 
        className="flex-1 overflow-y-auto py-4"
        style={resolvedBgImage ? {
          backgroundImage: `url(${resolvedBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center pt-4 px-4">
            {/* 项目介绍面板 */}
            <div className="max-w-md w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-[var(--theme-border)] shadow-lg p-5 mb-6">
              <h2 className="text-lg font-bold text-center text-[var(--theme-text-primary)] mb-3 flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5 text-[var(--theme-primary)]" />
                WeChatBot Web 模拟器
                <a href="https://github.com/onebai123/WeChatBot_Web" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-gray-900 hover:text-gray-600 transition-colors">
                  <Github className="w-5 h-5" />
                </a>
              </h2>
              <div className="flex justify-center gap-2 text-xs mb-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded">👤 角色扮演</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded">🧠 记忆整理</span>
                <span className="px-2 py-1 bg-green-100 text-green-600 rounded">📥 导入配置</span>
              </div>
              <div className="flex justify-center gap-2 text-xs mb-4">
                <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded">💬 主动消息</span>
                <span className="px-2 py-1 bg-pink-100 text-pink-600 rounded">😊 表情识别</span>
                <span className="px-2 py-1 bg-cyan-100 text-cyan-600 rounded">👋 拍一拍</span>
              </div>
              <div className="space-y-1.5 text-sm text-[var(--theme-text-secondary)] ml-8 sm:ml-10 md:ml-14 lg:ml-16">
                <p className="text-green-600 font-medium">✅ 快速开始</p>
                <p className="ml-2">1. 点击顶部 <span className="text-orange-500 font-medium">设置</span> → 填写接口地址和密钥</p>
                <p className="ml-2">2. 点击 <span className="text-blue-500 font-medium">＋</span> 或 <span className="text-blue-500 font-medium">人设</span> → 选择或创建 AI 角色</p>
                <p className="ml-2">3. <span className="text-green-600 font-medium">开始对话！</span></p>
                <p className="ml-2"><span className="text-xs text-gray-400">不会配置？</span><a href="https://ai.feishu.cn/wiki/DDh6waPHoiHd7WkvQqOclLNUn34" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline font-medium">→ 查看详细教程</a></p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--theme-border)] flex flex-wrap justify-center gap-3 text-xs items-center">
                <span className="text-green-600">🌐 开源项目</span>
                <a href="https://ai.feishu.cn/wiki/DDh6waPHoiHd7WkvQqOclLNUn34" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-orange-500 hover:underline">
                  <Rocket className="w-3 h-3" /> 一键部署
                </a>
                <span className="text-blue-600">📱 可打包 APP</span>
              </div>
              <p className="text-center text-xs text-[var(--theme-text-muted)] mt-2">
                🔒 数据存储在浏览器本地，不上传服务器
              </p>
            </div>
            
            {/* 示例对话预览 */}
            <div className="max-w-sm w-full space-y-3 opacity-80 mb-6">
              <div className="text-center text-xs text-[var(--theme-text-muted)] mb-4">昨天 23:42</div>
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-2 shadow-sm text-sm text-gray-600">生气了？</div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[var(--theme-primary)]/20 rounded-2xl px-4 py-2 shadow-sm text-sm text-gray-600">没有啦...就是有点想你了 🥺</div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-2 shadow-sm text-sm text-gray-600">那你怎么不回我消息</div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[var(--theme-primary)]/20 rounded-2xl px-4 py-2 shadow-sm text-sm text-gray-600">手机没电了嘛！你看你又凶我 😤</div>
              </div>
            </div>
            {/* 引导文字 */}
            <div className="text-center">
              <div className="text-lg font-medium text-[var(--theme-text-primary)]">💬 发送消息开始你们的故事~</div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            // 检查是否需要显示时间分隔
            const showTimeDivider = index === 0 || shouldShowTimeDivider(
              messages[index - 1]?.dateTime,
              message.dateTime
            )
            const isMatch = !!(searchQuery && message.text && !message.isRecalled && !message.isTickle && !message.isMemoryDivider && message.text.toLowerCase().includes(searchQuery.toLowerCase()))
            const matchMessages = searchQuery ? messages.filter(m => !m.isRecalled && !m.isTickle && !m.isMemoryDivider && m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())) : []
            const isCurrentMatch = isMatch && matchMessages[currentMatchIndex]?.id === message.id
            return (
              <div key={message.id} ref={el => { messageRefs.current[message.id] = el }}>
                {showTimeDivider && (
                  <div className="text-center text-xs text-[var(--theme-text-muted)] py-3">
                    {formatTimeDivider(message.dateTime)}
                  </div>
                )}
                <MessageBubble
                  message={message}
                  personaId={activePersonaId!}
                  onTickle={handleTickle}
                  onClearMemory={() => setShowClearMenu(true)}
                  onReply={(msg) => setReplyingTo(msg)}
                  searchQuery={searchQuery || undefined}
                  isSearchMatch={isCurrentMatch}
                />
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput 
        onSend={handleSend} 
        onSendVoice={handleSendVoice}
        onTickle={handleTickle} 
        disabled={false}
        visionEnabled={visionConfig.enabled}
        replyTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* 人设抽屉 */}
      <PersonaDrawer open={showPersona} onClose={() => setShowPersona(false)} />

      {/* 设置弹窗 */}
      <SettingsModal 
        open={showSettings} 
        onClose={() => { setShowSettings(false); setSettingsDefaultTab(undefined) }}
        defaultTab={settingsDefaultTab}
      />

      {/* 导入配置弹窗 */}
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />

      {/* 导出数据弹窗 */}
      <ExportModal open={showExport} onClose={() => setShowExport(false)} />

      {/* 日志查看器 */}
      <LogViewer open={showLogs} onClose={() => setShowLogs(false)} />

      {/* 记忆管理面板 */}
      <MemoryPanel open={showMemory} onClose={() => setShowMemory(false)} />

      {/* 清理菜单弹窗（从错误消息中打开） */}
      {showClearMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowClearMenu(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--theme-chat-bg)] rounded-2xl p-5 w-[280px] shadow-xl border border-[var(--theme-border)]">
            <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-4 text-center">清理选项</h3>
            <div className="space-y-2">
              <button
                onClick={() => { handleClearScreen(); setShowClearMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-lg">🧹</span>
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--theme-text-primary)]">清屏</div>
                  <div className="text-xs text-[var(--theme-text-muted)]">清除当前聊天记录</div>
                </div>
              </button>
              <button
                onClick={() => { handleClearTempMemory(); setShowClearMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
                  <span className="text-white text-lg">📝</span>
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--theme-text-primary)]">清理临时记忆</div>
                  <div className="text-xs text-[var(--theme-text-muted)]">清除对话日志缓存</div>
                </div>
              </button>
              <button
                onClick={() => { handleClearCoreMemory(); setShowClearMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--theme-border)]/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
                  <span className="text-white text-lg">🧠</span>
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--theme-text-primary)]">清理核心记忆</div>
                  <div className="text-xs text-[var(--theme-text-muted)]">清除 AI 长期记忆</div>
                </div>
              </button>
              <button
                onClick={() => { handleReset(); setShowClearMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                  <span className="text-white text-lg">🔄</span>
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-red-500">初始化</div>
                  <div className="text-xs text-[var(--theme-text-muted)]">重置所有数据</div>
                </div>
              </button>
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

      {/* 帮助弹窗 */}
      {showHelp && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--theme-chat-bg)] rounded-2xl p-5 w-[340px] max-h-[80vh] overflow-y-auto shadow-xl border border-[var(--theme-border)]">
            <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-4 text-center">📋 快捷指令</h3>
            
            {/* 清理类 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[var(--theme-text-primary)] mb-2">🧹 清理类</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/cl</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/清理临时</span>
                  <span className="text-[var(--theme-text-secondary)]">— 清理临时记忆</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/cls</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/清屏</span>
                  <span className="text-[var(--theme-text-secondary)]">— 清空对话</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/清理核心</span>
                  <span className="text-[var(--theme-text-secondary)]">— 清理核心记忆</span>
                </div>
              </div>
            </div>
            
            {/* 主动消息 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[var(--theme-text-primary)] mb-2">💬 主动消息</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/ea</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/开启主动</span>
                  <span className="text-[var(--theme-text-secondary)]">— 开启主动消息</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/da</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/关闭主动</span>
                  <span className="text-[var(--theme-text-secondary)]">— 关闭主动消息</span>
                </div>
              </div>
            </div>
            
            {/* 主题 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[var(--theme-text-primary)] mb-2">🎨 主题切换</h4>
              <div className="flex flex-wrap gap-1.5 text-xs mb-2">
                <span className="px-2 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded font-mono">/微信</span>
                <span className="px-2 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded font-mono">/qq</span>
                <span className="px-2 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded font-mono">/imessage</span>
                <span className="px-2 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded font-mono">/discord</span>
                <span className="px-2 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded font-mono">/telegram</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/手机模式</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/电脑模式</span>
                </div>
              </div>
            </div>
            
            {/* 界面 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[var(--theme-text-primary)] mb-2">📱 界面</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/set</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/设置</span>
                  <span className="text-[var(--theme-text-secondary)]">— 打开设置</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/p</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/人设</span>
                  <span className="text-[var(--theme-text-secondary)]">— 打开人设</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/log</span>
                  <span className="text-[var(--theme-text-muted)]">或</span>
                  <span className="text-[var(--theme-primary)] font-mono">/日志</span>
                  <span className="text-[var(--theme-text-secondary)]">— 查看日志</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--theme-primary)] font-mono">/导入</span>
                  <span className="text-[var(--theme-text-muted)">/</span>
                  <span className="text-[var(--theme-primary)] font-mono">/导出</span>
                </div>
              </div>
            </div>
            
            {/* 帮助 */}
            <div className="mb-2">
              <h4 className="text-sm font-medium text-[var(--theme-text-primary)] mb-2">❓ 帮助</h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--theme-primary)] font-mono">/help</span>
                <span className="text-[var(--theme-text-muted)]">或</span>
                <span className="text-[var(--theme-primary)] font-mono">/帮助</span>
                <span className="text-[var(--theme-text-muted)]">或</span>
                <span className="text-[var(--theme-primary)] font-mono">/h</span>
                <span className="text-[var(--theme-text-secondary)]">— 显示本帮助</span>
              </div>
            </div>
            
            <button
              onClick={() => setShowHelp(false)}
              className="w-full mt-2 py-2 text-sm bg-[var(--theme-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              知道了
            </button>
          </div>
        </>
      )}
    </div>
  )
}
