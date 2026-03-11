import { useState, useEffect } from 'react'
import { isBlobRef, getBlob } from '@/lib/blobStore'

const MAX_RETRIES = 3
const RETRY_DELAY = 200 // ms

/**
 * 解析 blob 引用为实际 base64 数据
 * - base64 直接返回
 * - blob 引用异步从 IndexedDB 读取，失败自动重试（应对异步写入延迟）
 */
export function useBlobUrl(value?: string): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(
    value && !isBlobRef(value) ? value : undefined
  )

  useEffect(() => {
    if (!value) {
      setResolved(undefined)
      return
    }

    if (!isBlobRef(value)) {
      setResolved(value)
      return
    }

    let cancelled = false

    const tryResolve = (attempt: number) => {
      getBlob(value).then(data => {
        if (cancelled) return
        if (data) {
          setResolved(data)
        } else if (attempt < MAX_RETRIES) {
          setTimeout(() => tryResolve(attempt + 1), RETRY_DELAY)
        } else {
          console.warn(`[useBlobUrl] blob 引用解析失败: ${value}，IndexedDB 中无数据`)
        }
      }).catch(() => {
        if (!cancelled && attempt < MAX_RETRIES) {
          setTimeout(() => tryResolve(attempt + 1), RETRY_DELAY)
        }
      })
    }

    tryResolve(0)

    return () => { cancelled = true }
  }, [value])

  return resolved
}
