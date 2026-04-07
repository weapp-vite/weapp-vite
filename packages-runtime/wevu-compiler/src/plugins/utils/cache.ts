import { LRUCache } from 'lru-cache'
import * as fs from '../../utils/fs'
import { normalizeLineEndings } from '../../utils/text'

export const mtimeCache = new Map<string, { ctimeMs: number, ino: number, mtimeMs: number, size: number }>()

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
  const ctimeMs = typeof (stats as any)?.ctimeMs === 'number' ? (stats as any).ctimeMs : Number.NaN
  const size = typeof (stats as any)?.size === 'number' ? (stats as any).size : Number.NaN
  const ino = typeof (stats as any)?.ino === 'number' ? (stats as any).ino : Number.NaN
  if (!Number.isFinite(mtimeMs)) {
    return true
  }
  if (!Number.isFinite(ctimeMs)) {
    return true
  }
  if (!Number.isFinite(size)) {
    return true
  }
  if (!Number.isFinite(ino)) {
    return true
  }
  if (cached === undefined) {
    mtimeCache.set(id, { mtimeMs, ctimeMs, size, ino })
    return true
  }

  // 原子保存/rename 替换下，mtime 和 size 可能都保持不变；补充 ctime/ino 以识别同长度快速连续写入。
  if (
    cached.mtimeMs === mtimeMs
    && cached.ctimeMs === ctimeMs
    && cached.size === size
    && cached.ino === ino
  ) {
    return false
  }

  mtimeCache.set(id, { mtimeMs, ctimeMs, size, ino })
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
    const content = normalizeLineEndings(await fs.readFile(id, encoding))
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

  const content = normalizeLineEndings(await fs.readFile(id, encoding))
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
