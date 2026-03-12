'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { Sidebar } from '@/components/layout/Sidebar'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { PersonaDrawer } from '@/components/persona/PersonaDrawer'
import { LockScreen } from '@/components/common/LockScreen'
import { usePersonaStore } from '@/store/personaStore'
import { useConfigStore } from '@/store/configStore'
import { initializeStores, setupAutoSave } from '@/store/init'

// 移动端断点 (sm: 640px)
const MOBILE_BREAKPOINT = 640

export default function Home() {
  const { personas, activePersonaId, setActive } = usePersonaStore()
  const { phoneMode, lockScreenConfig } = useConfigStore()
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [initError, setInitError] = useState<Error | null>(null)
  
  // 小手机模式：PC端也使用移动端布局
  const isMobileLayout = isMobile || phoneMode
  const [showSettings, setShowSettings] = useState(false)
  const [showPersona, setShowPersona] = useState(false)
  const [autoShowAdd, setAutoShowAdd] = useState(false)
  const [isLocked, setIsLocked] = useState(false)  // 默认不锁屏
  
  // 客户端挂载后初始化 Store 并渲染动态内容
  useEffect(() => {
    try {
      initializeStores()
      setupAutoSave()
      setMounted(true)
    } catch (e) {
      console.error('[Home] 初始化失败:', e)
      setInitError(e instanceof Error ? e : new Error(String(e)))
    }
  }, [])

  // 初始化失败时抛出错误，由 error.tsx 接管渲染
  if (initError) {
    throw initError
  }
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const LOCK_TIMEOUT = (lockScreenConfig?.timeout || 60) * 1000 // 无操作自动锁屏
  
  // 滑动手势相关
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const mainRef = useRef<HTMLElement>(null)
  const SWIPE_THRESHOLD = 80
  
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    
    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }
    
    const onTouchEnd = (e: TouchEvent) => {
      if (!isMobileLayout || isLocked) return
      
      const deltaX = e.changedTouches[0].clientX - touchStartX.current
      const deltaY = e.changedTouches[0].clientY - touchStartY.current
      
      // 确保是水平滑动
      if (Math.abs(deltaX) < Math.abs(deltaY) * 2) return
      
      // 右滑打开菜单（从左边缘30px内开始）
      if (deltaX > SWIPE_THRESHOLD && touchStartX.current < 30 && !sidebarOpen) {
        setSidebarOpen(true)
      }
      // 左滑关闭菜单
      else if (deltaX < -SWIPE_THRESHOLD && sidebarOpen) {
        setSidebarOpen(false)
      }
    }
    
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobileLayout, isLocked, sidebarOpen])

  // 重置锁屏计时器
  const resetLockTimer = useCallback(() => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current)
    }
    // 仅在启用锁屏且在移动端时启动计时器
    if (lockScreenConfig?.enabled && isMobile && !isLocked) {
      lockTimeoutRef.current = setTimeout(() => {
        setIsLocked(true)
      }, LOCK_TIMEOUT)
    }
  }, [isMobile, isLocked, lockScreenConfig?.enabled, LOCK_TIMEOUT])

  useEffect(() => {
    // 如果没有选中人设，默认选中第一个
    if (!activePersonaId && personas.length > 0) {
      setActive(personas[0].id)
    }
    // 检测移动端
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [activePersonaId, personas, setActive])

  // 自动锁屏逻辑
  useEffect(() => {
    if (!isMobile || !lockScreenConfig?.enabled) return
    
    // 监听用户活动
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll']
    events.forEach(event => window.addEventListener(event, resetLockTimer))
    
    // 页面失去焦点时锁屏
    const handleVisibilityChange = () => {
      if (document.hidden && isMobile && lockScreenConfig?.enabled) {
        setIsLocked(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // 初始化计时器
    resetLockTimer()
    
    return () => {
      events.forEach(event => window.removeEventListener(event, resetLockTimer))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current)
    }
  }, [isMobile, lockScreenConfig?.enabled, resetLockTimer])

  const handleOpenSettings = () => {
    setShowSettings(true)
    if (isMobile) setSidebarOpen(false)
  }

  const handleOpenPersona = (autoAdd = false) => {
    setAutoShowAdd(autoAdd)
    setShowPersona(true)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <>
      {/* 锁屏页面 - 仅客户端渲染 */}
      {mounted && isLocked && (
        <LockScreen onUnlock={() => setIsLocked(false)} />
      )}
      
      {/* 小手机模式容器 */}
      <div className={mounted && phoneMode && !isMobile ? 'flex items-center justify-center min-h-screen bg-gray-900 p-4' : ''}>
        <main 
          ref={mainRef}
          className={`flex h-screen h-[100dvh] bg-[var(--theme-chat-bg)] overflow-hidden ${
            mounted && phoneMode && !isMobile ? 'w-[390px] h-[844px] rounded-[40px] shadow-2xl border-8 border-gray-800 relative' : ''
          }`}
        >
        
        {/* 小手机模式顶部刘海 */}
        {mounted && phoneMode && !isMobile && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-800 rounded-b-2xl z-50" />
        )}
        
        {/* 移动端遮罩 */}
        {isMobileLayout && sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSidebarOpen(false)} />
        )}

        {/* 侧边栏 */}
        <div
          className={`
            ${isMobileLayout ? 'fixed z-50 h-full transition-transform duration-300 ease-out' : 'flex-shrink-0'}
            ${isMobileLayout && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
          `}
        >
          <Sidebar 
            onSelectChat={() => isMobileLayout && setSidebarOpen(false)} 
            onOpenSettings={handleOpenSettings}
            onOpenPersona={() => handleOpenPersona(false)}
            onAddPersona={() => handleOpenPersona(true)}
          />
        </div>

        {/* 聊天区域 */}
        <ChatContainer
          onMenuClick={() => setSidebarOpen(true)}
          showMenuButton={isMobileLayout}
          onLock={() => setIsLocked(true)}
        />

      {/* 设置弹窗 */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />

      {/* 人设抽屉 */}
      <PersonaDrawer 
        open={showPersona} 
        onClose={() => { setShowPersona(false); setAutoShowAdd(false) }}
        autoShowAdd={autoShowAdd}
      />
    </main>
      </div>
    </>
  )
}
