'use client'

import { useEffect } from 'react'
import { downloadLightweightExport, exportLightweightJson } from '@/lib/dataService'
import { STORAGE_KEY } from '@/types/appData'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ErrorBoundary] 页面崩溃:', error)
  }, [error])

  const hasData = (() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY)
    } catch {
      return false
    }
  })()

  const handleExport = () => {
    try {
      downloadLightweightExport()
    } catch (e) {
      // 如果连导出函数都失败，尝试最原始的方式
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const blob = new Blob([raw], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `wechatbot-raw-backup.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      } catch {
        alert('导出失败，请手动在浏览器控制台执行：\ncopy(localStorage.getItem("wechatbot-data"))')
      }
    }
  }

  const handleClearAndReload = () => {
    if (confirm('确定要清除所有数据吗？建议先导出记录。\n清除后请用无痕模式打开验证。')) {
      try {
        localStorage.removeItem(STORAGE_KEY)
        // 清除 IndexedDB
        try { indexedDB.deleteDatabase('wechatbot-blobs') } catch {}
      } catch {}
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 space-y-5">
        {/* 错误标题 */}
        <div className="text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800">页面加载失败</h1>
          <p className="text-sm text-gray-500 mt-2">
            可能是数据格式不兼容导致，您的聊天记录仍在浏览器中。
          </p>
        </div>

        {/* 错误详情 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-600 font-mono break-all">
            {error?.message || '未知错误'}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          {/* 导出记录 - 最重要的按钮 */}
          {hasData && (
            <button
              onClick={handleExport}
              className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-base transition-colors flex items-center justify-center gap-2"
            >
              📥 导出聊天记录（不含图片）
            </button>
          )}

          {/* 重试 */}
          <button
            onClick={reset}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-base transition-colors"
          >
            🔄 重试加载
          </button>

          {/* 清除数据重新开始 */}
          <button
            onClick={handleClearAndReload}
            className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm transition-colors"
          >
            🗑️ 清除数据并重新开始
          </button>
        </div>

        {/* 提示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
          <p className="text-xs text-blue-700 font-medium">💡 建议操作：</p>
          <ol className="text-xs text-blue-600 list-decimal list-inside space-y-1">
            <li>先点击「导出聊天记录」保存数据</li>
            <li>用浏览器的<strong>无痕/隐私模式</strong>打开本网站验证是否正常</li>
            <li>如果无痕模式正常，点击「清除数据并重新开始」</li>
            <li>然后用「导入」功能恢复之前导出的记录</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
