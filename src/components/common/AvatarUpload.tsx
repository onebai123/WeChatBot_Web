'use client'

import { useRef, useState } from 'react'
import { Camera, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBlobUrl } from '@/hooks/useBlobUrl'

interface AvatarUploadProps {
  value?: string
  onChange: (base64: string) => void
  size?: 'sm' | 'md' | 'lg'
  shape?: 'circle' | 'rounded'
  placeholder?: React.ReactNode
  className?: string
  disabled?: boolean
}

const sizeMap = { sm: 'w-10 h-10', md: 'w-16 h-16', lg: 'w-24 h-24' }

export function AvatarUpload({
  value,
  onChange,
  size = 'md',
  shape = 'circle',
  placeholder,
  className,
  disabled,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resolvedValue = useBlobUrl(value)

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB')
      return
    }

    setUploading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      onChange(base64)
      setUploading(false)
    }
    reader.onerror = () => {
      setError('图片读取失败')
      setUploading(false)
    }
    reader.readAsDataURL(file)

    // 清空 input 以允许重复选择同一文件
    e.target.value = ''
  }

  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  return (
    <div className={cn('relative group', className)}>
      <div
        onClick={handleClick}
        className={cn(
          sizeMap[size],
          radiusClass,
          'overflow-hidden cursor-pointer bg-gray-100 flex items-center justify-center',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {resolvedValue ? (
          <img src={resolvedValue} alt="avatar" className="w-full h-full object-cover" />
        ) : placeholder ? (
          placeholder
        ) : (
          <User className="w-1/2 h-1/2 text-gray-400" />
        )}

        {/* 上传遮罩 */}
        {!disabled && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all',
              radiusClass
            )}
          >
            {uploading ? (
              <span className="text-white text-xs">上传中...</span>
            ) : (
              <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
