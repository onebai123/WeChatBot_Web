'use client'

import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, User, Bot, Image, Settings, Key, Zap, Palette, Database, Trash2, Download, Upload, FileJson, FolderArchive, Github } from 'lucide-react'
import { useConfigStore } from '@/store/configStore'
import { cn } from '@/lib/utils'
import { useBlobUrl } from '@/hooks/useBlobUrl'
import { ThemeSwitcher } from './ThemeSwitcher'
import { AvatarUpload } from '../common/AvatarUpload'
import { MODEL_OPTIONS, DEFAULT_MODEL, isPresetModel, API_PROVIDERS, getModelsForProvider, detectProvider } from '@/lib/constants'
import { getStorageStats, formatStorageSize, clearAll, downloadExport } from '@/lib/dataService'
import { importFile } from '@/lib/importService'
import { reloadStores } from '@/store/init'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: 'profile' | 'api' | 'smart' | 'theme'  // 强制打开指定标签页
}

type TabKey = 'profile' | 'api' | 'smart' | 'theme'

export function SettingsModal({ open, onClose, defaultTab }: SettingsModalProps) {
  const { 
    gptConfig, apiConfig, userInfo, 
    autoMessageConfig, quietTimeConfig, visionConfig, onlineSearchConfig, emojiConfig,
    setGptConfig, setApiConfig, setUserInfo,
    setAutoMessageConfig, setQuietTimeConfig, setVisionConfig, setOnlineSearchConfig, setEmojiConfig
  } = useConfigStore()
  const resolvedBgImage = useBlobUrl(userInfo.backgroundImage)
  const [showApiKey, setShowApiKey] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('api')
  const [customModelMode, setCustomModelMode] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(() => detectProvider(apiConfig.apiBaseUrl))
  const [customApiUrl, setCustomApiUrl] = useState(apiConfig.apiBaseUrl)

  // 强制切换到指定标签页
  useEffect(() => {
    if (open && defaultTab) {
      setActiveTab(defaultTab)
    }
  }, [open, defaultTab])

  // 同步 API URL 变化（如导入配置后）
  useEffect(() => {
    const detected = detectProvider(apiConfig.apiBaseUrl)
    setSelectedProvider(detected)
    setCustomApiUrl(apiConfig.apiBaseUrl)
  }, [apiConfig.apiBaseUrl])

  if (!open) return null

  const tabs = [
    { key: 'api', label: 'API', icon: Key, color: 'from-amber-500 to-orange-400' },
    { key: 'profile', label: '个人', icon: User, color: 'from-blue-500 to-cyan-400' },
    { key: 'smart', label: '智能', icon: Zap, color: 'from-emerald-500 to-green-400' },
    { key: 'theme', label: '主题', icon: Palette, color: 'from-indigo-500 to-violet-400' },
  ]

  const currentTab = tabs.find(t => t.key === activeTab)!

  // 主题开关组件
  const Switch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={cn(
        'relative w-11 h-6 rounded-full transition-all duration-300',
        checked 
          ? 'bg-[var(--theme-primary)]' 
          : 'bg-[var(--theme-border)]'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300',
        checked ? 'left-[22px]' : 'left-0.5'
      )} />
    </button>
  )

  // 主题输入框样式
  const inputClass = 'w-full px-4 py-2.5 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-lg text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
      {/* 遮罩 - 毛玻璃效果 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗 - 移动端全屏，PC端居中 */}
      <div className="relative bg-[var(--theme-chat-bg)] w-full h-full sm:w-full sm:max-w-4xl sm:h-[600px] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row">
        
        {/* 左侧导航 - PC端 */}
        <div className="hidden sm:flex flex-col w-56 bg-[var(--theme-sidebar-bg)] p-4 border-r border-[var(--theme-border)]">
          {/* Logo 区域 */}
          <div className="flex items-center gap-3 px-3 py-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary)] flex items-center justify-center shadow-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[var(--theme-text-primary)] font-semibold">设置中心</h2>
              <p className="text-[var(--theme-text-muted)] text-xs">配置你的 AI 助手</p>
            </div>
          </div>

          {/* 导航列表 */}
          <nav className="flex-1 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                    activeTab === tab.key
                      ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-text-primary)]'
                      : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    activeTab === tab.key 
                      ? 'bg-[var(--theme-primary)] shadow-lg' 
                      : 'bg-[var(--theme-border)]'
                  )}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* 底部版本信息 */}
          <div className="pt-4 border-t border-[var(--theme-border)] space-y-2">
            <a 
              href="https://github.com/onebai123/WeChatBot_Web" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-[var(--theme-text-secondary)] hover:text-[var(--theme-primary)] transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="text-xs font-medium">Star on GitHub</span>
            </a>
            <p className="text-[var(--theme-text-muted)] text-xs text-center">WeChatBot Web v1.0 · 开源项目</p>
          </div>
        </div>

        {/* 移动端头部 */}
        <div className="sm:hidden flex items-center justify-between px-4 py-3 bg-[var(--theme-header-bg)] border-b border-[var(--theme-border)]">
          <button onClick={onClose} className="text-[var(--theme-text-secondary)] text-sm">取消</button>
          <h2 className="text-[var(--theme-text-primary)] font-medium">{currentTab.label}</h2>
          <button onClick={onClose} className="text-[var(--theme-primary)] text-sm font-medium">完成</button>
        </div>

        {/* 移动端标签页 */}
        <div className="sm:hidden px-4 py-3 bg-[var(--theme-sidebar-bg)] border-b border-[var(--theme-border)]">
          <div className="flex justify-between">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs transition-all flex-1',
                    activeTab === tab.key
                      ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]'
                      : 'text-[var(--theme-text-muted)]'
                  )}
                >
                  <Icon className={cn('w-5 h-5', activeTab === tab.key && 'text-[var(--theme-primary)]')} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col bg-[var(--theme-chat-bg)] min-h-0">
          {/* 内容头部 - PC端 */}
          <div className="hidden sm:flex items-center justify-between px-8 py-5 bg-[var(--theme-header-bg)] border-b border-[var(--theme-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary)] flex items-center justify-center shadow-lg">
                <currentTab.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--theme-text-primary)]">{currentTab.label}</h3>
                <p className="text-xs text-[var(--theme-text-muted)]">自定义配置选项</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-xl transition-colors">
              <X className="w-5 h-5 text-[var(--theme-text-muted)]" />
            </button>
          </div>

        {/* 内容区 - 跟随主题 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 min-h-0 pb-safe">
          {activeTab === 'profile' && (
            <>
              {/* 头像设置卡片 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)]">
                  <h4 className="font-medium text-[var(--theme-text-primary)]">头像设置</h4>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--theme-text-primary)]">我的头像</p>
                        <p className="text-xs text-[var(--theme-text-muted)]">展示给 AI 看到的你</p>
                      </div>
                    </div>
                    <AvatarUpload
                      value={userInfo.avatar}
                      onChange={(base64) => setUserInfo({ avatar: base64 })}
                      size="sm"
                      shape="rounded"
                      placeholder={<User className="w-6 h-6 text-[var(--theme-text-muted)]" />}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--theme-text-primary)]">AI 头像</p>
                      <p className="text-xs text-[var(--theme-text-muted)]">点开人设列表，对单个人设点"头像"修改</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 昵称卡片 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5">
                <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">我的昵称</label>
                <input
                  value={userInfo.name}
                  onChange={(e) => setUserInfo({ name: e.target.value })}
                  placeholder="输入昵称"
                  className={inputClass}
                />
              </div>

              {/* 聊天背景 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)]">
                  <h4 className="font-medium text-[var(--theme-text-primary)]">聊天背景</h4>
                </div>
                <div className="p-5">
                  <div 
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                    onClick={() => document.getElementById('bg-upload')?.click()}
                  >
                    {resolvedBgImage ? (
                      <div className="relative inline-block">
                        <img src={resolvedBgImage} className="w-32 h-20 rounded-lg object-cover" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setUserInfo({ backgroundImage: '' }) }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                        >✕</button>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <Image className="w-6 h-6 text-[var(--theme-text-muted)]" />
                        </div>
                        <p className="text-sm text-[var(--theme-text-muted)]">点击上传背景图片</p>
                        <p className="text-xs text-[var(--theme-text-muted)] mt-1">支持 JPG、PNG 格式</p>
                      </>
                    )}
                  </div>
                </div>
                <input
                  id="bg-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      setUserInfo({ backgroundImage: ev.target?.result as string })
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
              </div>

              <p className="text-xs text-[var(--theme-text-muted)] text-center">🔒 所有数据存储在浏览器本地，不会上传到服务器</p>
            </>
          )}

          {activeTab === 'api' && (
            <>
              {/* 未配置警告 */}
              {!apiConfig.apiKey && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-200 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">⚠️</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-800">API Key 未配置</p>
                      <p className="text-xs text-red-600 mt-0.5">请在下方填写 API Key 才能正常使用聊天功能</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 一键申请 API */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">🎁 没有 API Key？</p>
                    <p className="text-xs text-green-600 mt-0.5">推荐使用 WeAPIs，支持多种模型</p>
                  </div>
                  <a
                    href="https://ai.feishu.cn/wiki/DDh6waPHoiHd7WkvQqOclLNUn34"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                  >
                    一键申请
                  </a>
                </div>
              </div>

              {/* 接口配置 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)]">
                  <h4 className="font-medium text-[var(--theme-text-primary)]">接口配置</h4>
                  <p className="text-xs text-[var(--theme-text-muted)] mt-1">支持 OpenAI 兼容接口（DeepSeek、Azure 等）</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* API 服务商选择 */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">API 服务商</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedProvider}
                        onChange={(e) => {
                          const provider = e.target.value
                          setSelectedProvider(provider)
                          const found = API_PROVIDERS.find(p => p.value === provider)
                          if (found && found.url) {
                            setApiConfig({ apiBaseUrl: found.url })
                            setCustomApiUrl(found.url)
                            // 如果有预设模型，自动选择第一个
                            const models = getModelsForProvider(found.url)
                            if (models.length > 0) {
                              setGptConfig({ model: models[0].value })
                              setCustomModelMode(false)
                            }
                          } else {
                            setCustomModelMode(true)
                          }
                        }}
                        className={cn(inputClass, 'cursor-pointer flex-1')}
                      >
                        {API_PROVIDERS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* 自定义 API URL */}
                  {selectedProvider === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">API Base URL</label>
                      <input
                        value={customApiUrl}
                        onChange={(e) => {
                          setCustomApiUrl(e.target.value)
                          setApiConfig({ apiBaseUrl: e.target.value })
                        }}
                        placeholder="https://api.openai.com/v1"
                        className={inputClass}
                        autoComplete="off"
                        name="api-base-url"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiConfig.apiKey}
                        onChange={(e) => setApiConfig({ apiKey: e.target.value })}
                        placeholder="sk-..."
                        className={cn(inputClass, 'pr-10')}
                        autoComplete="new-password"
                        name="api-key"
                      />
                      <button 
                        onClick={() => setShowApiKey(!showApiKey)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)]"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 模型选择 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5 space-y-3">
                <label className="block text-sm font-medium text-[var(--theme-text-primary)]">选择模型</label>
                {(() => {
                  const providerModels = getModelsForProvider(apiConfig.apiBaseUrl)
                  const hasPresetModels = providerModels.length > 0
                  
                  if (!customModelMode && hasPresetModels) {
                    return (
                      <div className="flex gap-2">
                        <select
                          value={providerModels.some(m => m.value === gptConfig.model) ? gptConfig.model : providerModels[0]?.value}
                          onChange={(e) => setGptConfig({ model: e.target.value })}
                          className={cn(inputClass, 'cursor-pointer flex-1')}
                        >
                          {providerModels.map((m) => (
                            <option key={m.value} value={m.value}>{m.text}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setCustomModelMode(true)}
                          className="px-3 py-2 text-sm border border-[var(--theme-border)] rounded-lg hover:bg-black/5 transition-colors text-[var(--theme-text-secondary)]"
                        >
                          自定义
                        </button>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="flex gap-2">
                      <input
                        value={gptConfig.model}
                        onChange={(e) => setGptConfig({ model: e.target.value })}
                        placeholder="输入模型名称，如 gpt-4o"
                        className={cn(inputClass, 'flex-1')}
                      />
                      {hasPresetModels && (
                        <button
                          onClick={() => setCustomModelMode(false)}
                          className="px-3 py-2 text-sm border border-[var(--theme-border)] rounded-lg hover:bg-black/5 transition-colors text-[var(--theme-text-secondary)]"
                        >
                          选择
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* 参数调整 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)]">
                  <h4 className="font-medium text-[var(--theme-text-primary)]">参数调整</h4>
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--theme-text-secondary)]">上下文轮数</span>
                      <span className="text-sm font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{gptConfig.talkCount}</span>
                    </div>
                    <input type="range" min="1" max="50" value={gptConfig.talkCount}
                      onChange={(e) => setGptConfig({ talkCount: Number(e.target.value) })} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--theme-text-secondary)]">随机性 (Temperature)</span>
                      <span className="text-sm font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{gptConfig.temperature}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.1" value={gptConfig.temperature}
                      onChange={(e) => setGptConfig({ temperature: Number(e.target.value) })} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--theme-text-secondary)]">最大 Token</span>
                      <span className="text-sm font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{gptConfig.maxTokens}</span>
                    </div>
                    <input type="range" min="256" max="4096" step="256" value={gptConfig.maxTokens}
                      onChange={(e) => setGptConfig({ maxTokens: Number(e.target.value) })} 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                  </div>
                </div>
              </div>

              {/* 功能开关 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text-primary)]">自动记忆整理</p>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">AI 会自动总结对话生成记忆</p>
                  </div>
                  <Switch checked={gptConfig.autoMemoryOrganize} 
                    onChange={() => setGptConfig({ autoMemoryOrganize: !gptConfig.autoMemoryOrganize })} />
                </div>
                {gptConfig.autoMemoryOrganize && (
                  <div className="mt-4 pt-4 border-t border-[var(--theme-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--theme-text-secondary)]">整理阈值（消息数）</span>
                      <span className="text-sm font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{gptConfig.memoryOrganizeCount || 30}</span>
                    </div>
                    <input type="range" min="5" max="50" value={gptConfig.memoryOrganizeCount || 30}
                      onChange={(e) => setGptConfig({ memoryOrganizeCount: Number(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">每发送 {gptConfig.memoryOrganizeCount || 30} 条消息自动整理一次记忆</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <Key className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">请妥善保管你的 API Key，不要泄露给他人</p>
              </div>
            </>
          )}

          {activeTab === 'smart' && (
            <>
              {/* 功能开关 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text-primary)]">图片识别</p>
                    <p className="text-xs text-[var(--theme-text-muted)]">AI 可识别上传的图片</p>
                  </div>
                  <Switch checked={visionConfig.enabled} 
                    onChange={() => setVisionConfig({ enabled: !visionConfig.enabled })} />
                </div>
                <div className="border-t border-[var(--theme-border)] pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text-primary)]">联网搜索</p>
                    <p className="text-xs text-[var(--theme-text-muted)]">AI 可搜索实时信息</p>
                  </div>
                  <Switch checked={onlineSearchConfig.enabled} 
                    onChange={() => setOnlineSearchConfig({ enabled: !onlineSearchConfig.enabled })} />
                </div>
                <div className="border-t border-[var(--theme-border)] pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text-primary)]">表情回复</p>
                    <p className="text-xs text-[var(--theme-text-muted)]">AI 可发送表情</p>
                  </div>
                  <Switch checked={emojiConfig.enabled} 
                    onChange={() => setEmojiConfig({ enabled: !emojiConfig.enabled })} />
                </div>
                <div className="border-t border-[var(--theme-border)] pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text-primary)]">主动消息</p>
                    <p className="text-xs text-[var(--theme-text-muted)]">AI 会在空闲时发起对话</p>
                  </div>
                  <Switch checked={autoMessageConfig.enabled} 
                    onChange={() => setAutoMessageConfig({ enabled: !autoMessageConfig.enabled })} />
                </div>
              </div>

              {/* 表情概率 */}
              {emojiConfig.enabled && (
                <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--theme-text-secondary)]">表情发送概率</span>
                    <span className="text-sm font-medium text-[var(--theme-primary)]">{emojiConfig.probability}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={emojiConfig.probability}
                    onChange={(e) => setEmojiConfig({ probability: Number(e.target.value) })} 
                    className="w-full h-2 bg-[var(--theme-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]" />
                </div>
              )}

              {/* 主动消息间隔 */}
              {autoMessageConfig.enabled && (
                <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--theme-text-secondary)]">消息间隔</span>
                      <span className="text-sm font-medium text-[var(--theme-primary)]">{autoMessageConfig.minInterval}-{autoMessageConfig.maxInterval} 分钟</span>
                    </div>
                    <input type="range" min="5" max="180" step="5" value={autoMessageConfig.minInterval}
                      onChange={(e) => setAutoMessageConfig({ minInterval: Number(e.target.value) })} 
                      className="w-full h-2 bg-[var(--theme-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--theme-text-primary)]">安静时间</p>
                      <p className="text-xs text-[var(--theme-text-muted)]">{quietTimeConfig.startTime} - {quietTimeConfig.endTime}</p>
                    </div>
                    <Switch checked={quietTimeConfig.enabled} 
                      onChange={() => setQuietTimeConfig({ enabled: !quietTimeConfig.enabled })} />
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-[var(--theme-text-muted)] mb-4">选择你喜欢的界面风格</p>
                <ThemeSwitcher />
              </div>
              
              {/* 小手机模式 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                      <span className="text-lg">📱</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--theme-text-primary)]">小手机模式</p>
                      <p className="text-xs text-[var(--theme-text-muted)]">沉浸式手机体验</p>
                    </div>
                  </div>
                  <Switch 
                    checked={useConfigStore.getState().phoneMode} 
                    onChange={() => useConfigStore.getState().setPhoneMode(!useConfigStore.getState().phoneMode)} 
                  />
                </div>
              </div>

              {/* 锁屏设置 */}
              <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center">
                      <span className="text-lg">🔒</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--theme-text-primary)]">锁屏保护</p>
                      <p className="text-xs text-[var(--theme-text-muted)]">移动端无操作自动锁屏</p>
                    </div>
                  </div>
                  <Switch 
                    checked={useConfigStore.getState().lockScreenConfig?.enabled ?? false} 
                    onChange={() => useConfigStore.getState().setLockScreenConfig({ 
                      enabled: !useConfigStore.getState().lockScreenConfig?.enabled 
                    })} 
                  />
                </div>
                {useConfigStore.getState().lockScreenConfig?.enabled && (
                  <div className="pt-2 border-t border-[var(--theme-border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--theme-text-muted)]">超时时间</span>
                      <select
                        value={useConfigStore.getState().lockScreenConfig?.timeout ?? 60}
                        onChange={(e) => useConfigStore.getState().setLockScreenConfig({ 
                          timeout: parseInt(e.target.value) 
                        })}
                        className="px-3 py-1.5 rounded-lg bg-[var(--theme-chat-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text-primary)]"
                      >
                        <option value={30}>30 秒</option>
                        <option value={60}>1 分钟</option>
                        <option value={120}>2 分钟</option>
                        <option value={300}>5 分钟</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 存储统计 */}
              <StorageStatsPanel />
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

/** 存储统计面板 */
function StorageStatsPanel() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)
  const stats = getStorageStats()

  const handleClear = () => {
    clearAll()
    reloadStores()
    setShowConfirm(false)
    window.location.reload()
  }

  const handleExport = async () => {
    await downloadExport(false)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    setImportResult(null)
    
    try {
      const result = await importFile(file, { merge: false })
      setImportResult(result)
      
      if (result.success) {
        // 刷新页面以加载新数据
        setTimeout(() => {
          reloadStores()
          window.location.reload()
        }, 1500)
      }
    } catch (error) {
      setImportResult({ success: false, message: String(error) })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-[var(--theme-input-bg)] rounded-2xl border border-[var(--theme-border)] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--theme-text-primary)]">数据管理</p>
          <p className="text-xs text-[var(--theme-text-muted)]">数据版本 {stats.version}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-[var(--theme-chat-bg)]">
          <div className="text-[var(--theme-text-muted)]">人设数量</div>
          <div className="text-lg font-semibold text-[var(--theme-text-primary)]">{stats.personaCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--theme-chat-bg)]">
          <div className="text-[var(--theme-text-muted)]">消息数量</div>
          <div className="text-lg font-semibold text-[var(--theme-text-primary)]">{stats.messageCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--theme-chat-bg)]">
          <div className="text-[var(--theme-text-muted)]">记忆数量</div>
          <div className="text-lg font-semibold text-[var(--theme-text-primary)]">{stats.memoryCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--theme-chat-bg)]">
          <div className="text-[var(--theme-text-muted)]">存储大小</div>
          <div className="text-lg font-semibold text-[var(--theme-text-primary)]">{formatStorageSize(stats.totalSize)}</div>
        </div>
      </div>

      {/* 导入导出按钮 */}
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-xs hover:opacity-90 transition-colors flex items-center justify-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          导出数据
        </button>
        <label className="flex-1 py-2 border border-[var(--theme-primary)] text-[var(--theme-primary)] rounded-lg text-xs hover:bg-[var(--theme-primary)]/10 transition-colors flex items-center justify-center gap-1 cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          {importing ? '导入中...' : '导入数据'}
          <input
            type="file"
            accept=".json,.zip"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {/* 导入提示 */}
      <div className="p-3 rounded-lg bg-[var(--theme-chat-bg)] text-xs text-[var(--theme-text-muted)]">
        <div className="flex items-center gap-2 mb-1">
          <FileJson className="w-3.5 h-3.5" />
          <span>支持 .json（新版导出）</span>
        </div>
        <div className="flex items-center gap-2">
          <FolderArchive className="w-3.5 h-3.5" />
          <span>支持 .zip（旧版备份目录）</span>
        </div>
      </div>

      {/* 导入结果 */}
      {importResult && (
        <div className={cn(
          'p-3 rounded-lg text-xs',
          importResult.success 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {importResult.message}
        </div>
      )}

      {showConfirm ? (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
          <p className="text-xs text-red-700">确定要清除所有数据吗？此操作不可恢复！</p>
          <div className="flex gap-2">
            <button onClick={handleClear} className="flex-1 py-1.5 bg-red-500 text-white rounded text-xs hover:bg-red-600">确认清除</button>
            <button onClick={() => setShowConfirm(false)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">取消</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-xs hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          清除所有数据
        </button>
      )}
    </div>
  )
}
