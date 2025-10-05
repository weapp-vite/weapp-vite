import type { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'

type HashInput = string | Buffer

function createSignature(content: HashInput) {
  return createHash('sha1').update(content).digest('hex')
}

export class FileCache<T extends object> {
  cache: LRUCache<string, T>
  mtimeMap: Map<string, number>
  signatureMap: Map<string, string>

  constructor(max: number = 1024) {
    this.cache = new LRUCache<string, T>({
      max,
    })
    this.mtimeMap = new Map()
    this.signatureMap = new Map()
  }

  get(id: string) {
    return this.cache.get(id)
  }

  set(id: string, content: T) {
    return this.cache.set(id, content)
  }

  delete(id: string) {
    this.signatureMap.delete(id)
    return this.cache.delete(id)
  }

  async isInvalidate(id: string, options?: { content?: HashInput }) {
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
        this.signatureMap.delete(id)
        return true
      }
      throw error
    }

    // 上次的修改时间
    if (mtimeMs === undefined) {
      return true
    }

    const cachedMtime = this.mtimeMap.get(id)
    const nextSignature = options?.content !== undefined
      ? createSignature(options.content)
      : undefined
    const updateSignature = () => {
      if (nextSignature !== undefined) {
        this.signatureMap.set(id, nextSignature)
      }
    }
    if (cachedMtime === undefined) {
      this.mtimeMap.set(id, mtimeMs)
      updateSignature()
      return true
    }
    // 上次修改时间 >= 本次修改时间
    else if (cachedMtime > mtimeMs) {
      this.mtimeMap.set(id, mtimeMs)
      updateSignature()
      return true
    }
    else if (cachedMtime === mtimeMs) {
      if (nextSignature !== undefined) {
        const prevSignature = this.signatureMap.get(id)
        if (prevSignature !== nextSignature) {
          updateSignature()
          return true
        }
      }
      return false
    }
    else {
      this.mtimeMap.set(id, mtimeMs)
      updateSignature()
      return true
    }
  }
}
