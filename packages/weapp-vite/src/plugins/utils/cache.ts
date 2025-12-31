import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'

export const mtimeCache = new Map<string, number>()

export const loadCache = new LRUCache<string, string>({
  max: 1024,
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
  const { mtimeMs } = await fs.stat(id)
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

export async function readFile(id: string): Promise<string> {
  const invalid = await isInvalidate(id)
  if (!invalid) {
    const cached = loadCache.get(id)
    if (cached !== undefined) {
      return cached
    }
  }

  const content = await fs.readFile(id, 'utf-8')
  loadCache.set(id, content)
  return content
}
