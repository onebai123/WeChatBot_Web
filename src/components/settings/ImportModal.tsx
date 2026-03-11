'use client'

import { useState, useRef } from 'react'
import { X, FileJson, FolderArchive, Folder, Check, AlertCircle, Download } from 'lucide-react'
import { importFile, importFromDirectory } from '@/lib/importService'
import { downloadExport } from '@/lib/dataService'
import { reloadStores } from '@/store/init'

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    stats?: { personaCount: number; messageCount: number; memoryCount: number; emojiCount: number }
  } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'json' && ext !== 'zip') {
      showMessage('error', '仅支持 JSON 或 ZIP 文件')
      return
    }

    await doImport(() => importFile(file))
  }

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    // 获取选择的目录名
    const firstFile = files[0]
    const dirName = firstFile.webkitRelativePath?.split('/')[0] || '未知'
    console.log('[ImportModal] 用户选择的目录:', dirName)
    
    // 复制 FileList 因为清空 input 后会失效
    const fileArray: File[] = []
    for (let i = 0; i < files.length; i++) {
      fileArray.push(files[i])
    }
    e.target.value = ''

    showMessage('info', `正在导入: ${dirName}`)
    await doImport(() => importFromDirectory(fileArray))
  }

  const doImport = async (importFn: () => Promise<{ success: boolean; message?: string; stats?: { personaCount: number; messageCount: number; memoryCount: number; emojiCount: number } }>) => {
    setImporting(true)
    setImportResult(null)

    try {
      const result = await importFn()

      if (result.success) {
        setImportResult({ success: true, stats: result.stats })
        // 重新加载 Store 数据
        reloadStores()
        showMessage('success', result.message || '导入成功')
      } else {
        setImportResult({ success: false })
        showMessage('error', result.message || '导入失败')
      }
    } catch (err) {
      showMessage('error', '文件读取失败')
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setImportResult(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-[var(--theme-chat-bg)] rounded-xl shadow-xl w-[450px] max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border)]">
          <h2 className="text-lg font-semibold text-[var(--theme-text-primary)]">导入数据</h2>
          <button onClick={handleClose} className="p-1 hover:bg-[var(--theme-border)]/50 rounded">
            <X className="w-5 h-5 text-[var(--theme-text-secondary)]" />
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mx-6 mt-4 px-3 py-2 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' 
            : message.type === 'error' ? 'bg-red-50 text-red-700' 
            : 'bg-blue-50 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 隐藏的文件输入 */}
          <input ref={fileInputRef} type="file" accept=".json,.zip" onChange={handleFileUpload} className="hidden" />
          <input ref={folderInputRef} type="file" {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>} onChange={handleFolderUpload} className="hidden" />
          
          {/* 统一上传区域 */}
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              importing ? 'border-[var(--theme-border)] bg-[var(--theme-sidebar-bg)]' : 'border-[var(--theme-primary)]'
            }`}
          >
            <div className="flex justify-center gap-2 mb-3">
              <FileJson className={`w-10 h-10 ${importing ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-primary)]'}`} />
              <FolderArchive className={`w-10 h-10 ${importing ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-primary)]'}`} />
              <Folder className={`w-10 h-10 ${importing ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-primary)]'}`} />
            </div>
            
            <p className="text-sm font-medium text-[var(--theme-text-primary)] mb-3">
              {importing ? '导入中...' : '选择备份来源'}
            </p>
            
            <div className="flex flex-col gap-3">
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => !importing && fileInputRef.current?.click()}
                  disabled={importing}
                  className="px-4 py-2 text-sm rounded-lg bg-[var(--theme-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  选择文件
                </button>
                <button
                  onClick={() => !importing && folderInputRef.current?.click()}
                  disabled={importing}
                  className="px-4 py-2 text-sm rounded-lg border border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 disabled:opacity-50 transition-colors"
                >
                  选择文件夹
                </button>
              </div>
              
              <div className="text-xs text-[var(--theme-text-muted)] space-y-0.5">
                <p><span className="text-[var(--theme-text-secondary)]">选择文件：</span>新版 .json 备份 或 旧版 .zip 备份</p>
                <p><span className="text-[var(--theme-text-secondary)]">选择文件夹：</span>旧版 WeChatBot 目录（含 prompts/）</p>
              </div>
            </div>
          </div>

          {/* 导入结果 */}
          {importResult && (
            <div className={`p-4 rounded-lg ${importResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`flex items-center gap-2 font-medium mb-2 ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {importResult.success ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {importResult.success ? '导入成功' : '导入失败'}
              </div>
              {importResult.stats && (
                <div className="grid grid-cols-2 gap-2 text-xs text-green-600">
                  <div>人设: {importResult.stats.personaCount}</div>
                  <div>消息: {importResult.stats.messageCount}</div>
                  <div>记忆: {importResult.stats.memoryCount}</div>
                  <div>表情: {importResult.stats.emojiCount}</div>
                </div>
              )}
            </div>
          )}

          {/* 提示 */}
          <div className="p-3 rounded-lg bg-amber-50 text-xs text-amber-700">
            <strong>注意：</strong>导入将覆盖当前所有数据，请确保已备份重要数据。
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-[var(--theme-border)] flex items-center justify-between">
          <button
            onClick={async () => {
              await downloadExport()
              showMessage('success', '导出成功')
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]/50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出备份
          </button>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-[var(--theme-sidebar-bg)] text-[var(--theme-text-secondary)] rounded-lg text-sm hover:bg-[var(--theme-border)]/50 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
