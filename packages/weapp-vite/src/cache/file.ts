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
    // 上次的修改时间
    const cachedMtime = this.mtimeMap.get(id)
    // 本次修改时间
    const { mtimeMs } = await fs.stat(id)
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
