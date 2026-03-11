'use client'

import { cn } from '@/lib/utils'
import { useBlobUrl } from '@/hooks/useBlobUrl'

interface AvatarProps {
  name?: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  bgColor?: string
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-[42px] h-[42px] text-base',  // 微信风格 42px
  lg: 'w-12 h-12 text-lg',
}

// 根据名字生成一致的颜色
const getColorFromName = (name: string): string => {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ]
  
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// 获取名字的首字（支持中英文）
const getInitial = (name: string): string => {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  
  // 取第一个字符（中文直接取，英文取首字母大写）
  const firstChar = trimmed[0]
  return firstChar.toUpperCase()
}

/**
 * 通用头像组件
 * 如果有图片则显示图片，否则显示名字首字
 */
export function Avatar({ name = '', src, size = 'md', className, bgColor }: AvatarProps) {
  const sizeClass = sizeMap[size]
  const colorClass = bgColor || getColorFromName(name)
  const resolvedSrc = useBlobUrl(src)
  
  if (resolvedSrc) {
    return (
      <div 
        className={cn(sizeClass, 'overflow-hidden flex-shrink-0', className)}
        style={{ borderRadius: 'var(--theme-radius-avatar)' }}
      >
        <img src={resolvedSrc} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }
  
  return (
    <div
      className={cn(
        sizeClass,
        colorClass,
        'flex items-center justify-center text-white font-medium flex-shrink-0',
        className
      )}
      style={{ borderRadius: 'var(--theme-radius-avatar)' }}
    >
      {getInitial(name)}
    </div>
  )
}

// 导出工具函数供其他组件使用
export { getInitial, getColorFromName }
