import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'

export class FileCache<T extends object> {
  cache: LRUCache<string, T>
  mtimeMap: Map<string, number>

  constructor(max: number = 1024) {
    this.cache = new LRUCache<string, T>({
      max,
    })
    this.mtimeMap = new Map()
  }

  get(id: string) {
    return this.cache.get(id)
  }

  set(id: string, content: T) {
    return this.cache.set(id, content)
  }

  delete(id: string) {
    return this.cache.delete(id)
  }

  async isInvalidate(id: string) {
    let mtimeMs: number | undefined
    try {
      // 本次修改时间
      const stat = await fs.stat(id)
      mtimeMs = stat.mtimeMs
    }
    catch (error: any) {
      // 文件在期间被删除或无法访问时，视为缓存失效
      if (error && error.code === 'ENOENT') {
        this.cache.delete(id)
        this.mtimeMap.delete(id)
        return true
      }
      throw error
    }

    // 上次的修改时间
    if (mtimeMs === undefined) {
      return true
    }

    const cachedMtime = this.mtimeMap.get(id)
    if (cachedMtime === undefined) {
      this.mtimeMap.set(id, mtimeMs)
      return true
    }
    // 上次修改时间 >= 本次修改时间
    else if (cachedMtime >= mtimeMs) {
      // 走缓存
      // mtimeCache.set(id, mtimeMs)
      return false
    }
    else {
      this.mtimeMap.set(id, mtimeMs)
      return true
    }
  }
}
