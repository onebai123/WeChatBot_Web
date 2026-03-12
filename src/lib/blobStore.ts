/**
 * IndexedDB Blob 存储服务
 * 用于存储 base64 图片/语音等大数据，避免撑爆 localStorage
 *
 * iOS Safari 兼容：IndexedDB 不可用时自动降级为 localStorage 模式
 * （saveBlobSync 返回原始 base64，不会崩溃）
 */

const DB_NAME = 'wechatbot-blobs'
const DB_VERSION = 1
const STORE_NAME = 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null
let pendingWrites = 0
let idbDisabled = false

/** 检测 IndexedDB 是否可用（iOS 隐私浏览 / 旧版 WebView 可能不可用） */
function checkIDBAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (typeof indexedDB === 'undefined') return false
    // iOS Safari 隐私浏览模式下 indexedDB 存在但 open 会抛异常
    // 用 try-catch 包住以防万一
    return true
  } catch {
    return false
  }
}

// 页面关闭前检查是否有未完成的写入
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (pendingWrites > 0) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}

function openDB(): Promise<IDBDatabase> {
  if (idbDisabled) return Promise.reject(new Error('IndexedDB disabled'))
  if (dbPromise) return dbPromise
  
  if (!checkIDBAvailable()) {
    idbDisabled = true
    console.warn('[BlobStore] IndexedDB 不可用，降级为 localStorage 模式')
    return Promise.reject(new Error('IndexedDB not available'))
  }
  
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onupgradeneeded = () => {
        try {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        } catch (e) {
          reject(e)
        }
      }
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        dbPromise = null
        idbDisabled = true
        console.warn('[BlobStore] IndexedDB 打开失败，降级为 localStorage 模式')
        reject(request.error)
      }
      request.onblocked = () => {
        dbPromise = null
        reject(new Error('IndexedDB blocked'))
      }
    } catch (e) {
      // iOS Safari 隐私浏览模式下 indexedDB.open() 可能直接抛异常
      dbPromise = null
      idbDisabled = true
      console.warn('[BlobStore] IndexedDB 不可用（可能是隐私浏览模式），降级为 localStorage 模式')
      reject(e)
    }
  })
  
  return dbPromise
}

/** 根据内容生成确定性 key（同一份数据永远得到同一个 key） */
function contentKey(data: string): string {
  const len = data.length
  const mid = Math.floor(len / 2)
  const sample = data.slice(0, 64) + data.slice(mid, mid + 64) + data.slice(-64)
  let hash = len
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i)
    hash |= 0
  }
  return `blob:${len.toString(36)}-${Math.abs(hash).toString(36)}`
}

/** 判断是否是 blob 引用 */
export function isBlobRef(value?: string): boolean {
  return !!value && value.startsWith('blob:')
}

/** 判断是否是 base64 数据 */
export function isBase64Data(value?: string): boolean {
  return !!value && value.startsWith('data:')
}

/**
 * 同步返回 blob 引用 ID，IndexedDB 写入在后台完成
 * 同一份 base64 永远得到同一个 key，重复写入只是覆盖，不会重复占用空间
 *
 * **降级**：IndexedDB 不可用时直接返回原始 base64（不转存）
 */
export function saveBlobSync(data: string): string {
  if (idbDisabled) return data

  const key = contentKey(data)
  pendingWrites++
  openDB().then(db => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, key)
    tx.oncomplete = () => { pendingWrites-- }
    tx.onerror = () => { pendingWrites-- }
  }).catch(() => { pendingWrites-- })
  return key
}

/** 异步保存 base64 数据到 IndexedDB，返回引用 ID */
export async function saveBlob(data: string): Promise<string> {
  if (idbDisabled) return data
  const db = await openDB()
  const key = contentKey(data)
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, key)
    tx.oncomplete = () => resolve(key)
    tx.onerror = () => reject(tx.error)
  })
}

/** 从 IndexedDB 读取 base64 数据 */
export async function getBlob(id: string): Promise<string | null> {
  if (idbDisabled) return null
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/** 删除指定 blob */
export async function deleteBlob(id: string): Promise<void> {
  if (idbDisabled) return
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // 静默失败
  }
}

/** 获取所有 blob（用于导出） */
export async function getAllBlobs(): Promise<Record<string, string>> {
  if (idbDisabled) return {}
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const result: Record<string, string> = {}
      
      const request = store.openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          result[cursor.key as string] = cursor.value
          cursor.continue()
        } else {
          resolve(result)
        }
      }
      request.onerror = () => resolve({})
    })
  } catch {
    return {}
  }
}

/** 清空所有 blob */
export async function clearAllBlobs(): Promise<void> {
  if (idbDisabled) return
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // 静默失败
  }
}
