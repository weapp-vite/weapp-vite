import type { Buffer } from 'node:buffer'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'

type HashInput = string | Buffer

const FNV_OFFSET_BASIS = 0xCBF29CE484222325n
const FNV_PRIME = 0x100000001B3n
const FNV_MASK = 0xFFFFFFFFFFFFFFFFn

function fnv1aStep(hash: bigint, byte: number) {
  hash ^= BigInt(byte & 0xFF)
  return (hash * FNV_PRIME) & FNV_MASK
}

function createSignature(content: HashInput) {
  let hash = FNV_OFFSET_BASIS
  if (typeof content === 'string') {
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i)
      hash = fnv1aStep(hash, code & 0xFF)
      const high = code >>> 8
      if (high > 0) {
        hash = fnv1aStep(hash, high)
      }
    }
  }
  else {
    for (const byte of content) {
      hash = fnv1aStep(hash, byte)
    }
  }
  return hash.toString(36)
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
