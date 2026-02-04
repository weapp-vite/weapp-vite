import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'

export const mtimeCache = new Map<string, { mtimeMs: number, size: number }>()

export const loadCache = new LRUCache<string, string>({
  max: 1024,
})

const pathExistsCache = new LRUCache<string, boolean>({
  max: 4096,
})

/**
 * 返回 true 的时候需要重新 fs 读取
 * @param id 文件路径
 * @returns {Promise<boolean>} 当文件需要重新读取时返回 true
 */
export async function isInvalidate(id: string) {
  // 上次的文件签名
  const cached = mtimeCache.get(id)
  // 本次文件签名
  const stats = await fs.stat(id)
  const mtimeMs = typeof (stats as any)?.mtimeMs === 'number' ? (stats as any).mtimeMs : Number.NaN
  const size = typeof (stats as any)?.size === 'number' ? (stats as any).size : Number.NaN
  if (!Number.isFinite(mtimeMs)) {
    return true
  }
  if (!Number.isFinite(size)) {
    return true
  }
  if (cached === undefined) {
    mtimeCache.set(id, { mtimeMs, size })
    return true
  }

  // mtimeMs 在某些文件系统/编辑器保存策略下可能不递增（甚至相等），仅比较 mtime 会漏掉变更。
  // 这里同时比较 size，优先保证正确性。
  if (cached.mtimeMs === mtimeMs && cached.size === size) {
    return false
  }

  mtimeCache.set(id, { mtimeMs, size })
  return true
}

export async function readFile(
  id: string,
  options?: { checkMtime?: boolean, encoding?: BufferEncoding },
): Promise<string> {
  const checkMtime = options?.checkMtime ?? true
  const encoding = options?.encoding ?? 'utf8'
  if (!checkMtime) {
    const cached = loadCache.get(id)
    if (cached !== undefined) {
      return cached
    }
    const content = await fs.readFile(id, encoding)
    loadCache.set(id, content)
    return content
  }

  const invalid = await isInvalidate(id)
  if (!invalid) {
    const cached = loadCache.get(id)
    if (cached !== undefined) {
      return cached
    }
  }

  const content = await fs.readFile(id, encoding)
  loadCache.set(id, content)
  return content
}

/**
 * 判断文件或路径是否存在，可选缓存。
 */
export async function pathExists(
  id: string,
  options?: { ttlMs?: number },
): Promise<boolean> {
  const ttlMs = options?.ttlMs
  const cached = pathExistsCache.get(id)
  if (cached !== undefined) {
    return cached
  }
  const exists = await fs.pathExists(id)
  if (typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0) {
    pathExistsCache.set(id, exists, { ttl: ttlMs })
  }
  else {
    pathExistsCache.set(id, exists)
  }
  return exists
}

/**
 * 清理指定文件相关的缓存。
 */
export function invalidateFileCache(id: string) {
  mtimeCache.delete(id)
  loadCache.delete(id)
  pathExistsCache.delete(id)
}

/**
 * 清空所有文件缓存。
 */
export function clearFileCaches() {
  mtimeCache.clear()
  loadCache.clear()
  pathExistsCache.clear()
}
