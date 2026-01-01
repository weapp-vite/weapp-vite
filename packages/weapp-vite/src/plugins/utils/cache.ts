import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'

export const mtimeCache = new Map<string, number>()

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
  // 上次的修改时间
  const cachedMtime = mtimeCache.get(id)
  // 本次修改时间
  const stats = await fs.stat(id)
  const mtimeMs = typeof (stats as any)?.mtimeMs === 'number' ? (stats as any).mtimeMs : Number.NaN
  if (!Number.isFinite(mtimeMs)) {
    return true
  }
  if (cachedMtime === undefined) {
    mtimeCache.set(id, mtimeMs)
    return true
  }
  // 上次修改时间 >= 本次修改时间
  else if (cachedMtime >= mtimeMs) {
    // 走缓存
    return false
  }
  else {
    mtimeCache.set(id, mtimeMs)
    return true
  }
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
    const content = await fs.readFile(id, { encoding })
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

  const content = await fs.readFile(id, { encoding })
  loadCache.set(id, content)
  return content
}

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

export function invalidateFileCache(id: string) {
  mtimeCache.delete(id)
  loadCache.delete(id)
  pathExistsCache.delete(id)
}

export function clearFileCaches() {
  mtimeCache.clear()
  loadCache.clear()
  pathExistsCache.clear()
}
